/*
  New random proxy each time we launch a new browser
  Get random proxy from the fresh proxy pool that we match against to fs data lists: validProxies and usedProxies
  Main function is getRandomProxy() that returns the ProxyConfig type object or null if no proxy is available
  ProxyConfig: {
      proxy_address: string;
      port: number;
      username: string | undefined;
      password: string | undefined;
      valid: boolean | undefined;
      geolocation: string | undefined;
  }
*/

import "server-only";

import { setAbsolutePath, wait } from "../utils";
import { ProxyData, type ProxyConfig } from "../def";
import fs from 'fs/promises';
import axios from 'axios';
import * as https from 'https';

const INVALID_PROXIES_PATH = setAbsolutePath('/src/data/invalidProxies.json');
const USED_PROXIES_PATH = setAbsolutePath('/src/data/usedProxies.json');
const PROXY_POOL_API_URL = 'https://proxy.webshare.io/api/v2/proxy/list/';
const PROXY_POOL_SCRP_URL = 'https://www.sslproxies.org/';
const FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY = 10000;
const PROXY_TEST_URLS = [
  {
    url: 'https://httpbin.org/ip',
    validate: (data: ProxyData) => {
      return typeof data === 'object' && data !== null && 'origin' in data;
    }
  },
  {
    url: 'http://api.ipify.org?format=json',
    validate: (data: ProxyData) => {
      return typeof data === 'object' && data !== null && 'ip' in data;
    }
  },
  {
    url: 'https://ifconfig.me/ip',
    validate: (data: ProxyData) => {
      return typeof data === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(data);
    }
  },
  {
    url: 'https://api.myip.com',
    validate: (data: ProxyData) => {
      return typeof data === 'object' && data !== null && 'ip' in data;
    }
  }
];


// ---------------------------------> Get Random Proxy <----------------------------------------------------
/*
getRandomProxy() function that returns random proxy from proxy list excluding invalid and used proxies list array
return format type: ProxyConfig
*/

export async function getRandomProxy(): Promise<ProxyConfig | null> {
  console.log('-----> Get Random Proxy procedure initialized ..');

  const randomProxyPool = await getRandomProxyPool();

  if (!randomProxyPool) {
    console.error('------> Failed to get random proxy pool');
    return null;
  }

  // filter out invalid and used proxies and get clean proxy pool
  const invalidProxies = await getProxies(INVALID_PROXIES_PATH) || [];
  const usedProxies = await getProxies(USED_PROXIES_PATH) || [];
  const proxyPool = filterProxyPool(invalidProxies, usedProxies, randomProxyPool);

  console.log('------> filtering proxyPool from invalid and used proxies: ', proxyPool);

  if (proxyPool.length === 0) {
    console.error('------> No valid proxies available after filtering');
    return null;
  }

  let randomProxy;
  let isValid = false;

  // Try finding a valid proxy up to 5 attempts
  for (let attempt = 0; attempt < 5 && !isValid; attempt++) {
    //get random proxy from the proxy pool
    randomProxy = proxyPool[Math.floor(Math.random() * proxyPool.length)];
    console.log(`-----> Testing proxy: ${randomProxy.proxy_address}:${randomProxy.port}`);
    isValid = await validateProxy(randomProxy);
  }

  if (!randomProxy) {
    console.error('------> Failed to get random proxy');
    return null;
  }

  if (!isValid) {
    invalidProxies.push(`${randomProxy.proxy_address}:${randomProxy.port}`);
    await storeProxies(invalidProxies, INVALID_PROXIES_PATH);
    console.error(`------> Proxy is invalid -> saved it to invalidProxies.json: ${randomProxy.proxy_address}:${randomProxy.port}`);
    return getRandomProxy();
  }

  // Get the proxy geolocation and add it to the proxy object
  let proxyGeolocation = await getGeolocationFromProxy(randomProxy.proxy_address);
  // if proxyGeolocation is null, generate random geolocation
  if (!proxyGeolocation) {
    proxyGeolocation = generateFallbackGeolocation();
  }
  randomProxy.geolocation = proxyGeolocation;

  // Add proxy to used proxies list
  usedProxies.push(`${randomProxy.proxy_address}:${randomProxy.port}`);
  await storeProxies(usedProxies, USED_PROXIES_PATH);
  console.log(`------> Proxy added to used proxies list and saved to usedProxies.json: ${randomProxy.proxy_address}:${randomProxy.port}`);

  return randomProxy;
}



