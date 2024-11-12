/*
  Humanize page indexer to prevent boot detection
*/

import { Page } from "puppeteer";
import { randomDelayGenerate } from "../utils";
import UserAgent from "user-agents";
import { getRandomProxy } from "./proxy";


export async function humanizeBrowser() {
  console.log("----> Humanizing scrp browser instance initiated ...");

  // ----------------------------> Generate a random viewport args array:
  const defaultViewportArgs = getRandomViewportArgs();

  // ----------------------------> Generate a random user agent for the session
  let userAgent = new UserAgent().toString();
  // userAgent fallback
  if (!userAgent) {
    const possibleUserAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:53.0) Gecko/20100101 Firefox/53.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.75 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:53.0) Gecko/20100101 Firefox/53.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.75 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64; rv:53.0) Gecko/20100101 Firefox/53.0",
    ]
    userAgent = possibleUserAgents[Math.floor(Math.random() * possibleUserAgents.length)];
  }
  console.log("-----> Random User Agent generated: " + userAgent);

  // ----------------------------> Get random proxy
  const proxy = await getRandomProxy();
  if (!proxy) {
    console.error('------> Failed to get random proxy');
    return null;
  }

  const proxyArgs = proxy ?
    `--proxy-server=${proxy.proxy_address}:${proxy.port}` +
    (proxy.username && proxy.password ?
      `--proxy-auth=${proxy.username}:${proxy.password}` : '') : '';

  console.log("-----> Random Proxy generated: " + proxyArgs);

  // Humanize browser args
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-infobars',
    '--disable-web-security',
    '--disable-webgl',
    '--disable-webrtc',
    '--lang=en-US,en;q=0.9',
    '--disable-blink-features=AutomationControlled',
    '--disable-extensions',
    '--window-size=1920,1080',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pings',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--force-color-profile=srgb',
    '--blink-settings=animation_duration_factor=1000,animation_time_to=0.1',
    '--blink-settings=animate_visual_properties=0,duration_to_time_ratio=0.5',
    '--disable-site-isolation-trials',
    '--disable-dual-entitlements',
    '--disable-media-restrictions',
    '--disable-site-per-process',
    '--disable-speech-api',
    '--renderer-process-limit=1',
    '--shared-workers-max-code-size-unlimited',
    '--shared-workers-max-string-size-unlimited',
    ...defaultViewportArgs,
    // proxyArgs,
    `--geolocation=${proxy?.geolocation}`,
    `--lang=${proxy?.geolocation || 'en-US'}`,
    `--user-agent=${userAgent}`,
    '--extra-http-headers=' + JSON.stringify(getRandomHeaders()),
  ];

  return args;
}


// Page --------------------------->

export async function humanizePage(page: Page) {
  try {
    await page.evaluateOnNewDocument(() => {

      // Enhance WebGL fingerprinting evasion
      overrideWebGLParameters();

      // Enhance canvas fingerprint protection
      overrideCanvasMethods();

      // Override navigator properties
      overrideNavigatorProperties();


      // ---------> Helper functions

      function overrideWebGLParameters() {
        try {
          const originalGetParameter = WebGLRenderingContext.prototype.getParameter;

          if (typeof WebGLRenderingContext === 'undefined') {
            console.warn('------> WebGL is not supported in this environment');
            return;
          }

          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) {
            console.warn('------> Unable to initialize WebGL. Your browser may not support it.');
            return;
          }

          WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
            try {
              const WEBGL_OVERRIDES: Record<number, string | number> = {
                37445: 'NVIDIA GeForce RTX 3060 Ti/PCIe/SSE2', // UNMASKED_RENDERER_WEBGL
                37446: 'Google Inc. (NVIDIA)', // UNMASKED_VENDOR_WEBGL
                34047: 16384, // MAX_TEXTURE_SIZE
                34076: 16384, // MAX_RENDERBUFFER_SIZE
                36349: 1024,  // MAX_VERTEX_UNIFORM_VECTORS
              };

              return WEBGL_OVERRIDES[parameter] ?? originalGetParameter.call(this, parameter);
            } catch (error) {
              console.error('------> Error in overridden getParameter:', error instanceof Error ? error.message : String(error));
              return originalGetParameter.call(this, parameter); // Fallback to the original if there's an error
            }
          };

          console.log('-----> overrideWebGLParameters page humanizing done.');
        } catch (error) {
          console.error('------> Error setting up WebGL parameter overrides:', error instanceof Error ? error.message : String(error));
        }
      }


      function overrideCanvasMethods() {
        try {
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

          const addNoise = (data: Uint8ClampedArray) => {
            const noise = () => Math.floor(Math.random() * 2);
            for (let i = 0; i < data.length; i += 4) {
              data[i] = clampValue(data[i] + noise());
              data[i + 1] = clampValue(data[i + 1] + noise());
              data[i + 2] = clampValue(data[i + 2] + noise());
            }
            return data;
          };

          HTMLCanvasElement.prototype.toDataURL = function (...args: Parameters<typeof originalToDataURL>) {
            try {
              const context = this.getContext('2d');
              if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                addNoise(imageData.data);
                context.putImageData(imageData, 0, 0);
              }
              return originalToDataURL.apply(this, args);
            } catch (error) {
              console.error('------> Error in overridden toDataURL:', error instanceof Error ? error.message : String(error));
              return originalToDataURL.apply(this, args); // Fallback to the original if there's an error
            }
          };

          CanvasRenderingContext2D.prototype.getImageData = function (...args: Parameters<typeof originalGetImageData>) {
            try {
              const imageData = originalGetImageData.apply(this, args);
              addNoise(imageData.data);
              return imageData;
            } catch (error) {
              console.error('------> Error in overridden getImageData:', error instanceof Error ? error.message : String(error));
              return originalGetImageData.apply(this, args); // Fallback to the original if there's an error
            }
          };

          console.log('-----> Canvas method overrides page humanizing done.');
        } catch (error) {
          console.error('------> Error setting up canvas method overrides:', error instanceof Error ? error.message : String(error));
        }
      }


      function clampValue(value: number): number {
        return Math.max(0, Math.min(255, value));
      }

      function overrideNavigatorProperties() {
        try {
          const navigatorProps: Record<string, unknown> = {
            webdriver: undefined,
            hardwareConcurrency: 8,
            deviceMemory: 8,
            platform: 'Win32',
            languages: ['en-US', 'en'],
            maxTouchPoints: 0,
            bluetooth: { getAvailability: async () => true },
          };

          Object.entries(navigatorProps).forEach(([key, value]) => {
            try {
              if (!(key in Navigator.prototype)) {
                Object.defineProperty(navigator, key, { get: () => value });
              }
            } catch (error) {
              console.error(`------> Error defining property ${key} on navigator:`, error instanceof Error ? error.message : String(error));
            }
          });

          console.log('-----> Navigation property overrides page humanizer done.');
        } catch (error) {
          console.error('------> Error setting up navigator property overrides:', error instanceof Error ? error.message : String(error));
        }
      }

    });
  } catch (error) {
    console.error('-----> Error during humanization of the page:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to humanize page', error as Error);
  }

  return page;
}

