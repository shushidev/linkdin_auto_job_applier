import * as fs from 'fs';
import * as path from 'path';
import { ai_answer_cache_path } from '../../config/settings';
import { print_lg } from '../helpers';

/**
 * Persistent cache of AI answers to application questions.
 *
 * LinkedIn Easy Apply forms repeat the same questions across jobs ("Are you authorized to work...",
 * "How many years of experience with Node.js?"), so each distinct question only costs one AI call.
 * The cache is a plain JSON file: edit an answer there to correct it for every future application.
 */

type CacheEntry = { question: string; type: string; options: string[] | null; answer: string; uses: number };

let cache: Record<string, CacheEntry> | null = null;

function load(): Record<string, CacheEntry> {
  if (cache) return cache;
  try {
    cache = fs.existsSync(ai_answer_cache_path) ? JSON.parse(fs.readFileSync(ai_answer_cache_path, 'utf8')) : {};
  } catch (e) {
    print_lg(`Couldn't read AI answer cache at "${ai_answer_cache_path}", starting with an empty one.`, e as any);
    cache = {};
  }
  return cache!;
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(ai_answer_cache_path), { recursive: true });
    fs.writeFileSync(ai_answer_cache_path, JSON.stringify(cache, null, 2));
  } catch (e) {
    print_lg("Failed to save AI answer cache!", e as any);
  }
}

// Normalise a question so trivial differences (case, punctuation, "required" markers) share one cache entry
function normalize(text: string): string {
  return text.toLowerCase().replace(/\brequired\b/g, '').replace(/[^a-z0-9+#.]+/g, ' ').trim();
}

function make_key(question: string, type: string, options: string[] | null): string {
  const opts = options ? options.map(normalize).sort().join('|') : '';
  return `${type}::${normalize(question)}::${opts}`;
}

export function get_cached_answer(question: string, type: string, options: string[] | null): string | null {
  const entry = load()[make_key(question, type, options)];
  if (!entry) return null;
  entry.uses += 1;
  save();
  print_lg(`Using cached answer for "${question}": ${entry.answer}`);
  return entry.answer;
}

export function set_cached_answer(question: string, type: string, options: string[] | null, answer: string): void {
  load()[make_key(question, type, options)] = { question, type, options, answer, uses: 1 };
  save();
}
