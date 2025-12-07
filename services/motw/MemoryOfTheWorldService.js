const axios = require('axios');
const url = require('url');

class MemoryOfTheWorldService {
  constructor() {
    this.baseApi = process.env.MOTW_API_BASE || 'https://books.memoryoftheworld.org';
    this.timeout =
      Number(process.env.MOTW_TIMEOUT_MS || process.env.MOTW_SEARCH_TIMEOUT_MS) || 12_000;
  }

  buildAbsolute(base, path) {
    if (!path) return undefined;
    const origin = base.startsWith('//') ? `https:${base}` : base;
    try {
      return new URL(path, origin).toString();
    } catch (e) {
      return encodeURI(url.resolve(origin, path));
    }
  }

  bytesToSize(bytes) {
    const b = Number(bytes);
    if (!b || Number.isNaN(b)) return undefined;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  mapItem(item) {
    const baseLib = item.library_url || '';
    const cover = this.buildAbsolute(baseLib, item.cover_url);

    const formats = (item.formats || []).map((f) => {
      const downloadPath = this.buildAbsolute(baseLib, `${f.dir_path}${f.file_name}`);
      return {
        id: `${item._id}-${f.format}`.toLowerCase(),
        format: (f.format || '').toUpperCase(),
        size: this.bytesToSize(f.size),
        source: 'motw',
        downloadPath,
      };
    });

    return {
      id: item._id,
      title: item.title || '',
      author: Array.isArray(item.authors) ? item.authors.join(', ') : item.authors || '',
      cover,
      source: 'motw',
      year: item.pubdate ? (item.pubdate || '').slice(0, 4) : undefined,
      formats,
    };
  }

  async search(query, field = 'title') {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    const safeField = field || 'title';
    const url = `${this.baseApi}/search/${encodeURIComponent(safeField)}/${encodeURIComponent(
      trimmed
    )}`;

    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: { Accept: 'application/json' },
    });

    const items = response.data?._items;
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((i) => this.mapItem(i)).filter((b) => b.formats && b.formats.length);
  }
}

module.exports = new MemoryOfTheWorldService();

