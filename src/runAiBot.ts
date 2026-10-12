
import * as fs from 'fs';
import { Page, ElementHandle } from 'puppeteer';
import { getBrowser, getPage, createChromeSession } from './modules/open_chrome';
import {
  print_lg, critical_error_log, buffer, calculate_date_posted, truncate_for_csv
} from './modules/helpers';
import {
  find_by_class,
  text_input_by_ID, try_xp, try_linkText,
  try_clickButton,
  wait_span_click,
  multi_sel_noWait,
  boolean_button_click,
  try_find_by_classes,
  text_input
} from './modules/clickers_and_finders';
import { validate_config } from './modules/validator';

// Config imports
import * as personals from './config/personals';
import * as questions from './config/questions';
import * as search from './config/search';
import * as secrets from './config/secrets';
import * as settings from './config/settings';

// AI imports (conditional)
let ai_create_openai_client: any, _ai_extract_skills: any, _ai_answer_question: any, ai_close_openai_client: any;
let deepseek_create_client: any, _deepseek_extract_skills: any, _deepseek_answer_question: any;
let gemini_create_client: any, _gemini_extract_skills: any, _gemini_answer_question: any;

if (secrets.use_AI) {
  const openaiModule = require('./modules/ai/openaiConnections');
  ai_create_openai_client = openaiModule.ai_create_openai_client;
  _ai_extract_skills = openaiModule.ai_extract_skills;
  _ai_answer_question = openaiModule.ai_answer_question;
  ai_close_openai_client = openaiModule.ai_close_openai_client;

  const deepseekModule = require('./modules/ai/deepseekConnections');
  deepseek_create_client = deepseekModule.deepseek_create_client;
  _deepseek_extract_skills = deepseekModule.deepseek_extract_skills;
  _deepseek_answer_question = deepseekModule.deepseek_answer_question;

  const geminiModule = require('./modules/ai/geminiConnections');
  gemini_create_client = geminiModule.gemini_create_client;
  _gemini_extract_skills = geminiModule.gemini_extract_skills;
  _gemini_answer_question = geminiModule.gemini_answer_question;
}

// Global Variables
let page: Page;
let _linkedIn_tab: string | null = null;
let _useNewResume = true;
const _randomly_answered_questions = new Set<string>();
let _tabs_count = 1;
let easy_applied_count = 0;
let external_jobs_count = 0;
let failed_count = 0;
let skip_count = 0;
let _dailyEasyApplyLimitReached = false;
let aiClient: any = null;
let about_company_for_ai: string | null = null;

// Initialize settings based on run_in_background
let _pause_at_failed_question = questions.pause_at_failed_question;
let _pause_before_submit = questions.pause_before_submit;
let _run_non_stop = settings.run_non_stop;

if (settings.run_in_background) {
  _pause_at_failed_question = false;
  _pause_before_submit = false;
  _run_non_stop = false;
}

const first_name = personals.first_name.trim();
const middle_name = personals.middle_name.trim();
const last_name = personals.last_name.trim();
const _full_name = middle_name
  ? `${first_name} ${middle_name} ${last_name}`
  : `${first_name} ${last_name}`;

// Salary calculations
const _desired_salary_lakhs = (questions.desired_salary / 100000).toFixed(2);
const _desired_salary_monthly = (questions.desired_salary / 12).toFixed(2);
const _desired_salary_str = String(questions.desired_salary);

const _current_ctc_lakhs = (questions.current_ctc / 100000).toFixed(2);
const _current_ctc_monthly = (questions.current_ctc / 12).toFixed(2);
const _current_ctc_str = String(questions.current_ctc);

const _notice_period_months = String(Math.floor(questions.notice_period / 30));
const _notice_period_weeks = String(Math.floor(questions.notice_period / 7));
const _notice_period_str = String(questions.notice_period);

// Experience regex
const _re_experience = /[(]?\s*(\d+)\s*[)]?\s*[-to]*\s*\d*[+]*\s*year[s]?/gi;

let _applied_jobs = new Set<string>();
let _rejected_jobs = new Set<string>();
let _blacklisted_companies = new Set<string>();

// Login Functions
async function is_logged_in_LN(): Promise<boolean> {
  const currentUrl = page.url();
  if (currentUrl === "https://www.linkedin.com/feed/") return true;
  if (await try_linkText(page, "Sign in")) return false;
  if (await try_xp(page, '//button[@type="submit" and contains(text(), "Sign in")]')) return false;
  if (await try_linkText(page, "Join now")) return false;
  print_lg("Didn't find Sign in link, so assuming user is logged in!");
  return true;
}

async function login_LN(): Promise<void> {
  await page.goto("https://www.linkedin.com/login");

  if (secrets.username === "" || secrets.password === "") {
    console.log("User did not configure username and password in .env, hence can't login automatically! Please login manually!");
    return;
  }

  try {
    try {
      await text_input_by_ID(page, "username", secrets.username, 1);
    } catch (e) {
      print_lg("Couldn't find username field.");
    }

    try {
      await text_input_by_ID(page, "password", secrets.password, 1);
    } catch (e) {
      print_lg("Couldn't find password field.");
    }

    //  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await try_clickButton(page, "Sign in")
  } catch (e1: any) {
    try {
      print_lg(`Trying to login with profile button...${JSON.stringify(e1)}`);
      const profileButton = await find_by_class(page, "profile__details", 2);
      if (profileButton) await profileButton.click();
    } catch (e2: any) {
      print_lg(`Couldn't Login!${JSON.stringify(e2)}`);
    }
  }

  try {
    await page.waitForFunction(
      "window.location.href === 'https://www.linkedin.com/feed/'",
      { timeout: 10000 }
    );
    print_lg("Login successful!");
  } catch (e: any) {
    print_lg("Seems like login attempt failed! Possibly due to wrong credentials or already logged in! Try logging in manually!");
  }
}