// Helpers functions ------------------------------------------------------------------------------------------>

// Browser -------------------------->

// Helper function to get a random viewport
function getRandomViewportArgs(): string[] {
  const widths = [1366, 1440, 1536, 1920, 2560];
  const heights = [768, 900, 1024, 1080, 1440];

  const width = widths[Math.floor(Math.random() * widths.length)];
  const height = heights[Math.floor(Math.random() * heights.length)];
  const deviceScaleFactor = Math.random() < 0.5 ? 1 : 2;
  const isMobile = Math.random() < 0.2;

  return [
    `--window-size=${width},${height}`,
    `--device-scale-factor=${deviceScaleFactor}`,
    isMobile ? '--mobile' : '--desktop',
  ];
}

// randomizes the HTTP header values for the --extra-http-headers argument in the Puppeteer launch options:
export function getRandomHeaders() {
  const acceptLanguages = ['en-US,en;q=0.9', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9', 'es-ES,es;q=0.9'];
  const acceptEncodings = ['gzip, deflate, br', 'identity, *'];
  const acceptTypes = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'application/json, text/plain, */*'
  ];
  const connections = ['keep-alive', 'close'];
  const secFetchSites = ['none', 'same-origin', 'cross-site'];
  const secFetchModes = ['navigate', 'cors', 'no-cors'];
  const secFetchUsers = ['?1', '?0'];
  const secFetchDests = ['document', 'empty', 'image', 'script'];

  return {
    'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    'Accept-Encoding': acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)],
    'Accept': acceptTypes[Math.floor(Math.random() * acceptTypes.length)],
    'Connection': connections[Math.floor(Math.random() * connections.length)],
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Site': secFetchSites[Math.floor(Math.random() * secFetchSites.length)],
    'Sec-Fetch-Mode': secFetchModes[Math.floor(Math.random() * secFetchModes.length)],
    'Sec-Fetch-User': secFetchUsers[Math.floor(Math.random() * secFetchUsers.length)],
    'Sec-Fetch-Dest': secFetchDests[Math.floor(Math.random() * secFetchDests.length)]
  };
}

// General -------------------------->

// Simulate human-like mouse movements

export async function simulateHumanMouse(page: Page) {
  const randomX = Math.floor(Math.random() * 100);
  const randomY = Math.floor(Math.random() * 100);
  await page.mouse.move(randomX, randomY, { steps: 10 });
  await new Promise(resolve => setTimeout(resolve, randomDelayGenerate(500, 1000)));
};

// Simulate natural scrolling

export async function simulateNaturalScroll(page: Page) {
  await page.evaluate(() => {
    const scroll = () => {
      window.scrollBy(0, Math.floor(Math.random() * 100));
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight) {
        setTimeout(scroll, Math.random() * 500 + 500);
      }
    };
    scroll();
  });
}
