

import OpenAI from 'openai';
import { use_AI, llm_api_url, llm_api_key, llm_model, llm_spec, llm_reasoning_effort, stream_output } from '../../config/secrets';
import { showAiErrorAlerts } from '../../config/settings';
import { print_lg, critical_error_log, convert_to_json } from '../helpers';
import { extract_skills_prompt, extract_skills_response_format, ai_answer_prompt } from './prompts';

const apiCheckInstructions = `

1. Make sure your AI API connection details like url, key, model names, etc are correct.
2. If you're using an local LLM, please check if the server is running.
3. Check if appropriate LLM and Embedding models are loaded and running.

Open \`secret.ts\` in \`/config\` folder to configure your AI API connections.

ERROR:
`;

let showAiErrorAlertsFlag = showAiErrorAlerts;

// Function to show an AI error alert
function ai_error_alert(message: string, stackTrace: Error, title: string = "AI Connection Error"): void {
  if (showAiErrorAlertsFlag) {
    console.log(`${title}: ${message}\n${stackTrace.message}`);
    // In Node.js, we can't use GUI alerts easily, so we'll just log
    // For GUI alerts, you'd need robotjs or electron
  }
  critical_error_log(message, stackTrace);
}

// Function to create an OpenAI client
export async function ai_create_openai_client(): Promise<OpenAI> {
  try {
    print_lg("Creating OpenAI client...");
    if (!use_AI) {
      throw new Error("AI is not enabled! Please enable it by setting `USE_AI=true` in `.env` file.");
    }
    
    const client = new OpenAI({
      baseURL: llm_api_url,
      apiKey: llm_api_key,
    });

    const models = await ai_get_models_list(client);
    if (models instanceof Array && models.length > 0 && typeof models[0] === 'string' && models[0] === "error") {
      throw new Error(models[1] as string);
    }
    if (models.length === 0) {
      throw new Error("No models are available!");
    }
    
    const modelIds = models.map((m: any) => m.id);
    if (!modelIds.includes(llm_model)) {
      throw new Error(`Model \`${llm_model}\` is not found!`);
    }
    
    print_lg("---- SUCCESSFULLY CREATED OPENAI CLIENT! ----");
    print_lg(`Using API URL: ${llm_api_url}`);
    print_lg(`Using Model: ${llm_model}`);
    print_lg("Check './config/secrets.ts' for more details.\n");
    print_lg("---------------------------------------------");

    return client;
  } catch (e: any) {
    ai_error_alert(`Error occurred while creating OpenAI client. ${apiCheckInstructions}`, e);
    throw e;
  }
}

// Function to close an OpenAI client
export function ai_close_openai_client(client: OpenAI): void {
  try {
    if (client) {
      print_lg("Closing OpenAI client...");
      // OpenAI client doesn't need explicit closing in Node.js
    }
  } catch (e: any) {
    ai_error_alert("Error occurred while closing OpenAI client.", e);
  }
}

// Function to get list of models available in OpenAI API
export function ai_get_models_list(client: OpenAI): Promise<any[]> {
  return new Promise(async (resolve) => {
    try {
      print_lg("Getting AI models list...");
      if (!client) throw new Error("Client is not available!");
      const models = await client.models.list();
      print_lg("Available models:");
      print_lg(models.data);
      resolve(models.data);
    } catch (e: any) {
      critical_error_log("Error occurred while getting models list!", e);
      resolve(["error", e]);
    }
  });
}

function model_supports_temperature(model_name: string): boolean {
  return ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"].includes(model_name);
}

// Reasoning models bill hidden reasoning tokens; form answers don't need deep reasoning
function is_reasoning_model(model_name: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(model_name);
}

// Function to get chat completion from OpenAI API
export async function ai_completion(
  client: OpenAI,
  messages: Array<{ role: string; content: string }>,
  response_format?: any,
  temperature: number = 0,
  stream: boolean = stream_output
): Promise<any> {
  if (!client) throw new Error("Client is not available!");

  const params: any = { model: llm_model, messages, stream };

  if (model_supports_temperature(llm_model)) {
    params.temperature = temperature;
  }
  if (llm_reasoning_effort && is_reasoning_model(llm_model)) {
    params.reasoning_effort = llm_reasoning_effort;
  }
  if (response_format && (llm_spec === "openai" || llm_spec === "openai-like")) {
    params.response_format = response_format;
  }

  const completion = await client.chat.completions.create(params);

  let result = "";
  
  if (stream) {
    print_lg("--STREAMING STARTED");
    const stream = completion as any;
    for await (const chunk of stream) {
      const chunkMessage = chunk.choices[0]?.delta?.content;
      if (chunkMessage) {
        result += chunkMessage;
        print_lg(chunkMessage);
      }
    }
    print_lg("\n--STREAMING COMPLETE");
  } else {
    result = completion.choices[0]?.message?.content || "";
  }
  
  if (response_format) {
    result = convert_to_json(result);
  }
  
  print_lg("\nAI Answer to Question:\n");
  print_lg(result);
  return result;
}

export async function ai_extract_skills(client: OpenAI, job_description: string, stream: boolean = stream_output): Promise<any> {
  print_lg("-- EXTRACTING SKILLS FROM JOB DESCRIPTION");
  try {
    const prompt = extract_skills_prompt.replace('{}', job_description);
    const messages = [{ role: "user", content: prompt }];
    return await ai_completion(client, messages, extract_skills_response_format, 0, stream);
  } catch (e: any) {
    ai_error_alert(`Error occurred while extracting skills from job description. ${apiCheckInstructions}`, e);
    throw e;
  }
}

export async function ai_answer_question(
  client: OpenAI,
  question: string,
  options: string[] | null = null,
  question_type: 'text' | 'textarea' | 'single_select' | 'multiple_select' = 'text',
  job_description?: string | null,
  about_company?: string | null,
  user_information_all?: string | null,
  stream: boolean = stream_output
): Promise<any> {
  print_lg("-- ANSWERING QUESTION using AI");
  try {
    const userInfo = user_information_all || "N/A";
    let prompt = ai_answer_prompt.replace('{}', userInfo).replace('{}', question);
    
    // Add options if provided for select questions
    if (options && (question_type === 'single_select' || question_type === 'multiple_select')) {
      const optionsStr = "OPTIONS:\n" + options.map(opt => `- ${opt}`).join("\n");
      prompt += `\n\n${optionsStr}`;
      if (question_type === 'single_select') {
        prompt += "\n\nPlease select exactly ONE option from the list above.";
      } else {
        prompt += "\n\nYou may select MULTIPLE options from the list above if appropriate.";
      }
    }
    
    if (job_description && job_description !== "Unknown") {
      prompt += `\nJob Description:\n${job_description}`;
    }
    if (about_company && about_company !== "Unknown") {
      prompt += `\nAbout the Company:\n${about_company}`;
    }

    const messages = [{ role: "user", content: prompt }];
    print_lg("Prompt we are passing to AI: ", prompt);
    const response = await ai_completion(client, messages, undefined, 0, stream);
    return response;
  } catch (e: any) {
    ai_error_alert(`Error occurred while answering question. ${apiCheckInstructions}`, e);
    throw e;
  }
}
