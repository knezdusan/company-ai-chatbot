import fs from 'fs/promises';
import { Page, Protocol } from 'puppeteer';
import { setAbsolutePath } from '../utils';
import path from 'path';

type SessionData = {
  cookies: Protocol.Network.CookieParam[];
  localStorage: Record<string, string>;
};

function getScrpSessionPath(url: string) { return setAbsolutePath(`/src/data/sessions/session_${encodeURIComponent(url)}.json`) };

export async function saveSession(url: string, sessionData: SessionData): Promise<void> {
  const filePath = getScrpSessionPath(url);

  try {
    // Ensure the directory exists, creating it if necessary
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write session data to the file
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
    console.log(`---> Session successfully saved to file: ${filePath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`----> Error saving session to file ${filePath}: ${errorMessage}`);
    throw new Error(`Error saving session to file ${filePath}: ${errorMessage}`);
  }
}

async function loadSession(url: string): Promise<SessionData | null> {
  const filePath = getScrpSessionPath(url);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return null;
    } else {
      throw error;
    }
  }
}

export async function setupRemoteSession(url: string, page: Page) {
  console.log('----> Setting up the remote session on the ' + url);
  try {
    const sessionData = await loadSession(url);
    if (sessionData) {
      try {
        await page.setCookie(...sessionData.cookies.map(cookie => ({
          ...cookie,
          partitionKey: typeof cookie.partitionKey === 'string' ? cookie.partitionKey : undefined,
        })));
      } catch (cookieError: unknown) {
        if (cookieError instanceof Error) {
          console.error(`----> Error setting cookies: ${cookieError.message}`);
        } else {
          console.error(`----> Unknown error setting cookies: ${cookieError}`);
        }
      }
      try {
        await page.evaluate((storedData) => {
          for (const [key, value] of Object.entries(storedData)) {
            localStorage.setItem(key, value);
          }
        }, sessionData.localStorage);
      } catch (localStorageError: unknown) {
        if (localStorageError instanceof Error) {
          console.error(`------> Error setting localStorage: ${localStorageError.message}`);
        } else {
          console.error(`------> Unknown error setting localStorage: ${localStorageError}`);
        }
      }
    }

    console.log('----> Remote session setup successfully');
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error setting up remote session: ${error.message}`);
    } else {
      console.error(`Unknown error setting up remote session: ${error}`);
    }
    throw new Error('Error setting up remote session');
  }
}


export async function setupLocalSession(url: string, page: Page): Promise<void> {
  console.log('----> Setting up local/server session...');

  try {
    // Retrieve and format cookies from the page
    const cookies = await page.cookies();
    const cookieParams = cookies.map(cookie => ({
      ...cookie,
      partitionKey: typeof cookie.partitionKey === 'string' ? cookie.partitionKey : undefined,
    }));

    if (cookies.length === 0) {
      console.warn('-----> No cookies found on the remote page');
    }

    // Retrieve local storage data from the page
    const localStorageData = await page.evaluate(() => {
      return Object.fromEntries(Object.entries(localStorage).map(([key, value]) => [key, value.toString()]));
    });

    if (Object.keys(localStorageData).length === 0) {
      console.warn('-----> No local storage data found on remote page');
    }

    // Construct session data
    const sessionData: SessionData = {
      cookies: cookieParams as Protocol.Network.CookieParam[],
      localStorage: localStorageData,
    };

    // Save session data for reuse in future sessions
    await saveSession(url, sessionData);
    console.log('---> Local session setup complete.');



  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`-----> Error setting up local session: ${errorMessage}`);
    throw new Error(`Error setting up local session: ${errorMessage}`);
  }
}