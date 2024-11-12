// import "server-only";

import puppeteer, { Browser } from "puppeteer";
import { humanizeBrowser, humanizePage } from "./humanizer";
import { TScrpConfig } from "../def";
import { withRetry } from "../utils";

let browser: Browser | null = null;

export async function getNewBrowser(): Promise<TScrpConfig | null> {
  console.log("---> Launching new scrp browser procedure");

  // First, close any existing browser instance
  await closeExistingBrowser(browser);

  // Get browser args including the humanize options
  const args = await humanizeBrowser();

  if (!args) {
    console.error('-----> Failed to get browser args from humanizer');
    return null;
  }

  try {
    browser = await puppeteer.launch({
      headless: false,
      args,
    });

    if (!browser) {
      console.error('----> Browser instance is not defined');
      throw new Error('Browser instance is not defined');
    }

    const page = await browser.newPage();

    if (!page) {
      console.error('----> Page instance is not defined');
      throw new Error('Page instance is not defined');
    }

    // Humanize page
    console.log("----> Humanizing scrp browser PAGE instance initiated ...");
    try {
      await humanizePage(page);
    } catch (error) {
      console.error('------> Error humanizing the page:', error);
      throw new Error('Failed to humanize page');
    }

    // Inject script to override sendBeacon
    await page.evaluateOnNewDocument(() => {
      const originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function (url, data) {
        if (!url) {
          console.error('sendBeacon called without a URL');
          return false;
        }
        return originalSendBeacon.call(this, url, data);
      };
    });

    // Error handling for page crashes
    page.on('error', error => {
      throw new Error(`Opening new page crashed: ${error.message}`);
    });

    page.on('pageerror', async (error) => {
      console.error(`------> Opening new page error: ${error.message}`);
      // Implement retry logic here
      for (let i = 0; i < 3; i++) {
        try {
          await page.reload({ waitUntil: 'networkidle0' });
          console.log('Page reloaded successfully');
          return;
        } catch (reloadError) {
          if (reloadError instanceof Error) {
            console.error(`Retry ${i + 1} failed: ${reloadError.message}`);
          } else {
            console.error(`Retry ${i + 1} failed: ${String(reloadError)}`);
          }
        }
      }
      throw new Error(`Failed to load page after 3 retries: ${error.message}`);
    });


    // Implement request retries by enabling request interception in scenarios where requests might fail due to temporary issues,
    // such as: Network connectivity problems, Server overload or Rate limiting
    const requestRetries = 3;
    try {
      await page.setRequestInterception(true);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Request interception is already enabled')) {
        console.warn('------> Request interception is already active');
      } else {
        // If it's a different error, re-throw it
        throw error;
      }
    }

    page.on('request', async (request) => {
      const resourceType = request.resourceType();

      // Block requests for images, fonts, and stylesheets
      if (['image', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort();
      } else {
        try {
          await withRetry(async () => {
            await request.continue();
          }, requestRetries, 5000, "Get new browser Request");
        } catch (error) {
          console.error(`-----> Failed to process request after ${requestRetries} retries:`, error);
          request.abort();
        }
      }
    });


    // Enhanced response handling with specific error types
    page.on('response', async (response) => {
      const status = response.status();

      if (status >= 300 && status < 400) {
        throw new Error(`Redirect: ${response.url()}`);
      } else if (status === 403) {
        throw new Error('Access Forbidden: Possible IP ban or rate limiting');
      } else if (status === 429) {
        throw new Error('Too Many Requests: Rate limit exceeded');
      } else if (status === 401) {
        throw new Error('Unauthorized: Authentication failed');
      } else if (status >= 500) {
        throw new Error(`Server Error (${status}): Target site experiencing issues`);
      }
    });

    console.log("-> New browser and page created. <----------------------------------");
    return { browser, page };

  } catch (error) {
    // Ensure browser is closed in case of error
    if (browser) {
      await browser.close();
    }

    if (error instanceof Error) {
      // Enhanced error classification
      let errorType = 'UnknownError';
      if (error.message.includes('Access Forbidden')) {
        errorType = 'AccessDeniedError';
      } else if (error.message.includes('Too Many Requests')) {
        errorType = 'RateLimitError';
      } else if (error.message.includes('Unauthorized')) {
        errorType = 'AuthenticationError';
      } else if (error.message.includes('Server Error')) {
        errorType = 'ServerError';
      } else if (error.message.includes('net::')) {
        errorType = 'NetworkError';
      } else if (error.message.includes('timeout')) {
        errorType = 'TimeoutError';
      } else if (error.message.includes('Protocol error')) {
        errorType = 'ProtocolError';
      }

      console.error(`--> Scraping error: type: ${errorType}, message: ${error.message}`);
    }

    return null;
  }
}

export async function closeExistingBrowser(browser: Browser | null) {
  if (browser) {
    try {
      await browser.close();
      console.log('Existing browser instance closed.');
      browser = null;
    } catch (error) {
      console.error('Error closing existing browser:', error);
    }
  }
}