// Get applied job IDs from CSV
function _get_applied_job_ids(): Set<string> {
  const job_ids = new Set<string>();
  try {
    if (!fs.existsSync(settings.file_name)) {
      print_lg(`The CSV file '${settings.file_name}' does not exist.`);
      return job_ids;
    }

    const fileContent = fs.readFileSync(settings.file_name, 'utf-8');
    const lines = fileContent.split('\n');
    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (line) {
        const jobId = line.split(',')[0];
        if (jobId) job_ids.add(jobId);
      }
    }
  } catch (e: any) {
    print_lg(`Error reading CSV file: ${e}`);
  }
  return job_ids;
}


function answer_common_questions(label: string, answer: string): string {
  const low = label.toLowerCase();
  if (low.includes('sponsorship') || low.includes('visa')) {
    answer = questions.require_visa;
  }
  return answer;
}

// Ask the configured AI provider to answer a form question. Returns "" if AI is disabled or fails.
async function ask_ai(
  label: string,
  options: string[] | null,
  questionType: 'text' | 'textarea' | 'single_select' | 'multiple_select',
  jobDescription: string | null,
): Promise<string> {
  if (!secrets.use_AI || !aiClient) return "";
  const answerFn =
    secrets.ai_provider === "openai" ? _ai_answer_question :
    secrets.ai_provider === "deepseek" ? _deepseek_answer_question :
    secrets.ai_provider === "gemini" ? _gemini_answer_question : null;
  if (!answerFn) return "";
  try {
    const answer = await answerFn(aiClient, label, options, questionType, jobDescription || undefined, null, questions.user_information_all);
    return String(answer ?? "").trim();
  } catch (e) {
    print_lg("Failed to get AI answer!", e as any);
    return "";
  }
}

// Find the option that best matches an answer: exact match first, then substring either way.
function match_option(options: string[], answer: string): number {
  const ans = answer.trim().toLowerCase();
  if (!ans) return -1;
  const exact = options.findIndex(o => o.trim().toLowerCase() === ans);
  if (exact !== -1) return exact;
  return options.findIndex(o => {
    const opt = o.trim().toLowerCase();
    return !!opt && (opt.includes(ans) || ans.includes(opt));
  });
}

async function set_search_location(): Promise<void> {
  const loc = search.search_location.trim();
  if (!loc) return;
  try {
    print_lg(`Setting search location as: "${loc}"`);
    const searchLocationEle = await try_xp(
      page,
      ".//input[@aria-label='City, state, or zip code' and not(@disabled)]",
      false
    );
    await text_input(page, searchLocationEle as ElementHandle, search.search_location, "Search Location");
  } catch (e) {
    print_lg("Failed to update search location, continuing with default location!", e as any);
  }
}

async function apply_filters(): Promise<void> {
  await set_search_location();

  try {
    const recommended_wait = settings.click_gap < 1 ? 1 : 0;

    // await wait_span_click(page, "All filters");
    await buffer(recommended_wait);

    // await wait_span_click(page, search.sort_by);
    // await wait_span_click(page, search.date_posted);
    await buffer(recommended_wait);

    await multi_sel_noWait(page, search.experience_level);
    await multi_sel_noWait(page, search.companies);
    if (search.experience_level.length || search.companies.length) await buffer(recommended_wait);

    await multi_sel_noWait(page, search.job_type);
    await multi_sel_noWait(page, search.on_site);
    if (search.job_type.length || search.on_site.length) await buffer(recommended_wait);

    // Easy Apply is applied via the f_AL URL param in build_search_url; clicking the toggle here would turn it off

    await multi_sel_noWait(page, search.location);
    await multi_sel_noWait(page, search.industry);
    if (search.location.length || search.industry.length) await buffer(recommended_wait);

    await multi_sel_noWait(page, search.job_function);
    await multi_sel_noWait(page, search.job_titles);
    if (search.job_function.length || search.job_titles.length) await buffer(recommended_wait);

    if (search.under_10_applicants) await boolean_button_click(page, "Under 10 applicants");
    if (search.in_your_network) await boolean_button_click(page, "In your network");
    if (search.fair_chance_employer) await boolean_button_click(page, "Fair Chance Employer");

    await wait_span_click(page, search.salary);
    await buffer(recommended_wait);

    await multi_sel_noWait(page, search.benefits);
    await multi_sel_noWait(page, search.commitments);
    if (search.benefits.length || search.commitments.length) await buffer(recommended_wait);

    const [showResultsButton] = await page.$x(
      '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "apply current filters to show")]'
    );
    if (showResultsButton) {
      await (showResultsButton as ElementHandle).click();
    }
  } catch (e) {
    print_lg("Setting the preferences failed!", e as any);
  }
}

