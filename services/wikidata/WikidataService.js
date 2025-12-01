const axios = require('axios');

class WikidataService {
  constructor() {
    this.http = axios.create({
      baseURL: 'https://www.wikidata.org/w/api.php',
      timeout: 15000,
      headers: {
        'User-Agent': 'DAH Wikidata Resolver',
      },
      params: {
        format: 'json',
        origin: '*',
      },
    });
  }

  async searchEntities(term, language = 'ru', limit = 5) {
    if (!term?.trim()) {
      return [];
    }

    const params = {
      action: 'wbsearchentities',
      search: term.trim(),
      language,
      uselang: language,
      type: 'item',
      limit,
    };

    try {
      const response = await this.http.get('', { params });
      return response.data?.search || [];
    } catch (error) {
      console.warn('Wikidata search failed:', error.message);
      return [];
    }
  }

  async fetchEntities(ids = []) {
    if (!ids.length) {
      return {};
    }

    const params = {
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|aliases',
      languages: 'en|ru',
    };

    try {
      const response = await this.http.get('', { params });
      return response.data?.entities || {};
    } catch (error) {
      console.warn('Wikidata fetch failed:', error.message);
      return {};
    }
  }

  async getEnglishTitle({ title, author }) {
    if (!title?.trim()) {
      return null;
    }

    const searchResults = await this.searchEntities(title, 'ru', 5);
    if (!searchResults.length) {
      return null;
    }

    const topIds = searchResults.slice(0, 5).map((item) => item.id);
    const entities = await this.fetchEntities(topIds);

    for (const id of topIds) {
      const entity = entities[id];
      if (!entity) continue;

      const englishLabel = entity.labels?.en?.value;
      if (englishLabel) {
        return englishLabel;
      }
    }

    return null;
  }

  async getRussianTitle({ title, author }) {
    if (!title?.trim()) {
      return null;
    }

    let searchResults = await this.searchEntities(title, 'en', 5);
    if (!searchResults.length && author?.trim()) {
      searchResults = await this.searchEntities(`${title} ${author}`, 'en', 5);
    }

    if (!searchResults.length) {
      return null;
    }

    const topIds = searchResults.slice(0, 5).map((item) => item.id);
    const entities = await this.fetchEntities(topIds);

    for (const id of topIds) {
      const entity = entities[id];
      if (!entity) continue;

      const russianLabel = entity.labels?.ru?.value;
      if (russianLabel) {
        return russianLabel;
      }

      const russianAliases = entity.aliases?.ru;
      if (Array.isArray(russianAliases) && russianAliases.length) {
        const aliasValue = russianAliases[0]?.value;
        if (aliasValue) {
          return aliasValue;
        }
      }
    }

    return null;
  }
}

module.exports = new WikidataService();

