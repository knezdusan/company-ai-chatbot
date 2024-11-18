/*
  indexPage(url, scrpShuffle) - index a single page using puppeteer ------------------------------------------------------------>
  - Setup a Puppeteer browser instance
  - Navigate to the page
*/

import "server-only";

import { randomWait, rateLimit } from "../utils";
import { getNewBrowser } from "./getNewBrowser";
import { Browser, Page } from "puppeteer";
import { TScrpPageResponse } from "../def";
import { simulateHumanMouse, simulateNaturalScroll } from "./humanizer";
import { setupLocalSession, setupRemoteSession } from "./session";
import { getLinks } from "./getLinks";


export async function scrpPage(url: string, browser?: Browser, page?: Page): Promise<TScrpPageResponse | null> {
  console.log("->  Indexing Page: ", url);

  try {
    // If there is no browser instance, create a new browser and return it with the page {page: Page, browser: Browser}, or return null on error
    if (!browser) {
      const newBrowserAndPage = await getNewBrowser();
      if (!newBrowserAndPage) {
        console.error('Failed to create new browser instance');
        throw new Error('Error creating new browser instance');
      }

      try {
        browser = newBrowserAndPage.browser;
        page = newBrowserAndPage.page;
      } catch (err) {
        console.error('Error assigning browser or page:', err);
        throw err;
      }
    }

    if (!page) {
      throw new Error('Page is not defined');
    }

    // Got to the page
    await simulateHumanMouse(page);
    const pageLoadTimeout = 60000;
    try {
      // Rate Limiter - tracks requests and enforces delays between them.
      await rateLimit();

      try {

        await page.goto(url, {
          waitUntil: ['networkidle2', 'domcontentloaded'], // Ensure that the page is fully loaded before Puppeteer continues.
          timeout: pageLoadTimeout // Set a timeout to avoid hanging requests
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.name === 'TimeoutError') {
            throw new Error(`-----> Timeout error: Failed to load ${url} within ${pageLoadTimeout} seconds`);
          } else {
            throw new Error(`-----> Error loading ${url}: ${error.message}`);
          }
        } else {
          throw new Error(`-----> Unknown error loading ${url}`);
        }
      }

      await page.waitForSelector('body'); // Wait for the page to load

      console.log('----> Successfully loaded page: ' + url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          throw new Error(`-----> Timeout error: Failed to load ${url} within ${pageLoadTimeout} seconds`);
        } else {
          throw new Error(`-----> Error loading ${url}: ${error.message}`);
        }
      } else {
        throw new Error(`-----> Unknown error loading ${url}`);
      }
    }

    // Setup a remote session for the page
    await setupRemoteSession(url, page);

    // Simulate natural scrolling
    await simulateNaturalScroll(page);

    // Random wait after page load
    await randomWait(3000, 6000);

    const pageTitle = await page.title();
    const pageBodyContent = await page.$eval('body', (body) => body.innerHTML);

    // Check if pageBodyContent string contains the string REQUEST_METHOD
    if (pageBodyContent && pageBodyContent.includes('REQUEST_METHOD')) {
      console.log('-----> Invalid proxy detected - page returns HTTTP request headers instead of HTML');
      throw new Error('----> Invalid proxy detected');
    }

    // Check if the page is valid, if it has title, body content, and links
    if (!pageTitle || pageTitle.trim().length === 0 || !pageBodyContent || pageBodyContent.trim().length === 0) {
      console.error('-----> Page title, body content, or links are missing');
      throw new Error('Page title, body content, or links are missing');
    }

    // Extract all links
    const allLinks = await getLinks(page);
    console.log('-----> Found links:', allLinks);

    // Setup a local server session based on the remote session
    await setupLocalSession(url, page);

    const pageData = {
      url,
      title: pageTitle,
      content: pageBodyContent,
      links: allLinks,
    }

    const pageScrpResponse: TScrpPageResponse = {
      ...pageData,
      browser,
      page,
    }

    console.log('data ----------------------> ' + pageScrpResponse.title);
    return pageScrpResponse;

  } catch (error) {
    // await browser.close();
    console.log(`----> An error occurred while scraping the page. ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
