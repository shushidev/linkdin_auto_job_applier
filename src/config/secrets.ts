
import * as dotenv from 'dotenv';
dotenv.config();

// Login Credentials for LinkedIn (Optional)
export const username = process.env.LINKEDIN_USERNAME || "";       // Enter your username in the quotes
export const password = process.env.LINKEDIN_PASSWORD || "";           // Enter your password in the quotes

// Use AI
export const use_AI = process.env.USE_AI === "true";                          // True or False, Note: True or False are case-sensitive
/**
 * Note: Set it as True only if you want to use AI, and If you either have a
 * 1. Local LLM model running on your local machine, with it's APIs exposed. Example softwares to achieve it are:
 *     a. Ollama - https://ollama.com/
 *     b. llama.cpp
 *     c. LM Studio - https://lmstudio.ai/ (Recommended)
 *     d. Jan - https://jan.ai/
 * 2. OR you have a valid OpenAI API Key, and money to spare, and you don't mind spending it.
 * CHECK THE OPENAI API PIRCES AT THEIR WEBSITE (https://openai.com/api/pricing/). 
 */

// Select AI Provider
export const ai_provider = process.env.AI_PROVIDER || "openai";               // "openai", "deepseek", "gemini"
/**
 * Note: Select your AI provider.
 * * "openai" - OpenAI API (GPT models) OR OpenAi-compatible APIs (like Ollama)
 * * "deepseek" - DeepSeek API (DeepSeek models)
 * * "gemini" - Google Gemini API (Gemini models)
 * * For any other models, keep it as "openai" if it is compatible with OpenAI's api.
 */

// Your LLM url or other AI api url and port
export const llm_api_url = process.env.LLM_API_URL || "https://api.openai.com/v1/";       // Examples: "https://api.openai.com/v1/", "http://127.0.0.1:1234/v1/", "http://localhost:1234/v1/", "https://api.deepseek.com", "https://api.deepseek.com/v1"
/**
 * Note: Don't forget to add / at the end of your url. You may not need this if you are using Gemini.
 */

// Your LLM API key or other AI API key 
export const llm_api_key = process.env.LLM_API_KEY || "not-needed";              // Enter your API key in the quotes, make sure it's valid, if not will result in error.
/**
 * Note: Leave it empty as "" or "not-needed" if not needed. Else will result in error!
 * If you are using ollama, you MUST put "not-needed".
 */

// Your LLM model name or other AI model name
export const llm_model = process.env.LLM_MODEL || "gpt-5-mini";          // Examples: "gpt-3.5-turbo", "gpt-4o", "llama-3.2-3b-instruct", "qwen3:latest", "gemini-pro", "gemini-1.5-flash", "gemini-2.5-flash", "deepseek-llm:latest"

export const llm_spec = process.env.LLM_SPEC || "openai";                // Examples: "openai", "openai-like", "openai-like-github", "openai-like-mistral"
/**
 * Note: Currently "openai", "deepseek", "gemini" and "openai-like" api endpoints are supported.
 * Most LLMs are compatible with openai, so keeping it as "openai-like" will work.
 */

// Do you want to stream AI output?
export const stream_output = process.env.STREAM_OUTPUT === "true";                    // Examples: True or False. (False is recommended for performance, True is recommended for user experience!)
/**
 * Set `stream_output = True` if you want to stream AI output or `stream_output = False` if not.
 */

// Reasoning effort for reasoning models (gpt-5*, o1/o3/o4*). Lower = fewer hidden reasoning tokens = cheaper.
export const llm_reasoning_effort = process.env.LLM_REASONING_EFFORT || "low";      // "low", "medium", "high" or "" to use the model default
