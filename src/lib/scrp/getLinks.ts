import { Page } from 'puppeteer';

/**
 * Captures all links on a page, including HTML href links, onclick events, and redirects
 * @param page Puppeteer Page object
 * @returns Promise<string[]> Array of unique URLs found
 */
export async function getLinks(page: Page, options = {
  includeExternalLinks: false,
  baseUrlOnly: true,
  excludePatterns: getDefaultPatterns() as string[]
}): Promise<string[]> {
  console.log('----> Capturing all links on the page');


  // Track all found URLs
  const allUrls = new Set<string>();

  // // Listen for all requests and navigation events
  // page.on('request', request => {
  //   console.log(`------> Requested URL: ${request.url()}`);
  //   const url = request.url();
  //   if (url !== 'about:blank') {
  //     allUrls.add(url);
  //   }
  //   request.continue();
  // });

  // Extract links from the page content
  const links = await page.evaluate(() => {
    const urls: string[] = [];

    // Get all href links
    document.querySelectorAll('a[href]').forEach(element => {
      const href = element.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        urls.push(href);
      }
    });

    // Get all onclick links
    document.querySelectorAll('[onclick]').forEach(element => {
      const onclick = element.getAttribute('onclick');
      if (onclick) {
        // Extract URLs from onclick handlers using common patterns
        const patterns = [
          /window\.location\.href\s*=\s*['"]([^'"]+)['"]/,
          /location\.href\s*=\s*['"]([^'"]+)['"]/,
          /window\.location\s*=\s*['"]([^'"]+)['"]/,
          /window\.open\(['"]([^'"]+)['"]/
        ];

        patterns.forEach(pattern => {
          const match = onclick.match(pattern);
          if (match && match[1]) {
            urls.push(match[1]);
          }
        });
      }
    });

    // Get form action URLs
    document.querySelectorAll('form[action]').forEach(element => {
      const action = element.getAttribute('action');
      if (action) {
        urls.push(action);
      }
    });

    return urls;
  });

  // Add all found links to our set
  links.forEach(url => allUrls.add(url));

  // Convert relative URLs to absolute
  const baseUrl = page.url();
  const absoluteUrls = Array.from(allUrls).map(url => {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  });

  // Remove duplicates and invalid URLs
  const validUrls = [...new Set(absoluteUrls)].filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });

  // Parse options and filter for external urls, base only (same hostname), or pattern like /blog/
  const urlList = validUrls.filter(url => {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(page.url());

    if (!options.includeExternalLinks && urlObj.hostname !== baseUrlObj.hostname) {
      return false;
    }

    if (options.baseUrlOnly && !url.startsWith(baseUrlObj.origin)) {
      return false;
    }

    if (options.excludePatterns.some(pattern => url.includes(pattern))) {
      return false;
    }

    // Filter out URLs that end with a file extension pattern (e.g., /path/to/file.ext)
    const isLikelyFile = /\.[\w\d]+$/.test(urlObj.pathname);
    if (isLikelyFile) {
      return false;
    }

    return true;
  });

  return urlList;
}


function getDefaultPatterns() {
  return [
    '/login',
    '/logout',
    '/register',
    '/signup',
    '/admin',
    '/dashboard',
    '/api/',
    '/wp-admin',
    '/wp-login.php',
    '/tag/',
    '/category/',
    '/author/',
    '/search',
    '/robots.txt',
    '/atom',
    '/comments',
    '/forum',
    '/cart',
    '/checkout',
    '/account',
    '/settings',
    '/unsubscribe',
    '/404',
    '/error',
    '/maintenance',
    '/ads/',
    '/sponsored/',
    '/favicon.ico',
    '.pdf',
    '.jpg',
    '.png',
    '.gif',
    '.css',
    '.js',
    '/archive/',
    '/archives/',
    '/blog/',
    '/blogs/',
    '/calendar/',
    '/compare/',
    '/forgot-password/',
    '/help/',
    '/my-account/',
    '/newsletter/',
    '/order/',
    '/orders/',
    '/password-recovery/',
    '/payment/',
    '/payments/',
    '/recover-password/',
    '/reset-password/',
    '/sitemap.xml',
    '/thank-you/',
    '/wishlist/',
    '/xmlsitemap/'
  ];
}