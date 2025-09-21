export async function withRetry(fn, { retries = 1, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) { lastErr = err; }
    if (i < retries) await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
  }
  throw lastErr;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptDir = path.join(__dirname, '../prompts');

export function buildStepsPrompt() {
  return fs.readFileSync(path.join(promptDir, 'steps.zh.txt'), 'utf-8');
}

export function buildFlatlayPrompt() {
  return fs.readFileSync(path.join(promptDir, 'flatlay.zh.txt'), 'utf-8');
}