// Helper functions ------------------------------------------------------------------------------------------>


// Get the list of invalid proxies from the file: src/data/invalidProxies.json
async function getProxies(path: string): Promise<string[] | null> {
  try {
    const proxiesJson = await fs.readFile(path, 'utf8');
    if (!proxiesJson.trim()) {
      console.warn(`File at ${path} is empty or contains only whitespace.`);
      return [];
    }
    try {
      return JSON.parse(proxiesJson);
    } catch (parseError) {
      console.error(`Error parsing JSON from ${path}:`, parseError);
      console.log('Content of the file:', proxiesJson);
      return null;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes('ENOENT')) {
        console.warn(`File not found at ${path}. Returning empty array.`);
        return [];
      }
      console.error(`Error reading file ${path}:`, err.message);
    } else {
      console.error(`Unknown error occurred while reading ${path}:`, err);
    }
    return null;
  }
}

async function storeProxies(proxies: string[], path: string) {
  const proxiesJson = JSON.stringify(proxies, null, 2);
  await fs.writeFile(path, proxiesJson);
}

function filterProxyPool(invalidProxies: string[], usedProxies: string[], randomProxyPool: ProxyConfig[]) {
  return randomProxyPool.filter(
    (proxy: ProxyConfig) =>
      !invalidProxies.includes(`${proxy.proxy_address}:${proxy.port}`) &&
      !usedProxies.includes(`${proxy.proxy_address}:${proxy.port}`)
  );
}


// Create random pull of proxies combining the API and Scrape HTP(S) proxies
async function getRandomProxyPool() {
  const proxiesAPI = await getProxiesAPI();
  const proxiesScrp = await getProxiesSCRP();

  if (!proxiesAPI && !proxiesScrp) return null;

  const randomProxyPool = [...(proxiesAPI ?? []), ...(proxiesScrp ?? [])];
  // shuffle and return random proxy pool
  return randomProxyPool.sort(() => Math.random() - 0.5);
}


//  Get Proxies - proxy.webshare.io API
/*

getProxiesAPI() - fetch proxies from the API that returns this object that we then map to ProxyConfig[]:

{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "d-10513",
      "username": "username",
      "password": "password",
      "proxy_address": "1.2.3.4",
      "port": 8168,
      "valid": true,
      "last_verification": "2019-06-09T23:34:00.095501-07:00",
      "country_code": "US",
      "city_name": "New York",
      "created_at": "2022-06-14T11:58:10.246406-07:00"
    },
    ...
  ]
}
*/