async function get_page_info(): Promise<{ paginationElement: ElementHandle | null; currentPage: number | null }> {
  try {
    const paginationElement = await try_find_by_classes(page, [
      "jobs-search-pagination__pages",
      "artdeco-pagination",
      "artdeco-pagination__pages",
    ]);
    await (await import('./modules/clickers_and_finders')).scroll_to_view(page, paginationElement);
    const activeBtn = await paginationElement.$("button.active");
    const text = activeBtn ? (await page.evaluate(el => el.textContent, activeBtn))?.trim() || "1" : "1";
    const currentPage = parseInt(text, 10);
    return { paginationElement, currentPage };
  } catch (e) {
    print_lg("Failed to find Pagination element, hence couldn't scroll till end!");
    print_lg(e as any);
    return { paginationElement: null, currentPage: null };
  }
}

async function get_job_main_details(
  job: ElementHandle,
): Promise<{ jobId: string; title: string; company: string; workLocation: string; workStyle: string; skip: boolean }> {
  let skip = false;
  const jobDetailsButton = await job.$("a");
  if (!jobDetailsButton) {
    return { jobId: "", title: "", company: "", workLocation: "", workStyle: "", skip: true };
  }

  const jobId = (await job.evaluate((el: any) => el.getAttribute("data-occludable-job-id"))) || "";
  let title =
    (await jobDetailsButton.evaluate((el: any) => (el && (el.innerText ?? el.textContent)) || "")) || "";
  const newLineIndex = title.indexOf("\n");
  if (newLineIndex !== -1) title = title.slice(0, newLineIndex);

  const otherDetailsHandle = await job.$(".artdeco-entity-lockup__subtitle");
  const otherDetails = otherDetailsHandle
    ? ((await otherDetailsHandle.evaluate(
      (el: any) => (el && (el.innerText ?? el.textContent)) || "",
    )) as string)
    : "";
  const index = otherDetails.indexOf(" · ");
  const company = index !== -1 ? otherDetails.slice(0, index) : otherDetails;
  let workLocationRaw = index !== -1 ? otherDetails.slice(index + 3) : "";
  const workStyle = workLocationRaw.includes("(")
    ? workLocationRaw.slice(workLocationRaw.lastIndexOf("(") + 1, workLocationRaw.lastIndexOf(")"))
    : "";
  const workLocation = workLocationRaw.includes("(")
    ? workLocationRaw.slice(0, workLocationRaw.lastIndexOf("(")).trim()
    : workLocationRaw.trim();

  if (_blacklisted_companies.has(company)) {
    print_lg(`Skipping "${title} | ${company}" job (Blacklisted Company). Job ID: ${jobId}!`);
    skip = true;
  } else if (_rejected_jobs.has(jobId)) {
    print_lg(`Skipping previously rejected "${title} | ${company}" job. Job ID: ${jobId}!`);
    skip = true;
  }

  try {
    const appliedFooter = await job.$(".job-card-container__footer-job-state");
    if (appliedFooter) {
      const text =
        (await appliedFooter.evaluate((el: any) => (el && (el.innerText ?? el.textContent)) || "")) || "";
      if (text.trim() === "Applied") {
        skip = true;
        print_lg(`Already applied to "${title} | ${company}" job. Job ID: ${jobId}!`);
      }
    }
  } catch {
    // ignore
  }

  if (!skip && jobDetailsButton) {
    try {
      await jobDetailsButton.click();
      await buffer(settings.click_gap);
    } catch (e) {
      print_lg(
        `Failed to click "${title} | ${company}" job on details button. Job ID: ${jobId}!`,
        e as any,
      );
      skip = true;
    }
  }

  return { jobId, title, company, workLocation, workStyle, skip };
}

async function check_blacklist(
  jobId: string,
  company: string,
): Promise<{ jobsTopCard: ElementHandle | null }> {
  const jobsTopCard = await try_find_by_classes(page, [
    "job-details-jobs-unified-top-card__primary-description-container",
    "job-details-jobs-unified-top-card__primary-description",
    "jobs-unified-top-card__primary-description",
    "jobs-details__main-content",
  ]);
  const aboutCompanyOrgEle = await find_by_class(page, "jobs-company__box");
  await (await import('./modules/clickers_and_finders')).scroll_to_view(page, aboutCompanyOrgEle);

  const aboutCompanyOrg = await aboutCompanyOrgEle.evaluate(
    (el: any) => (el && (el.innerText ?? el.textContent)) || "",
  );
  const aboutCompany = aboutCompanyOrg.toLowerCase();

  let skipChecking = false;
  for (const word of search.about_company_good_words) {
    if (aboutCompany.includes(word.toLowerCase())) {
      print_lg(`Found the word "${word}". So, skipped checking for blacklist words.`);
      skipChecking = true;
      break;
    }
  }

  if (!skipChecking) {
    for (const word of search.about_company_bad_words) {
      if (aboutCompany.includes(word.toLowerCase())) {
        _rejected_jobs.add(jobId);
        _blacklisted_companies.add(company);
        throw new Error(`"${aboutCompanyOrg}"\n\nContains "${word}".`);
      }
    }
  }

  await buffer(settings.click_gap);
  await (await import('./modules/clickers_and_finders')).scroll_to_view(page, jobsTopCard);
  return { jobsTopCard };
}

function extract_years_of_experience(text: string): number {
  const matches = [...text.matchAll(_re_experience)].map(m => parseInt(m[1], 10)).filter(n => !isNaN(n) && n <= 12);
  if (matches.length === 0) {
    print_lg(`\n${text}\n\nCouldn't find experience requirement in About the Job!`);
    return 0;
  }
  return Math.min(...matches);
}

