/*
  Crawler server action ------------------------------------------------------------------------------------->
   - receives root URL (hostname, regular url, or subdomain) from the client side useActionState hook
   - use puppeteer scrp helper functions to index the site pages
   - holds the all indexing config and logic (urls to be indexed, indexing depth, etc, etc)
   - handles the indexing errors and consistency (retry logic, timeout logic, etc)
   - persist scrp data to the database (client site table)
   - return the indexing status to the client of type TCrawler - { success: boolean, message: string }
*/

"use server";

import { TCrawlQueue, TCrawlResults, TScrpPageResponse } from "@/lib/def";
import { scrpPage } from "@/lib/scrp/scrpPage";
import { isValidUrl, withRetry } from "@/lib/utils";
import { pages } from "next/dist/build/templates/app-page";
import * as fs from 'fs';

const MAX_CRAWLER_DEPTH = 2;  // How many levels deep should the crawler got going backwards from the root url to zero
const CONCURRENCY_LIMIT = 5; // How many pages can be processed concurrently at a time (to reduce load on the server)
const PAGES_LIMIT = 1; // How many pages can be indexed in total

export async function crawler(prevState: unknown, formData: FormData) {

  let pagesScraped = 0;

  // Get the root url from the client side useActionState hook
  const rootUrl = formData.get("rootUrl") as string;

  // test url
  // rootUrl = "https://books.toscrape.com/";
  // // rootUrl = "https://bookingready.com/";
  // // rootUrl = "https://readsomnia.com/";
  // rootUrl = "https://relativityspace.com/";
  // rootUrl = "https://www.fictiv.com/";


  // Validate the url
  if (!isValidUrl(rootUrl)) {
    return {
      success: false,
      message: "Invalid URL provided. Please check and try again.",
    }
  }

  console.log("-------------> Starting indexing Site: ", rootUrl, "<-------------");

  // Implement the indexing logic including site url iteration, retry logic, timeout logic, etc

  const crawlQueue: TCrawlQueue[] = []; // Queue of URLs to be crawled
  const visitedUrls = new Set(); // Track visited URLs, using Set to ensure uniqueness
  const crawlResults: TCrawlResults[] = []; // Store results

  // Initialize the crawl with the starting URL
  crawlQueue.push({ url: rootUrl, depth: MAX_CRAWLER_DEPTH });

  // Run the crawler and return the indexing status to the client of type TCrawler - { success: boolean, message: string }
  try {
    const results = await runCrawlerConcurrently();
    console.log('===============> Site Crawling completed:', results, '<===============');
    return { success: true, message: 'Site Crawling completed successfully' };
  } catch (error) {
    console.error('Crawler error:', error);
    return { success: false, message: 'Crawler error, please try again or contact support' };
  }


  async function crawl(url: string, depth: number): Promise<void> {

    // Ensure URL has not been visited and is within depth limit (depth is calculated from the root url to zero)
    if (visitedUrls.has(url) || depth <= 0 || pagesScraped >= PAGES_LIMIT) return;
    visitedUrls.add(url);

    console.log(`------> Crawling ${url} at depth ${depth}`);

    try {
      // Use scrpPage(url, [browser], [page]) - the puppeteer scrp helper functions to index the site pages
      // If the browser is not provided, create a new browser instance
      const scrpPageResult: TScrpPageResponse | null = await withRetry(async () => {
        console.log(`-------> Attempting to scrape ${url}`);
        return await scrpPage(url);
      }, 5, 10000, `scrpPage ${url}`);

      if (!scrpPageResult) {
        throw new Error(`Error scraping the page:  ${url}`);
      }

      // const { page, browser, title, content, links } = scrpPageResult;
      const { links } = scrpPageResult;

      // Increment the counter when a page is scraped
      pagesScraped++;

      console.log(`------> Successfully scraped ${url}. Found ${links.length} links.`);

      // save the scrpPageResult.content to scrp.txt file
      const { content } = scrpPageResult;
      fs.writeFileSync('scrp.txt', content);


      console.log('scrpPageResult: ', scrpPageResult);
      return;

      // Sanitize the content and store it in the database
      // await sanitizeAndStoreData({ url, title, content });

      crawlResults.push({ url, depth, success: true, links });

      // Add links to the queue if they haven't been visited
      for (const link of links) {
        if (!visitedUrls.has(link)) {
          crawlQueue.push({ url: link, depth: depth - 1 });
        }
      }
    } catch (error: unknown) {
      console.error(`Error crawling ${url}:`, error);
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      }
      crawlResults.push({ url, depth, success: false, links: [] });
    }
  }


  async function runCrawlerConcurrently() {
    try {
      const workerPool = Array(CONCURRENCY_LIMIT).fill(null).map(async () => {
        while (crawlQueue.length > 0) {
          const { url, depth } = crawlQueue.shift() as TCrawlQueue;
          try {
            await crawl(url, depth);
          } catch (error) {
            console.error(`Error in worker processing ${url}:`, error);
            // You might want to add the URL back to the queue or handle the error differently
          }
        }
      });

      // Wait for all workers to complete
      await Promise.allSettled(workerPool);
      return crawlResults;
    } catch (error) {
      console.error('Error in runCrawlerConcurrently:', error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  // async function sanitizeAndStoreData({ url, title, content }: { url: string, title: string, content: string }) {
  //   const sanitizedContent = sanitizeContent(content);
  //   await storePageData({ url, title, content: sanitizedContent });
  // }
}