async function getProxiesAPI(retryCount: number = 0): Promise<ProxyConfig[] | null> {
  const url = new URL(PROXY_POOL_API_URL);
  url.searchParams.append('mode', 'direct');
  url.searchParams.append('page', '1');
  url.searchParams.append('page_size', '10');   // as we have only 10 free proxies

  try {
    const response = await fetch(url.href, {
      method: "GET",
      headers: {
        Authorization: "Token 0y5qp7dqwyqfng3giob6bqvptgab22ln13m1jkrp"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // refine data to get only proxies that are valid and of type ProxyConfig
    const proxies: ProxyConfig[] = data.results
      .filter((proxy: ProxyConfig) => proxy.valid)
      .map((proxy: ProxyConfig) => ({
        proxy_address: proxy.proxy_address,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
      }));

    if (proxies.length === 0) {
      console.error('------> No valid API proxies found');
      throw new Error("No valid proxies found");
    }

    return proxies;

  } catch (error) {
    if (retryCount < FETCH_RETRIES) {
      console.log(`------> Proxy fetch Attempt ${retryCount + 1} failed. ${error}. Retrying in ${FETCH_RETRY_DELAY}ms...`);
      await wait(FETCH_RETRY_DELAY);

      // Try again
      return getProxiesAPI(retryCount + 1);
    }

    return null;
  }
}


// getProxiesSCRP - Scrape HTP(S) proxies from https://www.sslproxies.org/ using cheerio that we then map to ProxyConfig[]:

async function getProxiesSCRP(): Promise<ProxyConfig[] | null> {
  // Dynamically import Cheerio
  const cheerio = await import('cheerio');
  const url = new URL(PROXY_POOL_SCRP_URL);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`-----> HTTP error while fetching the ${url.href}! status: ${response.status}`);
      throw new Error(`HTTP error while fetching the ${url.href}! status: ${response.status}`);
    }

    // Get the response body as text and parse it with Cheerio
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract proxies from the HTML
    try {
      const proxiesData = $(".modal-body textarea").text().split('\n').slice(5, 35);

      if (proxiesData.length === 0) {
        console.error('-----> No proxies found on scrp url' + url.href);
        throw new Error(`No proxies found`);
      }

      const proxies: ProxyConfig[] = proxiesData.map((proxyWithPort) => {
        const [proxy_address, port] = proxyWithPort.split(':');
        return {
          proxy_address,
          port: parseInt(port),
        };
      });

      if (proxies.length === 0) {
        console.error('-----> No proxies found on scrp url' + url.href);
        throw new Error(`No proxies found`);
      }

      return proxies;

    } catch (error) {
      console.warn('-----> Error extracting proxies from the page:', error);
      throw new Error(`Error extracting proxies from the page: ${error}`);
    }
  } catch (error) {
    console.error('-----> Error fetching SCRP proxies:', error);
    return null;
  }
}


