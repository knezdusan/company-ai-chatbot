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

import { TCrawlQueue, TCrawlResults, TScrpPageData, TScrpPageResponse } from "@/lib/def";
import { scrpPage } from "@/lib/scrp/scrpPage";
import { isValidUrl, withRetry } from "@/lib/utils";
import { convert } from "html-to-text";
import { createClient } from "@/supabase/server";
import { verifyAuthSession } from "@/auth/session";
// import * as fs from 'fs';

const MAX_CRAWLER_DEPTH = 2;  // How many levels deep should the crawler got going backwards from the root url to zero
const CONCURRENCY_LIMIT = 5; // How many pages can be processed concurrently at a time (to reduce load on the server)
const PAGES_LIMIT = 10; // How many pages can be indexed in total

export async function crawler(prevState: unknown, formData: FormData) {

  const authSession = await verifyAuthSession();
  if (!authSession) {
    console.error("Could not authorize user");
    return {
      success: false,
      message: "Could not authorize user",
    }
  }

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

      const { title, description, content, links } = scrpPageResult;

      // Increment the counter when a page is scraped
      pagesScraped++;

      console.log(`------> Successfully scraped ${url}.`);

      // save the scrpPageResult.content to scrp.txt file
      // fs.writeFileSync('scrp.txt', content);

      // Sanitize the content and store it in the database

      try {
        await sanitizeAndStoreData({ url, title, description, content, depth, links });
      } catch (error) {
        console.error('------> Error storing data:', error instanceof Error ? error.message : String(error));
        throw new Error('------> Error storing data:');
      }

      crawlResults.push({ url, depth, success: true, links: links ?? [] });

      // Add links to the queue if they haven't been visited
      if (!links) return;
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

  async function sanitizeAndStoreData({ url, title, description, content, links, depth }: TScrpPageData) {

    // Convert content to plain text using the html-to-text library
    const sanitizedContent = convert(content);

    // Convert the links array to the csv format
    const linksCsv = links && links.join(',');

    // create supabase server client
    const supabaseClient = createClient();

    // Check if the url already exists in the database to determine if we should insert or update
    try {
      const { data: paths, error: pathsError } = await supabaseClient
        .from("sites")
        .select()
        // Filters
        .eq("path", url);

      if (pathsError) {
        throw new Error(`Error checking for existing paths for url: ${url}: ${pathsError.message}`);
      }

      if (paths && paths.length > 0) {
        // Update the existing path
        const { error: updateError } = await supabaseClient
          .from("sites")
          .update({ client_id: authSession?.clientId, path: url, title, description, content: sanitizedContent, links: linksCsv, level: depth })
          .eq("path", url);

        if (updateError) {
          throw new Error(`Error updating new data for path for url: ${url}: ${updateError.message}`);
        }
      }
      else {
        // Insert the new path
        const { error: insertError } = await supabaseClient
          .from("sites")
          .insert({ client_id: authSession?.clientId, path: url, title, description, content: sanitizedContent, links: linksCsv, level: depth });

        if (insertError) {
          throw new Error(`Error inserting new data for path for url: ${url}: ${insertError.message}`);
        }
      }

    }
    catch (error) {
      console.error(`-----> Error checking for existing paths for url: ${url}:`, error);
      throw new Error(`Error checking for existing paths for url: ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}