const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const wikidataService = require('../wikidata/WikidataService');

class BookSvService {
  constructor() {
    this.baseUrl = 'https://book.sv';
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: this.baseUrl,
      },
    });

    this.cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });
  }

  normalize(value = '') {
    return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }

  pickBestMatch(queryTitle, queryAuthor, candidates) {
    if (!candidates?.length) {
      return null;
    }

    const normalizedQuery = this.normalize(queryTitle);
    const normalizedAuthor = this.normalize(queryAuthor || '');

    const exactTitleMatch = candidates.find((item) => this.normalize(item.title) === normalizedQuery);
    if (exactTitleMatch) {
      return exactTitleMatch;
    }

    if (normalizedAuthor) {
      const authorMatch = candidates.find((item) => {
        const candidateAuthor = this.normalize(item.authors?.[0]?.name || '');
        return candidateAuthor.includes(normalizedAuthor);
      });
      if (authorMatch) {
        return authorMatch;
      }
    }

    return candidates[0];
  }

  async lookupTitle({ title, author }) {
    const cacheKey = `lookup:${this.normalize(title)}:${this.normalize(author || '')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.http.get('/api/titles', {
        params: {
          recommend: true,
          prefix: title,
        },
      });

      const candidates = Array.isArray(response.data) ? response.data : [];
      const bestMatch = this.pickBestMatch(title, author, candidates);

      if (!bestMatch) {
        const error = new Error('Book not found');
        error.code = 'BOOKSV_TITLE_NOT_FOUND';
        throw error;
      }

      this.cache.set(cacheKey, bestMatch);
      return bestMatch;
    } catch (error) {
      if (error.code === 'BOOKSV_TITLE_NOT_FOUND') {
        throw error;
      }
      const requestError = new Error('Failed to lookup title on book.sv');
      requestError.code = 'BOOKSV_LOOKUP_FAILED';
      requestError.details = error.message;
      throw requestError;
    }
  }

  parseSimilarHtml(html) {
    const $ = cheerio.load(html);
    const recommendations = [];

    $('.recommendation-item').each((_, element) => {
      const titleLink = $(element).find('strong a').first();
      const similarLink = $(element).find('a.btn').last();
      const authorText = $(element).find('small').text().replace(/\s+/g, ' ').trim();

      const title = titleLink.text().trim();
      if (!title) {
        return;
      }

      const goodreadsUrl = titleLink.attr('href');
      const similarHref = similarLink.attr('href') || '';
      const workMatch = similarHref.match(/id=(\d+)/);

      recommendations.push({
        id: workMatch ? workMatch[1] : this.normalize(`${title}-${authorText}`),
        title,
        author: authorText,
        workId: workMatch ? Number(workMatch[1]) : null,
        goodreadsUrl: goodreadsUrl ? new URL(goodreadsUrl, this.baseUrl).toString() : null,
      });
    });

    const heading = $('h5')
      .filter((_, el) => $(el).text().toLowerCase().includes('similar books'))
      .first()
      .text()
      .trim();

    return {
      heading,
      recommendations,
    };
  }

  filterSeedRecommendations(recommendations, seedWorkId, seedTitle) {
    const normalizedSeedTitle = this.normalize(seedTitle || '');

    return recommendations.filter((item, index) => {
      const workIdMatches =
        seedWorkId && item.workId && Number(item.workId) === Number(seedWorkId);
      const titleMatches =
        normalizedSeedTitle && this.normalize(item.title) === normalizedSeedTitle;

      if (workIdMatches || titleMatches) {
        return false;
      }

      if (index === 0 && normalizedSeedTitle && !item.workId) {
        return this.normalize(item.title) !== normalizedSeedTitle;
      }

      return true;
    });
  }

  async fetchSimilarByWorkId(workId) {
    const cacheKey = `similar:${workId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.http.get('/similar', {
        params: { id: workId },
        responseType: 'text',
        transformResponse: [(data) => data],
      });

      const parsed = this.parseSimilarHtml(response.data);
      this.cache.set(cacheKey, parsed);
      return parsed;
    } catch (error) {
      const requestError = new Error('Failed to fetch similar books from book.sv');
      requestError.code = 'BOOKSV_SIMILAR_FAILED';
      requestError.details = error.message;
      throw requestError;
    }
  }

  async getSimilarRecommendations({ title, author, workId, titleLang }) {
    if (!title?.trim() && !workId) {
      const error = new Error('Title is required');
      error.code = 'BOOKSV_TITLE_REQUIRED';
      throw error;
    }

    let resolvedWorkId = workId;
    let seedTitle = title?.trim();
    let seedAuthor = author?.trim();

    if (!resolvedWorkId && seedTitle && titleLang === 'ru') {
      try {
        const englishTitle = await wikidataService.getEnglishTitle({ title: seedTitle, author });
        if (englishTitle) {
          seedTitle = englishTitle;
        }
      } catch (translationError) {
        console.warn('Failed to resolve English title via Wikidata:', translationError?.message || translationError);
      }
    }

    const lookupTitleTerm = seedTitle || title;

    if (!resolvedWorkId) {
      const lookup = await this.lookupTitle({ title: lookupTitleTerm, author });
      resolvedWorkId = lookup.workID;
      seedTitle = lookup.title;
      seedAuthor = lookup.authors?.[0]?.name || author || '';
    }

    const similar = await this.fetchSimilarByWorkId(resolvedWorkId);

    if (!seedTitle && similar.heading) {
      seedTitle = similar.heading.replace(/^Similar books to\s*/i, '').trim();
    }

    const recommendations = this.filterSeedRecommendations(
      similar.recommendations,
      resolvedWorkId,
      seedTitle
    );

    return {
      seed: {
        title: seedTitle || 'Unknown title',
        author: seedAuthor || '',
      },
      workId: resolvedWorkId,
      heading: similar.heading,
      recommendations,
    };
  }

  normalizeWorkIds(workIds = []) {
    return workIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  async getBulkRecommendations({ workIds, filterTop = false } = {}) {
    const payload = this.normalizeWorkIds(workIds);
    if (!payload.length) {
      return [];
    }

    try {
      const response = await this.http.post('/api/suggest', payload, {
        params: { filterTop },
      });

      const data = Array.isArray(response.data) ? response.data : [];
      return data;
    } catch (error) {
      const requestError = new Error('Failed to fetch bulk recommendations from book.sv');
      requestError.code = 'BOOKSV_BULK_RECOMMENDATIONS_FAILED';
      requestError.details = error.message;
      throw requestError;
    }
  }
}

module.exports = new BookSvService();

