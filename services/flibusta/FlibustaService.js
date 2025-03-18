const axios = require('axios');
const cheerio = require('cheerio');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const NodeCache = require('node-cache');
const https = require('https');
const dns = require('dns').promises;
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const util = require('util');

class FlibustaService {
  constructor() {
    // Initialize rate limiter: 1 request per 2 seconds
    this.rateLimiter = new RateLimiterMemory({
      points: 1,
      duration: 2,
    });

    // Initialize cache with 1 hour TTL
    this.cache = new NodeCache({ stdTTL: 3600 });

    // Base URL for Flibusta
    this.baseUrl = 'https://flibusta.is';

    // Proxy configuration - only needed for local development in regions where Flibusta is blocked
    this.proxy = process.env.NODE_ENV === 'development' ? (process.env.FLIBUSTA_PROXY || null) : null;

    // Default timeout (30 seconds)
    this.timeout = 30000;

    // HTTPS Agent configuration
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false, // WARNING: Only for testing. Remove in production!
      keepAlive: true,
      timeout: this.timeout
    });

    // Initialize proxy agent if proxy is configured
    if (this.proxy && this.proxy.startsWith('socks')) {
      this.proxyAgent = new SocksProxyAgent(this.proxy);
    }

    // Common browser-like headers
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive'
    };

    // Check if we're in a blocked region
    this.checkConnection();

    // Add DNS servers logging
    console.log('\nDNS Configuration:');
    console.log('Current DNS Servers:', dns.getServers());
  }

  /**
   * Check if we can connect to Flibusta
   * @private
   */
  async checkConnection() {
    try {
      const config = {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      };

      if (this.proxy) {
        config.proxy = this.proxy;
      }

      await axios.get(this.baseUrl, config);
    } catch (error) {
      console.warn('\n⚠️  Warning: Cannot connect to Flibusta. If you are in a region where the site is blocked:');
      console.warn('1. Ensure your VPN is active and connected to a region where Flibusta is accessible');
      console.warn('2. Or set FLIBUSTA_PROXY environment variable with your proxy configuration');
      console.warn('3. In production (e.g., on Render.com), no VPN/proxy should be needed\n');
    }
  }

  /**
   * Clean and prepare the search query
   * @param {string} query - Raw search query
   * @returns {string} Cleaned query
   */
  prepareSearchQuery(query) {
    // Remove extra spaces and trim
    let cleaned = query.trim().replace(/\s+/g, ' ');
    
    // If query contains both Latin and Cyrillic, prioritize Cyrillic
    const hasCyrillic = /[а-яА-Я]/.test(cleaned);
    const hasLatin = /[a-zA-Z]/.test(cleaned);
    
    if (hasCyrillic && hasLatin) {
      // Extract only Cyrillic parts if both scripts are present
      cleaned = cleaned.split(' ')
        .filter(word => /[а-яА-Я]/.test(word))
        .join(' ');
    }
    
    return cleaned;
  }

  /**
   * Extract author name from the combined string
   * @param {string} text - Text containing author name
   * @returns {string} Cleaned author name
   */
  extractAuthor(text) {
    // Author names are typically after a dash or hyphen
    const match = text.match(/[-—]\s*([^[]+)/);
    return match ? match[1].trim() : '';
  }

  async makeRequest(url, options = {}) {
    const proxyUrl = process.env.FLIBUSTA_PROXY;
    let agent = null;
    let config = {
        timeout: this.timeout,
        ...options,
        headers: {
            ...this.defaultHeaders,
            ...options.headers
        }
    };

    try {
        // Log DNS configuration
        console.log('\nDNS Configuration:');
        const dnsServers = require('dns').getServers();
        console.log('Current DNS Servers:', dnsServers);

        // Log request details
        console.log('\nRequest Details:');
        const urlObj = new URL(url);
        console.log('Host:', urlObj.hostname);
        console.log('Path:', urlObj.pathname + urlObj.search);

        // Attempt DNS resolution
        console.log('\nAttempting DNS resolution...');
        try {
            const addresses = await dns.lookup(urlObj.hostname, { all: true });
            console.log('\nDNS Resolution successful:', addresses.map(a => a.address));
        } catch (dnsError) {
            console.error('\nDNS Resolution failed:', dnsError.message);
        }

        if (proxyUrl) {
            console.log('\nProxy Configuration:', {
                type: proxyUrl.startsWith('socks') ? 'SOCKS' : 'HTTP',
                proxy: proxyUrl,
                agent: 'Custom Agent'
            });

            if (proxyUrl.startsWith('socks')) {
                agent = new SocksProxyAgent(proxyUrl);
            } else {
                agent = new HttpsProxyAgent(proxyUrl);
            }

            config.httpsAgent = agent;
            config.httpAgent = agent;
        }

        // Log final request config
        console.log('\nMaking request with config:', {
            method: config.method || 'GET',
            url,
            timeout: config.timeout,
            headers: Object.keys(config.headers),
            proxy: proxyUrl || 'none',
            agent: agent ? 'Custom Agent' : 'Default Agent'
        });

        const response = await axios(url, config);
        
        if (response.status === 200) {
            console.log('\nRequest successful:', {
                status: response.status,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length']
            });
        }
        
        return response;
    } catch (error) {
        console.error('\nRequest failed:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            hostname: error.hostname,
            address: error.address,
            port: error.port,
            config: {
                timeout: error.config?.timeout,
                proxy: error.config?.proxy,
                headers: error.config?.headers && Object.keys(error.config.headers)
            },
            response: error.response && {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers
            }
        });
        throw error;
    }
  }

  /**
   * Search for books by title
   * @param {string} query - Book title to search for
   * @returns {Promise<Array>} Array of book variants
   */
  async searchBooks(query) {
    if (!query?.trim()) {
      throw new Error('Search query cannot be empty');
    }

    try {
      console.log(`\nSearching for books with query: "${query}"`);
      
      const cacheKey = `search:${query}`;
      const cachedResults = this.cache.get(cacheKey);
      if (cachedResults) {
        console.log('Returning cached results');
        return cachedResults;
      }

      await this.rateLimiter.consume('search', 1);

      const config = {
        timeout: this.timeout,
        headers: this.defaultHeaders,
        validateStatus: function (status) {
          return status >= 200 && status < 500; // Accept all responses to handle them manually
        }
      };

      if (this.proxy) {
        if (this.proxy.startsWith('socks')) {
          config.httpsAgent = new SocksProxyAgent(this.proxy);
        } else {
          config.httpsAgent = new HttpsProxyAgent(this.proxy);
        }
        console.log(`Using proxy: ${this.proxy}`);
      }

      console.log(`Making request to: ${this.baseUrl}/booksearch?ask=${encodeURIComponent(query)}`);
      
      const response = await axios.get(
        `${this.baseUrl}/booksearch?ask=${encodeURIComponent(query)}`,
        config
      );

      if (response.status === 404) {
        console.log('No results found');
        return [];
      }

      if (response.status !== 200) {
        throw new Error(`Flibusta returned status ${response.status}: ${response.statusText}`);
      }

      const $ = cheerio.load(response.data);
      const books = [];

      // Find the <h3> that contains "Найденные книги" and get the next <ul>
      const bookList = $('h3:contains("Найденные книги")').next('ul');

      if (!bookList.length) {
        console.log('No book list found in response');
        return books;
      }

      // Cloudflare Worker base URL
      const workerUrl = process.env.FLIBUSTA_PROXY_URL || 'https://flibusta-proxy.alphy-flibusta.workers.dev';

      bookList.find('li').each((_, element) => {
        const $el = $(element);
        const links = $el.find('a');

        // First link is the book, last link is the author
        const bookLink = links.first();
        const authorLink = links.last();

        if (bookLink.length && authorLink.length) {
          const bookId = bookLink.attr('href').replace('/b/', '');
          const bookTitle = bookLink.text().trim();
          const authorId = authorLink.attr('href').replace('/a/', '');
          const authorName = authorLink.text().trim();

          // Construct download links using Cloudflare Worker
          const formats = ['epub', 'fb2', 'mobi'].map(format => ({
            format,
            url: `${workerUrl}/${bookId}/${format}`
          }));

          books.push({
            id: bookId,
            title: bookTitle,
            author: {
              id: authorId,
              name: authorName
            },
            formats
          });
        }
      });

      console.log(`Found ${books.length} books`);
      this.cache.set(cacheKey, books);
      return books;

    } catch (error) {
      console.error('Search error:', {
        message: error.message,
        code: error.code,
        response: error.response && {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers
        }
      });

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Failed to connect to Flibusta. Please ensure your VPN is active or configure FLIBUSTA_PROXY in development.');
      }

      if (error.response?.status === 403) {
        throw new Error('Access to Flibusta is blocked in your region. Please use a VPN or configure FLIBUSTA_PROXY.');
      }

      throw new Error(`Failed to search books: ${error.message}`);
    }
  }

  /**
   * Verify if a download link is accessible
   * @param {string} bookId - Book ID
   * @param {string} format - Format (epub, fb2, mobi)
   * @returns {Promise<string>} Verified download URL
   */
  async verifyDownloadLink(bookId, format) {
    const downloadUrl = `${this.baseUrl}/b/${bookId}/${format}`;
    const cacheKey = `verify:${bookId}:${format}`;
    
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      await this.rateLimiter.consume('verify', 1);

      const config = {
        method: 'HEAD',
        timeout: this.timeout,
        headers: {
          ...this.defaultHeaders,
          'Referer': `${this.baseUrl}/b/${bookId}`
        }
      };

      if (this.proxy) {
        if (this.proxy.startsWith('socks')) {
          config.httpsAgent = new SocksProxyAgent(this.proxy);
        } else {
          config.httpsAgent = new HttpsProxyAgent(this.proxy);
        }
      }

      await axios.head(downloadUrl, config);
      
      this.cache.set(cacheKey, downloadUrl);
      return downloadUrl;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Format ${format} is not available for this book`);
      }
      throw error;
    }
  }

  /**
   * Clear cache for a specific search or all cache
   * @param {string} [searchTerm] - Optional search term to clear specific cache
   */
  clearCache(searchTerm = null) {
    if (searchTerm) {
      this.cache.del(`search:${searchTerm}`);
    } else {
      this.cache.flushAll();
    }
  }
}

module.exports = FlibustaService; 