async function get_job_description(): Promise<{
  description: string | 'Unknown';
  experienceRequired: number | 'Unknown';
  skip: boolean;
  skipReason: string | null;
  skipMessage: string | null;
}> {
  let jobDescription: string | 'Unknown' = "Unknown";
  let experienceRequired: number | 'Unknown' = "Unknown" as any;
  let skip = false;
  let skipReason: string | null = null;
  let skipMessage: string | null = null;

  try {
    const descEle = await find_by_class(page, "jobs-box__html-content");
    jobDescription =
      (await descEle.evaluate((el: any) => (el && (el.innerText ?? el.textContent)) || "")) || "Unknown";
    const jobDescriptionLow = jobDescription.toLowerCase();

    for (const word of search.bad_words) {
      if (jobDescriptionLow.includes(word.toLowerCase())) {
        skipMessage = `\n${jobDescription}\n\nContains bad word "${word}". Skipping this job!\n`;
        skipReason = "Found a Bad Word in About Job";
        skip = true;
        break;
      }
    }

    if (!skip && !search.security_clearance &&
      (jobDescriptionLow.includes("polygraph") ||
        jobDescriptionLow.includes("clearance") ||
        jobDescriptionLow.includes("secret"))) {
      skipMessage = `\n${jobDescription}\n\nFound "Clearance" or "Polygraph". Skipping this job!\n`;
      skipReason = "Asking for Security clearance";
      skip = true;
    }

    if (!skip) {
      let foundMasters = 0;
      if (search.did_masters && jobDescriptionLow.includes("master")) {
        print_lg(`Found the word "master" in \n${jobDescription}`);
        foundMasters = 2;
      }
      experienceRequired = extract_years_of_experience(jobDescription);
      if (search.current_experience > -1 && typeof experienceRequired === "number" &&
        experienceRequired > search.current_experience + foundMasters) {
        skipMessage = `\n${jobDescription}\n\nExperience required ${experienceRequired} > Current Experience ${search.current_experience + foundMasters
          }. Skipping this job!\n`;
        skipReason = "Required experience is high";
        skip = true;
      }
    }
  } catch (e) {
    if (jobDescription === "Unknown") {
      print_lg("Unable to extract job description!");
    } else {
      experienceRequired = "Error in extraction" as any;
      print_lg("Unable to extract years of experience required!");
    }
  }

  return { description: jobDescription, experienceRequired, skip, skipReason, skipMessage };
}

