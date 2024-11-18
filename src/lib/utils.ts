import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const randomDelayGenerate = (min = 2000, max = 5000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};


// wait function - ms
export function wait(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

// random wait - ms
export function randomWait(minTime: number, maxTime: number): Promise<void> {
  const randomTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => {
    setTimeout(resolve, randomTime);
  });
}


// Url validation function
export function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    // Fallback to regex validation for edge cases
    const regex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!$&'()*+,;=]+$/;
    return regex.test(url);
  }
}

export function setAbsolutePath(path: string) {
  let rootPath = process.cwd();
  rootPath = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  const relativePath = path.startsWith('/') ? path.slice(1) : path;

  return `${rootPath}${relativePath}`
}

// Strip HTML function
export function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Remove extra whitespace while preserving line breaks
  text = text.replace(/[ \t]+/g, ' ');  // Replace multiple spaces or tabs with a single space
  text = text.replace(/^[ \t]+|[ \t]+$/gm, '');  // Trim start and end of each line

  // Replace multiple line breaks with a single line break
  text = text.replace(/\n\s*\n/g, '\n');

  return text.trim();  // Trim the entire string
}


// Retry wrapper function
export async function withRetry<T>(
  operation: (attempt?: number) => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 5000,
  title?: string
): Promise<T | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: unknown) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const backoffDelay = delayMs * Math.pow(2, attempt - 1);
      console.log(`-------> Attempt ${attempt} for ${title} failed. Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  console.log(`-------> Operation failed for ${title} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  return null;
}


// Rate Limiter function that tracks requests and enforces delays between them.
const REQUEST_LIMIT = 5;  // Max number of requests in a window
const TIME_WINDOW = 10000; // Time window in milliseconds (e.g., 10 seconds)
let requestCount = 0;
let lastRequestTime = Date.now();

export async function rateLimit() {
  if (requestCount >= REQUEST_LIMIT) {
    const now = Date.now();
    const timeElapsed = now - lastRequestTime;

    if (timeElapsed < TIME_WINDOW) {
      const waitTime = TIME_WINDOW - timeElapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    // Reset the request counter and update the last request time
    requestCount = 0;
    lastRequestTime = Date.now();
  }
  requestCount++;
}