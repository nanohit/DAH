const puppeteer = require('puppeteer');
const PQueue = require('p-queue').default;
const { CookieJar } = require('tough-cookie');
const NodeCache = require('node-cache');
const { wrapper } = require('axios-cookiejar-support');
const axiosBase = require('axios');
const cheerio = require('cheerio');

const DEFAULT_ACCOUNT_POOL = [
  'zlib.alphy@mail.ru',
  'nanohit.docker@nutritionxtreme.com',
  'nanohit.docker1@nutritionxtreme.com',
  'nanohit.docker2@nutritionxtreme.com',
  'nanohit.docker3@nutritionxtreme.com',
  'nanohit.docker4@nutritionxtreme.com',
  'nanohit.docker5@nutritionxtreme.com',
  'nanohit.docker6@nutritionxtreme.com',
  'nanohit.docker7@nutritionxtreme.com',
  'nanohit.docker8@nutritionxtreme.com',
  'nanohit.docker9@nutritionxtreme.com',
];

const axios = wrapper(axiosBase);

class ZLibraryService {
  constructor() {
    this.baseUrl = process.env.ZLIBRARY_BASE_URL || 'https://z-library.sk';
    this.accountPool = this.buildAccountPool();
    this.activeAccountIndex = 0;
    this.accountState = this.accountPool.map(() => ({ exhaustedUntil: 0 }));
    this.setActiveAccount(0);

    this.loginValidityMs = 15 * 60 * 1000;
    this.timeout = 60000;
    this.queue = new PQueue({ concurrency: 1 });
    this.browserPromise = null;
    this.page = null;
    this.lastLoginAt = 0;
    this.cookieJar = new CookieJar();
    this.cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });
    this.warmupPromise = null;
    this.defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };

    this.scheduleWarmup();
  }

  async ensureBrowser() {
    if (!this.browserPromise) {
      const headlessMode =
        typeof process.env.PUPPETEER_HEADLESS !== 'undefined'
          ? process.env.PUPPETEER_HEADLESS === 'false'
            ? false
            : process.env.PUPPETEER_HEADLESS
          : 'new';

      this.browserPromise = puppeteer
        .launch({
          headless: headlessMode,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          defaultViewport: { width: 1280, height: 720 },
        })
        .catch((error) => {
          console.error('Failed to launch Puppeteer for Z-Library:', error);
          this.browserPromise = null;
          throw error;
        });
    }

    const browser = await this.browserPromise;

    if (!this.page || this.page.isClosed()) {
      this.page = await browser.newPage();
      await this.page.setUserAgent(this.defaultHeaders['User-Agent']);
      this.page.setDefaultTimeout(this.timeout);
      this.page.on('error', (error) => {
        console.error('Z-Library page crashed:', error);
        this.page = null;
        this.lastLoginAt = 0;
      });
      browser.on('disconnected', () => {
        console.warn('Puppeteer browser disconnected. Resetting Z-Library session.');
        this.browserPromise = null;
        this.page = null;
        this.lastLoginAt = 0;
      });
    }

    return this.page;
  }

  async ensureLoggedIn() {
    const page = await this.ensureBrowser();

    if (this.lastLoginAt && Date.now() - this.lastLoginAt < this.loginValidityMs) {
      return page;
    }

    console.log('🔐 Performing Z-Library login...');

    await page.goto(`${this.baseUrl}/login`, {
      waitUntil: 'networkidle2',
      timeout: this.timeout,
    });

    await this.waitForLoginForm(page);
    await page.$eval('form[data-action="login"] input[name="email"]', (el) => (el.value = ''));
    await page.$eval('form[data-action="login"] input[name="password"]', (el) => (el.value = ''));

    await page.type('form[data-action="login"] input[name="email"]', this.email, { delay: 20 });
    await page.type('form[data-action="login"] input[name="password"]', this.password, { delay: 20 });

    await Promise.all([
      page.click('form[data-action="login"] button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.timeout }),
    ]);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Failed to login to Z-Library. Please verify credentials.');
    }

    this.lastLoginAt = Date.now();
    await this.syncCookiesFromPage();
    console.log('✅ Z-Library login successful');
    return page;
  }

  async syncCookiesFromPage() {
    if (!this.page) return;
    const cookies = await this.page.cookies();
    await Promise.all(
      cookies.map((cookie) =>
        this.cookieJar.setCookie(
          `${cookie.name}=${cookie.value}; Domain=${cookie.domain || new URL(this.baseUrl).hostname}; Path=${
            cookie.path || '/'
          }`,
          this.baseUrl
        )
      )
    );
  }

  async clearCookies() {
    this.cookieJar = new CookieJar();
    if (this.page) {
      const client = await this.page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
    }
  }

  async searchBooks(query) {
    if (!query?.trim()) {
      throw new Error('Search query cannot be empty');
    }

    const cacheKey = `search:${query.trim().toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queue.add(async () => {
      const page = await this.ensureLoggedIn();
      const encoded = encodeURIComponent(query.trim());
      const searchUrl = `${this.baseUrl}/s/${encoded}`;

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      await page.waitForSelector('#searchResultBox z-bookcard', { timeout: this.timeout });

      const results = await page.$$eval('#searchResultBox z-bookcard', (cards) =>
        cards.slice(0, 20).map((card) => {
          const download = card.getAttribute('download') || '';
          const match = download.match(/\/dl\/([^/]+)\/([^/]+)/);
          const downloadId = match ? match[1] : card.getAttribute('id');
          const downloadToken = match ? match[2] : '';

          return {
            id: card.getAttribute('id') || downloadId,
            title: card.querySelector('div[slot="title"]')?.textContent?.trim() || '',
            author: card.querySelector('div[slot="author"]')?.textContent?.trim() || '',
            extension: (card.getAttribute('extension') || '').toLowerCase(),
            filesize: card.getAttribute('filesize') || '',
            language: card.getAttribute('language') || '',
            year: card.getAttribute('year') || '',
            cover: card.querySelector('img')?.getAttribute('data-src') || '',
            downloadPath: download,
            downloadId,
            downloadToken,
            href: card.getAttribute('href') || '',
          };
        })
      );

      const filtered = results.filter((result) => result.downloadId && result.downloadToken);
      this.cache.set(cacheKey, filtered);
      return filtered;
    });
  }

  async resolveDownload(downloadPath) {
    if (!downloadPath) {
      throw new Error('Download path is required');
    }

    return this.queue.add(async () => {
      let attempts = 0;
      const maxAttempts = this.accountPool.length;
      let lastError = null;

      while (attempts < maxAttempts) {
        try {
          await this.ensureLoggedIn();
          await this.syncCookiesFromPage();

          const targetUrl = new URL(downloadPath, this.baseUrl).toString();
          const response = await axios.get(targetUrl, {
            headers: this.defaultHeaders,
            jar: this.cookieJar,
            withCredentials: true,
            timeout: this.timeout,
            maxRedirects: 0,
            validateStatus: (status) => status === 302,
          });

          const location = response.headers['location'];
          if (!location) {
            throw new Error('Z-Library did not return a redirect for the download link.');
          }

          const locationUrl = new URL(location);
          const filename = locationUrl.searchParams.get('filename');
          const expiresAt = locationUrl.searchParams.get('expires');

          return {
            location,
            filename,
            expiresAt: expiresAt ? Number(expiresAt) * 1000 : null,
          };
        } catch (error) {
          lastError = await this.processDownloadError(error, downloadPath, attempts);
          if (!lastError) {
            attempts += 1;
            continue;
          }
          break;
        }
      }

      throw lastError || new Error('Failed to obtain Z-Library download link.');
    });
  }

  async processDownloadError(error, downloadPath, attempts) {
    let processedError = error;

    if (error.response?.status === 200 && typeof error.response.data === 'string') {
      const html = error.response.data;
      if (html.includes('download-limits-error__header')) {
        const parsedLimit = this.parseDownloadLimitMessage(html);
        processedError = this.buildDailyLimitError(parsedLimit);
      }
    }

    if (processedError.code === 'ZLIB_DAILY_LIMIT') {
      const rotated = await this.handleDailyLimit(processedError);
      if (rotated && attempts + 1 < this.accountPool.length) {
        console.log(
          `🔁 Switched to next Z-Library account (${this.email}). Retrying download (attempt ${
            attempts + 2
          }/${this.accountPool.length}).`
        );
        return null;
      }
    }

    if (processedError.response?.status === 403 || processedError.response?.status === 401) {
      console.warn('Z-Library download request unauthorized. Clearing session and retrying...');
      await this.clearCookies();
      this.lastLoginAt = 0;
      return null;
    }

    return processedError;
  }

  buildAccountPool() {
    const envPool = (process.env.ZLIBRARY_ACCOUNT_POOL || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const fallbackEmail = process.env.ZLIBRARY_EMAIL;
    const combined = [...envPool];

    if (fallbackEmail) {
      combined.unshift(fallbackEmail);
    }

    if (!combined.length) {
      combined.push(...DEFAULT_ACCOUNT_POOL);
    } else {
      DEFAULT_ACCOUNT_POOL.forEach((email) => {
        if (!combined.includes(email)) {
          combined.push(email);
        }
      });
    }

    return combined.map((email) => ({
      email,
      password: process.env.ZLIBRARY_PASSWORD || '123456789',
    }));
  }

  setActiveAccount(index) {
    const account = this.accountPool[index];
    if (!account) {
      throw new Error('No Z-Library accounts available.');
    }

    this.email = account.email;
    this.password = account.password;

    if (!this.email || !this.password) {
      throw new Error('Z-Library credentials are not configured.');
    }
  }

  async handleDailyLimit(error) {
    const waitMs = this.parseWaitDuration(error.details?.wait);
    this.markAccountExhausted(this.activeAccountIndex, waitMs);
    const nextIndex = this.findNextAvailableAccount();

    if (nextIndex === null) {
      console.warn('All Z-Library accounts are exhausted. Please wait before retrying.');
      return false;
    }

    console.warn(
      `Z-Library daily limit reached for ${this.email}. Switching to ${this.accountPool[nextIndex].email}.`
    );
    await this.switchAccount(nextIndex);
    await this.warmup().catch(() => {});
    return true;
  }

  markAccountExhausted(index, waitMs) {
    const duration = waitMs || 3 * 60 * 60 * 1000;
    this.accountState[index].exhaustedUntil = Date.now() + duration;
  }

  findNextAvailableAccount() {
    const now = Date.now();
    for (let i = 0; i < this.accountPool.length; i += 1) {
      const candidateIndex = (this.activeAccountIndex + 1 + i) % this.accountPool.length;
      if (candidateIndex === this.activeAccountIndex) {
        continue;
      }
      if (this.accountState[candidateIndex].exhaustedUntil <= now) {
        return candidateIndex;
      }
    }
    return null;
  }

  async switchAccount(index) {
    this.activeAccountIndex = index;
    this.setActiveAccount(index);
    await this.clearCookies();
    this.page = null;
    this.lastLoginAt = 0;
  }

  parseDownloadLimitMessage(html) {
    try {
      const $ = cheerio.load(html);
      const message = $('.download-limits-error__message').text().trim();
      if (!message) {
        return null;
      }

      const waitMatch = message.match(/wait\s+([^<]+?)\s+for the download counter/i);
      const waitText = waitMatch ? waitMatch[1].trim() : null;

      return {
        message: waitText
          ? `Z-Library daily limit reached. Wait ${waitText} or upgrade the account.`
          : message,
        wait: waitText,
      };
    } catch {
      return null;
    }
  }

  parseWaitDuration(waitText) {
    if (!waitText) {
      return null;
    }

    const regex = /(?:(\d+)\s*hours?)?\s*(?:(\d+)\s*minutes?)?\s*(?:(\d+)\s*seconds?)?/i;
    const match = waitText.match(regex);
    if (!match) {
      return null;
    }

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);

    const totalMs = hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000;
    return totalMs > 0 ? totalMs : null;
  }

  buildDailyLimitError(parsedLimit) {
    const limitError = new Error(
      parsedLimit?.message ||
        'Z-Library daily download limit reached for the shared account. Please wait before trying again.'
    );
    limitError.code = 'ZLIB_DAILY_LIMIT';
    limitError.details = parsedLimit;
    return limitError;
  }

  async waitForLoginForm(page) {
    const selector = 'form[data-action="login"] input[name="email"]';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await page.waitForSelector(selector, { timeout: 20000 });
        return;
      } catch (error) {
        const html = await page.content();
        console.warn('Login form not visible yet. Current URL:', page.url());
        if (html.includes('Checking your browser before accessing') || html.includes('ddos-guard')) {
          console.warn('Waiting for DDoS-Guard challenge to complete...');
          await page.waitForTimeout(4000);
          continue;
        }
        if (attempt === 2) {
          throw error;
        }
        await page.waitForTimeout(2000);
      }
    }
  }

  scheduleWarmup() {
    setTimeout(() => {
      this.warmup().catch((err) => {
        console.warn('Initial Z-Library warmup failed:', err.message);
      });
    }, 1500);

    setInterval(() => {
      this.warmup().catch(() => {});
    }, 15 * 60 * 1000);
  }

  warmup() {
    if (this.warmupPromise) {
      return this.warmupPromise;
    }

    this.warmupPromise = (async () => {
      try {
        await this.ensureLoggedIn();
      } catch (error) {
        throw error;
      } finally {
        this.warmupPromise = null;
      }
    })();

    return this.warmupPromise;
  }
}

module.exports = new ZLibraryService();