async function answer_questions(
  modal: ElementHandle,
  questionsList: Set<any>,
  workLocation: string,
  jobDescription: string | null = null,
): Promise<Set<any>> {
  const allQuestions = await modal.$x(".//div[@data-test-form-element]");

  for (const question of allQuestions) {
    // SELECT questions
    const selectHandle = await question.$("select");
    if (selectHandle) {
      let labelOrg = "Unknown";
      try {
        const label = await question.$("label span");
        if (label) {
          labelOrg = (await label.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "Unknown";
        }
      } catch {
        // ignore
      }

      let answer = "Yes";
      const labelLow = labelOrg.toLowerCase();

      const options = await selectHandle.$$("option");
      const optionsText: string[] = [];
      for (const opt of options) {
        const txt = (await opt.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "";
        optionsText.push(txt);
      }

      const selectedOption = ""; // Puppeteer doesn't expose selected easily without page.evaluate; skip exact prev
      const prevAnswer = selectedOption;

      if (questions.overwrite_previous_answers || !selectedOption || selectedOption === "Select an option") {
        if (labelLow.includes("email") || labelLow.includes("phone")) {
          answer = prevAnswer || answer;
        } else if (labelLow.includes("location") || labelLow.includes("city") || labelLow.includes("state") || labelLow.includes("country")) {
          if (labelLow.includes("country")) {
            answer = ""; // country not in TS config yet
          } else if (labelLow.includes("state")) {
            answer = personals.state;
          } else if (labelLow.includes("city")) {
            answer = personals.current_city || workLocation;
          } else {
            answer = workLocation;
          }
        } else {
          answer = answer_common_questions(labelLow, answer);
        }

        // Try to choose matching option text, asking AI if the rule-based answer matches nothing
        const realOptions = optionsText.filter(o => o.trim() && o.trim() !== "Select an option");
        let chosen: string | undefined = optionsText[match_option(optionsText, answer)];
        if (!chosen && realOptions.length) {
          const aiAnswer = await ask_ai(labelOrg, realOptions, 'single_select', jobDescription);
          chosen = optionsText[match_option(optionsText, aiAnswer)];
        }
        if (!chosen && optionsText.length > 1) {
          // fallback random pick (but deterministic-ish): pick second option
          chosen = optionsText[1];
        }

        if (chosen) {
          await selectHandle.select(chosen);
          answer = chosen;
        }
      }

      questionsList.add([`${labelOrg}`, answer, "select", prevAnswer]);
      continue;
    }

    // RADIO questions
    const radioFieldset = await question.$('fieldset[data-test-form-builder-radio-button-form-component="true"]');
    if (radioFieldset) {
      let labelOrg = "Unknown";
      const titleSpan = await radioFieldset.$('span[data-test-form-builder-radio-button-form-component__title]');
      if (titleSpan) {
        labelOrg = (await titleSpan.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "Unknown";
      }
      let answer = "Yes";
      const labelLow = labelOrg.toLowerCase();

      const options = await radioFieldset.$$("input");
      const optionsLabels: string[] = [];
      let prevAnswer: string | null = null;

      for (const opt of options) {
        const id = await opt.evaluate((el: any) => el.getAttribute("id"));
        let optionLabelText = "Unknown";
        if (id) {
          const [optionLabel] = await radioFieldset.$x(`.//label[@for="${id}"]`);
          if (optionLabel) {
            optionLabelText =
              (await optionLabel.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "Unknown";
          }
        }
        optionsLabels.push(optionLabelText.trim());
      }

      if (questions.overwrite_previous_answers || !prevAnswer) {
        answer = answer_common_questions(labelLow, answer);
        // Try to click label matching answer, asking AI if the rule-based answer matches nothing
        let foundIndex = match_option(optionsLabels, answer);
        if (foundIndex === -1 && optionsLabels.length > 0) {
          const aiAnswer = await ask_ai(labelOrg, optionsLabels, 'single_select', jobDescription);
          foundIndex = match_option(optionsLabels, aiAnswer);
          if (foundIndex !== -1) answer = optionsLabels[foundIndex];
        }
        if (foundIndex === -1 && optionsLabels.length > 0) {
          foundIndex = 0;
          answer = optionsLabels[0];
        }
        if (foundIndex !== -1) {
          const opt = options[foundIndex];
          await opt.click();
        }
      } else {
        answer = prevAnswer || answer;
      }

      questionsList.add([`${labelOrg}`, answer, "radio", prevAnswer]);
      continue;
    }

    // TEXT input questions
    const textInput = await question.$("input[type='text']");
    if (textInput) {
      let doActions = false;
      let labelOrg = "Unknown";
      const labelEle = await question.$("label[for]");
      if (labelEle) {
        labelOrg = (await labelEle.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "Unknown";
      }
      let answer = "";
      const labelLow = labelOrg.toLowerCase();

      const prevValue =
        (await textInput.evaluate((el: any) => (el && (el.value ?? el.getAttribute("value"))) || "")) || "";

      if (!prevValue || questions.overwrite_previous_answers) {
        if (labelLow.includes("experience") || labelLow.includes("years")) {
          answer = questions.years_of_experience;
        } else if (labelLow.includes("phone") || labelLow.includes("mobile")) {
          answer = personals.phone_number;
        } else if (labelLow.includes("street")) {
          answer = personals.street;
        } else if (labelLow.includes("city") || labelLow.includes("location") || labelLow.includes("address")) {
          answer = personals.current_city || workLocation;
          doActions = true;
        } else if (labelLow.includes("signature") || labelLow.includes("full name")) {
          answer = _full_name;
        } else if (labelLow.includes("name")) {
          if (labelLow.includes("full")) answer = _full_name;
          else if (labelLow.includes("first") && !labelLow.includes("last")) answer = first_name;
          else if (labelLow.includes("middle") && !labelLow.includes("last")) answer = middle_name;
          else if (labelLow.includes("last") && !labelLow.includes("first")) answer = last_name;
          else answer = _full_name;
        } else if (labelLow.includes("notice")) {
          if (labelLow.includes("month")) answer = _notice_period_months;
          else if (labelLow.includes("week")) answer = _notice_period_weeks;
          else answer = _notice_period_str;
        } else if (
          labelLow.includes("salary") ||
          labelLow.includes("compensation") ||
          labelLow.includes("ctc") ||
          labelLow.includes("pay")
        ) {
          const current = labelLow.includes("current") || labelLow.includes("present");
          if (current) {
            if (labelLow.includes("month")) answer = _current_ctc_monthly;
            else if (labelLow.includes("lakh")) answer = _current_ctc_lakhs;
            else answer = _current_ctc_str;
          } else {
            if (labelLow.includes("month")) answer = _desired_salary_monthly;
            else if (labelLow.includes("lakh")) answer = _desired_salary_lakhs;
            else answer = _desired_salary_str;
          }
        } else if (labelLow.includes("scale of 1-10")) {
          answer = questions.confidence_level;
        } else if (labelLow.includes("headline")) {
          answer = questions.linkedin_headline;
        } else {
          answer = answer_common_questions(labelLow, answer);
        }

        if (!answer && secrets.use_AI && aiClient) {
          try {
            if (secrets.ai_provider === "openai") {
              answer = await _ai_answer_question(
                aiClient,
                labelOrg,
                null,
                'text',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            } else if (secrets.ai_provider === "deepseek") {
              answer = await _deepseek_answer_question(
                aiClient,
                labelOrg,
                null,
                'text',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            } else if (secrets.ai_provider === "gemini") {
              answer = await _gemini_answer_question(
                aiClient,
                labelOrg,
                null,
                'text',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            }
          } catch (e) {
            print_lg("Failed to get AI answer!", e as any);
          }
        }

        await textInput.click({ clickCount: 3 });
        await textInput.type(String(answer ?? ""));
      }

      questionsList.add([labelOrg, prevValue, "text", prevValue]);
      continue;
    }

    // TEXTAREA questions
    const textArea = await question.$("textarea");
    if (textArea) {
      let labelOrg = "Unknown";
      const labelEle = await question.$("label[for]");
      if (labelEle) {
        labelOrg = (await labelEle.evaluate((el: any) => el && (el.innerText ?? el.textContent) || "")) || "Unknown";
      }
      const labelLow = labelOrg.toLowerCase();
      let answer = "";
      const prevValue =
        (await textArea.evaluate((el: any) => (el && (el.value ?? el.getAttribute("value"))) || "")) || "";

      if (!prevValue || questions.overwrite_previous_answers) {
        if (labelLow.includes("summary")) answer = questions.linkedin_summary;
        else if (labelLow.includes("cover")) answer = questions.cover_letter;

        if (!answer && secrets.use_AI && aiClient) {
          try {
            if (secrets.ai_provider === "openai") {
              answer = await _ai_answer_question(
                aiClient,
                labelOrg,
                null,
                'textarea',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            } else if (secrets.ai_provider === "deepseek") {
              answer = await _deepseek_answer_question(
                aiClient,
                labelOrg,
                null,
                'textarea',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            } else if (secrets.ai_provider === "gemini") {
              answer = await _gemini_answer_question(
                aiClient,
                labelOrg,
                null,
                'textarea',
                jobDescription || undefined,
                null,
                questions.user_information_all,
              );
            }
          } catch (e) {
            print_lg("Failed to get AI answer!", e as any);
          }
        }

        await textArea.click({ clickCount: 3 });
        await textArea.type(String(answer ?? ""));
      }

      questionsList.add([labelOrg, prevValue, "textarea", prevValue]);
      continue;
    }

    // CHECKBOX questions
    const checkbox = await question.$("input[type='checkbox']");
    if (checkbox) {
      const hiddenSpan = await question.$("span.visually-hidden");
      const labelOrg =
        (hiddenSpan &&
          (await hiddenSpan.evaluate((el: any) => el && (el.innerText ?? el.textContent) || ""))) ||
        "Unknown";
      const prevChecked = await checkbox.evaluate((el: any) => !!el.checked);
      let checked = prevChecked;
      if (!prevChecked) {
        try {
          await checkbox.click();
          checked = true;
        } catch (e) {
          print_lg("Checkbox click failed!", e as any);
        }
      }
      questionsList.add([`${labelOrg}`, checked, "checkbox", prevChecked]);
      continue;
    }
  }

  return questionsList;
}

async function upload_resume(modal: ElementHandle, resume: string): Promise<{ uploaded: boolean; resumeName: string }> {
  try {
    const fileInput = await modal.$('input[name="file"]');
    if (fileInput) {
      await fileInput.uploadFile(resume);
      return { uploaded: true, resumeName: questions.default_resume_path };
    }
  } catch {
    // ignore
  }
  return { uploaded: false, resumeName: "Previous resume" };
}

async function external_apply(
  jobId: string,
  jobLink: string,
  resume: string,
  dateListed: any,
  applicationLink: string,
): Promise<{ skip: boolean; applicationLink: string }> {
  try {
    const [applyButton] = await page.$x(
      ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3')]",
    );
    if (!applyButton) {
      print_lg("Failed to apply!");
      failed_count += 1;
      return { skip: true, applicationLink };
    }
    await (applyButton as ElementHandle).click();
    await wait_span_click(page, "Continue", 1, true, false);
    const currentUrl = page.url();
    applicationLink = currentUrl;
    print_lg(`Got the external application link "${applicationLink}"`);
    return { skip: false, applicationLink };
  } catch (e) {
    print_lg("Failed to apply!", e as any);
    failed_count += 1;
    return { skip: true, applicationLink };
  }
}

async function submitted_jobs(
  jobId: string,
  title: string,
  company: string,
  workLocation: string,
  workStyle: string,
  description: string | 'Unknown',
  experienceRequired: number | 'Unknown',
  skills: any,
  hrName: string,
  hrLink: string,
  resume: string,
  reposted: boolean,
  dateListed: any,
  dateApplied: any,
  jobLink: string,
  applicationLink: string,
  questionsList: any,
  connectRequest: string,
): Promise<void> {
  try {
    const exists = fs.existsSync(settings.file_name);
    const stream = fs.createWriteStream(settings.file_name, { flags: 'a', encoding: 'utf-8' });
    if (!exists) {
      stream.write(
        'Job ID,Title,Company,Work Location,Work Style,About Job,Experience required,Skills required,HR Name,HR Link,Resume,Re-posted,Date Posted,Date Applied,Job Link,External Job link,Questions Found,Connect Request\n',
      );
    }
    const row = [
      truncate_for_csv(jobId),
      truncate_for_csv(title),
      truncate_for_csv(company),
      truncate_for_csv(workLocation),
      truncate_for_csv(workStyle),
      truncate_for_csv(description),
      truncate_for_csv(experienceRequired),
      truncate_for_csv(skills),
      truncate_for_csv(hrName),
      truncate_for_csv(hrLink),
      truncate_for_csv(resume),
      truncate_for_csv(reposted),
      truncate_for_csv(dateListed),
      truncate_for_csv(dateApplied),
      truncate_for_csv(jobLink),
      truncate_for_csv(applicationLink),
      truncate_for_csv(questionsList),
      truncate_for_csv(connectRequest),
    ];
    stream.write(row.join(',') + '\n');
    stream.end();
  } catch (e) {
    print_lg("Failed to update submitted jobs list!", e as any);
  }
}

// ===== Main job application loop (simplified port) =====

// Build the LinkedIn job search URL for a term, encoding date posted, sort order and Easy Apply as URL filters
function build_search_url(term: string): string {
  const params = new URLSearchParams({ keywords: term, origin: "JOB_SEARCH_PAGE_JOB_FILTER", refresh: "true" });
  const loc = search.search_location.trim();
  if (loc) params.set("location", loc);
  const datePosted: Record<string, string> = { "Past 24 hours": "r86400", "Past week": "r604800", "Past month": "r2592000" };
  if (datePosted[search.date_posted]) params.set("f_TPR", datePosted[search.date_posted]);
  const sortBy: Record<string, string> = { "Most recent": "DD", "Most relevant": "R" };
  if (sortBy[search.sort_by]) params.set("sortBy", sortBy[search.sort_by]);
  if (search.easy_apply_only) params.set("f_AL", "true");
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function apply_to_jobs(searchTerms: string[]): Promise<void> {
  _applied_jobs = _get_applied_job_ids();
  _rejected_jobs = new Set();
  _blacklisted_companies = new Set();

  const terms = [...searchTerms];
  if (search.randomize_search_order) {
    for (let i = terms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [terms[i], terms[j]] = [terms[j], terms[i]];
    }
  }

  for (const term of terms) {
    await page.goto(build_search_url(term));
    print_lg("\n________________________________________________________________________________________________________________________\n");
    print_lg(`\n>>>> Now searching for "${term}" <<<<\n\n`);

    await apply_filters();

    let currentCount = 0;
    while (currentCount < search.switch_number) {
      await page.waitForXPath("//li[@data-occludable-job-id]", { timeout: 15000 }).catch(() => { });

      const { paginationElement, currentPage } = await get_page_info();

      await buffer(3);
      const jobListings = await page.$x("//li[@data-occludable-job-id]");

      for (const job of jobListings) {
        if (currentCount >= search.switch_number) break;
        print_lg("\n-@-\n");

        const { jobId, title, company, workLocation, workStyle, skip } = await get_job_main_details(job as ElementHandle);
        if (skip || !jobId) continue;

        if (_applied_jobs.has(jobId)) {
          print_lg(`Already applied to "${title} | ${company}" job. Job ID: ${jobId}!`);
          continue;
        }

        let jobLink = `https://www.linkedin.com/jobs/view/${jobId}`;
        let applicationLink = "Easy Applied";
        let dateApplied: any = "Pending";
        let hrLink = "Unknown";
        let hrName = "Unknown";
        let connectRequest = "In Development";
        let dateListed: any = "Unknown";
        let skills: any = "Needs an AI";
        let resume = "Pending";
        let reposted = false;
        let questionsList: Set<any> = new Set();

        try {
          const { jobsTopCard } = await check_blacklist(jobId, company);
          if (jobsTopCard) {
            try {
              const timePostedText = await jobsTopCard.$eval(
                'span[contains(normalize-space(), " ago")]',
                (el: any) => (el && (el.innerText ?? el.textContent)) || "",
              );
              if (timePostedText.includes("Reposted")) {
                reposted = true;
              }
              const date = calculate_date_posted(timePostedText.trim());
              if (date) dateListed = date;
            } catch {
              // ignore
            }
          }
        } catch (e) {
          print_lg(e as any, 'Skipping this job!\n');
          skip_count += 1;
          continue;
        }

        const { description, experienceRequired, skip: skipDesc, skipReason, skipMessage } = await get_job_description();
        if (skipDesc) {
          if (skipMessage) print_lg(skipMessage);
          skip_count += 1;
          continue;
        }

        if (secrets.use_AI && description !== "Unknown") {
          try {
            if (secrets.ai_provider === "openai") {
              skills = await _ai_extract_skills(aiClient, description);
            } else if (secrets.ai_provider === "deepseek") {
              skills = await _deepseek_extract_skills(aiClient, description);
            } else if (secrets.ai_provider === "gemini") {
              skills = await _gemini_extract_skills(aiClient, description);
            } else {
              skills = "In Development";
            }
            print_lg(`Extracted skills using ${secrets.ai_provider} AI`);
          } catch (e) {
            print_lg("Failed to extract skills:", e as any);
            skills = "Error extracting skills";
          }
        }

        let uploaded = false;
        const easyApplyButton = await try_xp(
          page,
          ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3') and contains(@aria-label, 'Easy')]",
        );
        if (easyApplyButton) {
          try {
            const modal = await find_by_class(page, "jobs-easy-apply-modal", 5.0);
            await wait_span_click(page, "Next", 1);
            resume = "Previous resume";
            questionsList = new Set();
            let nextButtonExists = true;
            let nextCounter = 0;

            while (nextButtonExists) {
              nextCounter += 1;
              if (nextCounter >= 15) {
                throw new Error("Seems like stuck in a continuous loop of next, probably because of new questions.");
              }
              // Answer questions on the current step using config + AI
              questionsList = await answer_questions(modal, questionsList, workLocation, description as string);
              if (_useNewResume && !uploaded) {
                const { uploaded: up, resumeName } = await upload_resume(modal, questions.default_resume_path);
                uploaded = up;
                if (uploaded) resume = resumeName;
              }
              const [reviewBtn] = await modal.$x('.//span[normalize-space(.)="Review"]');
              if (reviewBtn) {
                await (reviewBtn as ElementHandle).click();
                nextButtonExists = false;
              } else {
                const [nextBtn] = await modal.$x('.//button[contains(span, "Next")]');
                if (!nextBtn) {
                  nextButtonExists = false;
                } else {
                  await (nextBtn as ElementHandle).click();
                }
              }
              await buffer(settings.click_gap);
            }

            const submitClicked = await wait_span_click(page, "Submit application", 2, true, true);
            if (submitClicked) {
              dateApplied = new Date();
              await wait_span_click(page, "Done", 2);
            }
          } catch (e) {
            print_lg("Failed to Easy apply!", e as any);
            failed_count += 1;
            continue;
          }
        } else {
          const result = await external_apply(jobId, jobLink, resume, dateListed, applicationLink);
          if (result.skip) continue;
          applicationLink = result.applicationLink;
        }

        await submitted_jobs(
          jobId,
          title,
          company,
          workLocation,
          workStyle,
          description,
          experienceRequired,
          skills,
          hrName,
          hrLink,
          resume,
          reposted,
          dateListed,
          dateApplied,
          jobLink,
          applicationLink,
          questionsList,
          connectRequest,
        );

        if (applicationLink === "Easy Applied") easy_applied_count += 1;
        else external_jobs_count += 1;

        _applied_jobs.add(jobId);
        currentCount += 1;
      }

      if (!paginationElement || currentPage == null) {
        print_lg("Couldn't find pagination element, probably at the end page of results!");
        break;
      }

      try {
        const nextBtn = await paginationElement.$(`button[aria-label='Page ${currentPage + 1}']`);
        if (!nextBtn) {
          print_lg(`\n>-> Didn't find Page ${currentPage + 1}. Probably at the end page of results!\n`);
          break;
        }
        await nextBtn.click();
        print_lg(`\n>-> Now on Page ${currentPage + 1} \n`);
      } catch {
        print_lg(`\n>-> Didn't find Page ${currentPage + 1}. Probably at the end page of results!\n`);
        break;
      }
    }
  }
}

async function run_cycle(totalRuns: number): Promise<number> {
  if (_dailyEasyApplyLimitReached) return totalRuns;
  print_lg("\n########################################################################################################################\n");
  print_lg(`Date and Time: ${new Date()}`);
  print_lg(`Cycle number: ${totalRuns}`);
  print_lg(`Currently looking for jobs posted within '${search.date_posted}' and sorting them by '${search.sort_by}'`);
  await apply_to_jobs(search.search_terms);
  print_lg("########################################################################################################################\n");
  return totalRuns + 1;
}

// Main function
async function main(): Promise<void> {
  console.log("Welcome to the LinkedIn Auto Job Applier.\n\n");

  let total_runs = 1;
  try {
    validate_config();

    if (!fs.existsSync(questions.default_resume_path)) {
      console.log(`Your default resume "${questions.default_resume_path}" is missing! Please update it's folder path "default_resume_path" in config\n\nOR\n\nAdd a resume with exact name and path.\n\nFor now the bot will continue using your previous upload from LinkedIn!`);
      _useNewResume = false;
    }

    // Initialize browser
    await createChromeSession();
    page = getPage();
    const browser = getBrowser();
    const pages = await browser.pages();
    _tabs_count = pages.length;

    // Login to LinkedIn
    await page.goto("https://www.linkedin.com/login");
    if (!(await is_logged_in_LN())) {
      await login_LN();
    }

    _linkedIn_tab = page.url();

    // Initialize AI if enabled
    if (secrets.use_AI) {
      if (secrets.ai_provider === "openai") {
        aiClient = await ai_create_openai_client();
      } else if (secrets.ai_provider === "deepseek") {
        aiClient = deepseek_create_client();
      } else if (secrets.ai_provider === "gemini") {
        aiClient = gemini_create_client();
      }

      try {
        const words = `${first_name} ${last_name}`.split(' ').filter(w => w.length > 3);
        about_company_for_ai = words.join(' ');
        print_lg(`Extracted about company info for AI: '${about_company_for_ai}'`);
      } catch (e: any) {
        print_lg("Failed to extract about company info!", e);
      }
    }

    print_lg("\n########################################################################################################################\n");
    print_lg(`Date and Time: ${new Date()}`);
    print_lg(`Cycle number: ${total_runs}`);
    print_lg(`Currently looking for jobs posted within '${search.date_posted}' and sorting them by '${search.sort_by}'`);


    print_lg("########################################################################################################################\n");

    // Start applying to jobs
    total_runs = await run_cycle(total_runs);
  } catch (e: any) {
    critical_error_log("In Applier Main", e);
    console.error("Error occurred:", e);
  } finally {
    const summary = `Total runs: ${total_runs}\nJobs Easy Applied: ${easy_applied_count}\nExternal job links collected: ${external_jobs_count}\nTotal applied or collected: ${easy_applied_count + external_jobs_count}\nFailed jobs: ${failed_count}\nIrrelevant jobs skipped: ${skip_count}\n`;
    print_lg(summary);

    if (secrets.use_AI && aiClient) {
      try {
        if (secrets.ai_provider === "openai" || secrets.ai_provider === "deepseek") {
          ai_close_openai_client(aiClient);
        }
        print_lg(`Closed ${secrets.ai_provider} AI client.`);
      } catch (e: any) {
        print_lg("Failed to close AI client:", e);
      }
    }

    try {
      const browser = getBrowser();
      if (browser) {
        await browser.close();
      }
    } catch (e: any) {
      print_lg("Browser already closed.", e);
    }
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { main };
