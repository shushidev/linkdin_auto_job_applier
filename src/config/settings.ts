

import * as dotenv from 'dotenv';
dotenv.config();

// >>>>>>>>>>> LinkedIn Settings <<<<<<<<<<<

// Keep the External Application tabs open?
export const close_tabs = process.env.CLOSE_TABS === "true" ? false : true;                  // True or False, Note: True or False are case-sensitive
/**
 * Note: RECOMMENDED TO LEAVE IT AS `True`, if you set it `False`, be sure to CLOSE ALL TABS BEFORE CLOSING THE BROWSER!!!
 */

// Follow easy applied companies
export const follow_companies = process.env.FOLLOW_COMPANIES === "true";            // True or False, Note: True or False are case-sensitive

// Do you want the program to run continuously until you stop it? (Beta)
export const run_non_stop = process.env.RUN_NON_STOP === "true";                // True or False, Note: True or False are case-sensitive
/**
 * Note: Will be treated as False if `run_in_background = True`
 */
export const alternate_sortby = process.env.ALTERNATE_SORTBY === "true" || process.env.ALTERNATE_SORTBY === undefined ? true : false;             // True or False, Note: True or False are case-sensitive
export const cycle_date_posted = process.env.CYCLE_DATE_POSTED === "true" || process.env.CYCLE_DATE_POSTED === undefined ? true : false;            // True or False, Note: True or False are case-sensitive
export const stop_date_cycle_at_24hr = process.env.STOP_DATE_CYCLE_AT_24HR === "true" || process.env.STOP_DATE_CYCLE_AT_24HR === undefined ? true : false;      // True or False, Note: True or False are case-sensitive

// >>>>>>>>>>> RESUME GENERATOR (Experimental & In Development) <<<<<<<<<<<

// Give the path to the folder where all the generated resumes are to be stored
export const generated_resume_path = process.env.GENERATED_RESUME_PATH || "all resumes/"; // (In Development)

// >>>>>>>>>>> Global Settings <<<<<<<<<<<

// Directory and name of the files where history of applied jobs is saved (Sentence after the last "/" will be considered as the file name).
export const file_name = process.env.FILE_NAME || "all excels/all_applied_applications_history.csv";
export const failed_file_name = process.env.FAILED_FILE_NAME || "all excels/all_failed_applications_history.csv";
export const logs_folder_path = process.env.LOGS_FOLDER_PATH || "logs/";

// Set the maximum amount of time allowed to wait between each click in secs
export const click_gap = parseInt(process.env.CLICK_GAP || "1");                       // Enter max allowed secs to wait approximately. (Only Non Negative Integers Eg: 0,1,2,3,....)

// If you want to see Chrome running then set run_in_background as False (May reduce performance). 
export const run_in_background = process.env.RUN_IN_BACKGROUND === "true";           // True or False, Note: True or False are case-sensitive ,   If True, this will make pause_at_failed_question, pause_before_submit and run_in_background as False

// If you want to disable extensions then set disable_extensions as True (Better for performance)
export const disable_extensions = process.env.DISABLE_EXTENSIONS === "true";          // True or False, Note: True or False are case-sensitive

// Run in safe mode. Set this true if chrome is taking too long to open or if you have multiple profiles in browser. This will open chrome in guest profile!
export const safe_mode = true

// Do you want scrolling to be smooth or instantaneous? (Can reduce performance if True)
export const smooth_scroll = process.env.SMOOTH_SCROLL === "true";               // True or False, Note: True or False are case-sensitive

// If enabled (True), the program would keep your screen active and prevent PC from sleeping. Instead you could disable this feature (set it to false) and adjust your PC sleep settings to Never Sleep or a preferred time. 
export const keep_screen_awake = process.env.KEEP_SCREEN_AWAKE === "true" || process.env.KEEP_SCREEN_AWAKE === undefined ? true : false;            // True or False, Note: True or False are case-sensitive (Note: Will temporarily deactivate when any application dialog boxes are present (Eg: Pause before submit, Help needed for a question..))

// Run in undetected mode to bypass anti-bot protections (Preview Feature, UNSTABLE. Recommended to leave it as False)
export const stealth_mode = process.env.STEALTH_MODE === "true" || process.env.STEALTH_MODE === undefined ? true : false;                // True or False, Note: True or False are case-sensitive

// Do you want to get alerts on errors related to AI API connection?
export const showAiErrorAlerts = process.env.SHOW_AI_ERROR_ALERTS === "true";            // True or False, Note: True or False are case-sensitive

// >>>>>>>>>>> AI Cost Controls <<<<<<<<<<<

// File where AI answers to application questions are cached and reused across jobs. Edit it to correct an answer.
export const ai_answer_cache_path = process.env.AI_ANSWER_CACHE_PATH || "all excels/ai_answer_cache.json";

// Extract skills from every job description with AI? Costs one AI call per job and only fills the "Skills" CSV column.
export const extract_skills = process.env.EXTRACT_SKILLS === "true";

// Max characters of job description sent to AI for open-ended (textarea) questions. Short questions get no description.
export const ai_max_description_chars = parseInt(process.env.AI_MAX_DESCRIPTION_CHARS || "3000");
