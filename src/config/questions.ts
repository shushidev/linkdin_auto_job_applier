
import * as dotenv from 'dotenv';
dotenv.config();

export const default_resume_path = process.env.DEFAULT_RESUME_PATH || "all resumes/default/resume.pdf";      // (In Development)

export const years_of_experience = process.env.YEARS_OF_EXPERIENCE || "4";          // A number in quotes Eg: "0","1","2","3","4", etc.

// Years of experience per skill, used for "How many years of experience with X?" questions without calling AI.
// Example: SKILL_EXPERIENCE={"node":4,"react":3,"typescript":3,"aws":2}
const skillExperienceEnv = process.env.SKILL_EXPERIENCE;
export const skill_experience: Record<string, number> = skillExperienceEnv ? JSON.parse(skillExperienceEnv) : {};

export const require_visa = process.env.REQUIRE_VISA || "No";               // "Yes" or "No"

export const desired_salary = parseInt(process.env.DESIRED_SALARY || "1200000");          // 80000, 90000, 100000 or 120000 and so on... Do NOT use quotes
export const current_ctc = parseInt(process.env.CURRENT_CTC || "800000");            // 800000, 900000, 1000000 or 1200000 and so on... Do NOT use quotes
export const notice_period = parseInt(process.env.NOTICE_PERIOD || "10");                   // Any number >= 0 without quotes. Eg: 0, 7, 15, 30, 45, etc.

export const linkedin_headline = process.env.LINKEDIN_HEADLINE || "Full Stack Developer with Masters in Computer Science and 4+ years of experience"; // "Headline" or "" to leave this question unanswered

export const linkedin_summary = process.env.LINKEDIN_SUMMARY || `
I'm a Senior Software Engineer at Amazon with Masters in CS and 4+ years of experience in developing and maintaining Full Stack Web applications and cloud solutions. 
Specialized in React, Node.js, and Python.
`;

export const cover_letter = process.env.COVER_LETTER || `
Cover Letter
`;

export const user_information_all = process.env.USER_INFORMATION_ALL || `User Information`;

export const recent_employer = process.env.RECENT_EMPLOYER || "Not Applicable";

export const confidence_level = process.env.CONFIDENCE_LEVEL || "8";             // Any number between "1" to "10" including 1 and 10, put it in quotes ""

export const pause_before_submit = process.env.PAUSE_BEFORE_SUBMIT === "true" || process.env.PAUSE_BEFORE_SUBMIT === undefined ? true : false;         // True or False, Note: True or False are case-sensitive
export const pause_at_failed_question = process.env.PAUSE_AT_FAILED_QUESTION === "true" || process.env.PAUSE_AT_FAILED_QUESTION === undefined ? true : false;    // True or False, Note: True or False are case-sensitive
export const overwrite_previous_answers = process.env.OVERWRITE_PREVIOUS_ANSWERS === "true"; // True or False, Note: True or False are case-sensitive
