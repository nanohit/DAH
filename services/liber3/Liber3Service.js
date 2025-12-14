const axios = require('axios');

class Liber3Service {
  constructor() {
    this.gateways = [
      process.env.LIBER3_GATEWAY || 'https://lgate.glitternode.ru',
      'https://gateway.magnode.ru',
      'https://gateway.glitternode.ru',
    ];

    this.ipfsGateways = [
      process.env.LIBER3_IPFS_GATEWAY || 'https://ipfs.io/ipfs',
      'https://gateway.pinata.cloud/ipfs',
      'https://dweb.link/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
      'https://gateway.ipfs.io/ipfs',
      'https://w3s.link/ipfs',
      'https://nftstorage.link/ipfs',
      'https://cf-ipfs.com/ipfs',
    ];

    this.coverBase = process.env.LIBER3_COVER_BASE || 'https://library.lol/covers/';
    this.timeout =
      Number(process.env.LIBER3_TIMEOUT_MS || process.env.LIBER3_SEARCH_TIMEOUT_MS) || 15_000;
  }

  buildIpfsUrl(cid) {
    const base = this.ipfsGateways[0].replace(/\/$/, '');
    return `${base}/${cid}`;
  }

  buildCoverUrl(coverPath = '') {
    if (!coverPath) return undefined;
    if (coverPath.startsWith('http')) return coverPath;
    return `${this.coverBase.replace(/\/$/, '')}/${coverPath.replace(/^\/+/, '')}`;
  }

  mapBook(raw) {
    const cid = raw.ipfs_cid || raw.ipfsCid || raw.cid;
    const extension = (raw.extension || '').replace('.', '').toUpperCase() || 'PDF';
    const mirrors = cid
      ? this.ipfsGateways.map((g) => `${g.replace(/\/$/, '')}/${cid}`)
      : [];
    const downloadPath = mirrors[0];
    const cover = this.buildCoverUrl(raw.coverurl || raw.coverUrl || raw.cover);

    return {
      id: String(raw.id || cid || raw.title || Math.random().toString(36).slice(2)),
      title: raw.title || '',
      author: raw.author || '',
      cover,
      source: 'liber3',
      formats: downloadPath
        ? [
            {
              id: `${raw.id || cid || raw.title}-${extension}`.replace(/\\s+/g, '-'),
              format: extension,
              size: raw.size || undefined,
              source: 'liber3',
              downloadPath,
              mirrors,
              cid,
            },
          ]
        : [],
    };
  }

  async search(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [];
    }

    let lastError;
    for (const base of this.gateways) {
      try {
        const response = await axios.post(
          `${base}/v1/searchV2`,
          { address: '', word: trimmed },
          {
            timeout: this.timeout,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const books = response.data?.data?.book;
        if (Array.isArray(books)) {
          return books.map((item) => this.mapBook(item)).filter((b) => b.formats.length > 0);
        }

        lastError = new Error(`Unexpected response from ${base}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Liber3 search failed');
  }
}

module.exports = new Liber3Service();

