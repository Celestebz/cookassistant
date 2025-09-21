import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptDir = path.join(__dirname, '../prompts');

export function withRetry(fn, maxRetries = 3) {
  return async (...args) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    throw lastError;
  };
}

export function buildStepsPrompt() {
  return fs.readFileSync(path.join(promptDir, 'steps.zh.txt'), 'utf-8');
}