async function validateProxy(proxy: ProxyConfig) {

  // Validate proxy configuration
  if (!proxy.proxy_address || !proxy.port) {
    console.error('------> Invalid proxy configuration');
    return false;
  }

  // Shuffle the PROXY_TEST_URLS array
  PROXY_TEST_URLS.sort(() => Math.random() - 0.5);

  // Try multiple test URLs if one fails
  for (const testUrl of PROXY_TEST_URLS) {
    try {
      // Create an Axios instance with the proxy configuration
      const axiosInstance = axios.create({
        proxy: {
          protocol: 'http',
          host: proxy.proxy_address,
          port: proxy.port,
          ...(proxy.username && proxy.password && {
            auth: {
              username: proxy.username,
              password: proxy.password
            }
          })
        },
        timeout: 20000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method' // Forces TLS 1.2
        }),
        validateStatus: (status) => status === 200 // Only accept 200 status codes
      });

      // Test proxy by sending a GET request to the test URL
      const startTime = Date.now();
      const response = await axiosInstance.get(testUrl.url);
      const endTime = Date.now();

      // Check response time
      const responseTime = endTime - startTime;
      if (responseTime > 10000) { // 10 seconds threshold
        console.warn(`Proxy ${proxy.proxy_address} is too slow: ${responseTime}ms`);
        continue;
      }

      // Enhanced response validation
      const responseData = response.data;

      // Check if response contains debug headers
      if (typeof responseData === 'string' &&
        (responseData.includes('REMOTE_ADDR') ||
          responseData.includes('REQUEST_METHOD') ||
          responseData.includes('HTTP_HOST'))) {
        console.warn(`Proxy ${proxy.proxy_address}:${proxy.port} returned debug headers instead of content`);
        continue;
      }

      // Validate response based on test URL expectations
      if (testUrl.validate(responseData)) {
        // Additional validation for JSON response
        if (typeof responseData === 'object' && responseData !== null) {
          if ('ip' in responseData || 'origin' in responseData) {
            const proxyIP = responseData.ip || responseData.origin;
            if (proxyIP && proxyIP !== proxy.proxy_address) {
              console.log(`Proxy ${proxy.proxy_address}:${proxy.port} validated successfully (IP: ${proxyIP})`);
              return true;
            }
          }
        }

        console.log(`Proxy ${proxy.proxy_address}:${proxy.port} validated successfully`);
        return true;
      }

      // Invalid response
      console.warn(`Proxy ${proxy.proxy_address}:${proxy.port} returned invalid response format`);

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data || error.message;
        if (typeof errorMessage === 'string' &&
          (errorMessage.includes('REMOTE_ADDR') ||
            errorMessage.includes('REQUEST_METHOD'))) {
          console.warn(`Proxy ${proxy.proxy_address}:${proxy.port} is exposing debug information`);
          continue;
        }

        if (error.code === 'ECONNABORTED') {
          console.warn(`Timeout error for proxy ${proxy.proxy_address}:${proxy.port}`);
        }
        else if (error.code === 'EPROTO' || error.message.includes('self-signed certificate')) {
          console.warn(`SSL error for proxy ${proxy.proxy_address}:${proxy.port}`);
        }
        else if (error.response) {
          console.warn(`Response error from proxy ${proxy.proxy_address}:${proxy.port}, status: ${error.response.status}`);
        } else {
          console.warn(`Error testing proxy ${proxy.proxy_address}:${proxy.port}:`, error.message);
        }
      } else {
        console.warn(`Unknown error with proxy ${proxy.proxy_address}:${proxy.port}:`, error);
      }

      continue; // Try next test URL
    }
  }

  console.log('------> All proxy tests failed with all proxy services');
  return false; // All tests failed
}


// Get geolocation from the proxy IP address using the freegeoip API. Returns null if it fails or { latitude, longitude } object.
async function getGeolocationFromProxy(proxyAddress: string): Promise<string | null> {
  const services = [
    `http://ip-api.com/json/${proxyAddress}`,
    `https://freegeoip.app/json/${proxyAddress}`,
    `https://ipgeolocation.io/ip-location/${proxyAddress}`
  ];

  for (const service of services) {
    try {
      return await fetchGeolocation(service);
    } catch (error) {
      console.error(`Error fetching geolocation from ${service}:`, error);
    }
  }

  console.error(`Failed to get geolocation for IP: ${proxyAddress} from all services`);
  return null;
}

//
async function fetchGeolocation(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${url}`);
  }
  const data = await response.json();

  if (url.includes('ip-api')) {
    if (data.status === 'success') {
      return `${data.lat},${data.lon}`;
    }
  } else if (url.includes('ipstack')) {
    if (!data.error) {
      return `${data.latitude},${data.longitude}`;
    }
  } else if (url.includes('ipinfo')) {
    if (!data.error) {
      const [latitude, longitude] = data.loc.split(',');
      return `${latitude},${longitude}`;
    }
  }

  throw new Error(`Invalid response from ${url}`);
}


function generateFallbackGeolocation() {
  // Major cities with their approximate coordinates
  const cities = [
    { name: 'New York', lat: 40.7128, lng: -74.0060 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Berlin', lat: 52.5200, lng: 13.4050 },
    { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 }
  ];

  // Select a random city
  const city = cities[Math.floor(Math.random() * cities.length)];

  // Add small random variations to make it look more natural
  // Variation of ±0.01 degrees (roughly ±1km)
  const variation = 0.01;
  const latitude = (
    city.lat + (Math.random() * variation * 2 - variation)
  ).toFixed(6);
  const longitude = (
    city.lng + (Math.random() * variation * 2 - variation)
  ).toFixed(6);

  return `${latitude},${longitude}`;
}


