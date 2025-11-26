const express = require('express');
const axios = require('axios');
const { parse } = require('node-html-parser');

const router = express.Router();

const normalizeUrl = (inputUrl = '') => {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const buildDisplayUrl = (urlObj) => {
  const hostname = urlObj.hostname.replace(/^www\./i, '');
  const firstPathSegment = urlObj.pathname.split('/').filter(Boolean)[0];
  return firstPathSegment ? `${hostname}/${firstPathSegment}` : hostname;
};

const absolutizeUrl = (value, baseUrl) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch (error) {
    return value;
  }
};

const getMetaContent = (root, names) => {
  for (const name of names) {
    const meta =
      root.querySelector(`meta[property="${name}"]`) ||
      root.querySelector(`meta[name="${name}"]`);
    const content = meta?.getAttribute('content');
    if (content) {
      return content.trim();
    }
  }
  return undefined;
};

const getFavicon = (root, baseUrl) => {
  const relSelectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'];
  for (const selector of relSelectors) {
    const node = root.querySelector(selector);
    const href = node?.getAttribute('href');
    if (href) {
      return absolutizeUrl(href, baseUrl);
    }
  }
  return undefined;
};

const buildSpecialCasePreview = (urlObj, overrideTitle) => {
  const hostname = urlObj.hostname.replace(/^www\./i, '');
  const pathParts = urlObj.pathname.split('/').filter(Boolean);

  if (hostname === 'music.yandex.ru') {
    const displayUrl = `music.yandex.ru${urlObj.pathname}`;
    const isTrack = pathParts.includes('track');
    const isAlbum = pathParts.includes('album');

    let title = 'Yandex Music';
    let description = 'Listen on Yandex Music';

    if (isTrack) {
      const trackIndex = pathParts.indexOf('track');
      const trackId = trackIndex !== -1 && trackIndex + 1 < pathParts.length ? pathParts[trackIndex + 1] : '';
      title = trackId ? `Track #${trackId} on Yandex Music` : 'Track on Yandex Music';
    } else if (isAlbum) {
      const albumIndex = pathParts.indexOf('album');
      const albumId = albumIndex !== -1 && albumIndex + 1 < pathParts.length ? pathParts[albumIndex + 1] : '';
      title = albumId ? `Album #${albumId} on Yandex Music` : 'Album on Yandex Music';
    }

    return {
      url: urlObj.toString(),
      title: overrideTitle || title,
      description,
      image: 'https://music.yandex.ru/blocks/meta/i/og-image.png',
      siteName: 'Yandex Music',
      favicon: 'https://music.yandex.ru/favicon.ico',
      displayUrl,
      previewUrl: 'https://music.yandex.ru/blocks/meta/i/og-image.png',
    };
  }

  if (hostname === 'youtube.com' || hostname === 'youtu.be') {
    let videoId = '';
    if (hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v') || '';
    } else if (hostname === 'youtu.be' && pathParts.length > 0) {
      videoId = pathParts[0];
    }

    if (videoId) {
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return {
        url: urlObj.toString(),
        title: overrideTitle || 'YouTube Video',
        description: 'Watch this video on YouTube',
        image: thumbnail,
        previewUrl: thumbnail,
        siteName: 'YouTube',
        favicon: 'https://www.youtube.com/favicon.ico',
        displayUrl: `${hostname}/watch`,
        youtubeVideoId: videoId,
      };
    }
  }

  if (hostname === 'meduza.io') {
    const displayUrl = `meduza.io${pathParts.length > 0 ? `/${pathParts[0]}` : ''}`;
    const image = 'https://meduza.io/image/social/meduza-share.png';
    return {
      url: urlObj.toString(),
      title: overrideTitle || 'Meduza',
      description: 'News from Meduza',
      image,
      previewUrl: image,
      siteName: 'Meduza',
      favicon: 'https://meduza.io/favicon.ico',
      displayUrl,
    };
  }

  return null;
};

const fetchPreviewViaApi = async (url, overrideTitle, displayUrl) => {
  const apiKey = process.env.LINK_PREVIEW_API_KEY || process.env.NEXT_PUBLIC_LINK_PREVIEW_API_KEY;
  if (!apiKey) {
    return null;
  }

  const apiUrl = `https://api.linkpreview.net/?key=${apiKey}&q=${encodeURIComponent(url)}`;
  const { data } = await axios.get(apiUrl, { timeout: 10000 });

  if (!data || data.error) {
    return null;
  }

  return {
    url,
    title: overrideTitle || data.title || '',
    description: data.description || '',
    image: data.image || undefined,
    previewUrl: data.image || undefined,
    siteName: data.title || undefined,
    favicon: data.favicon || undefined,
    displayUrl,
  };
};

const scrapePreview = async (urlObj, overrideTitle) => {
  const response = await axios.get(urlObj.toString(), {
    timeout: 10000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = response.data;
  const root = parse(html);

  const title =
    overrideTitle ||
    getMetaContent(root, ['og:title', 'twitter:title']) ||
    root.querySelector('title')?.text?.trim();

  const description = getMetaContent(root, ['og:description', 'description', 'twitter:description']);
  const image = absolutizeUrl(getMetaContent(root, ['og:image', 'twitter:image']), urlObj.toString());
  const siteName = getMetaContent(root, ['og:site_name']);
  const favicon = getFavicon(root, urlObj.toString());
  const displayUrl = buildDisplayUrl(urlObj);

  return {
    url: urlObj.toString(),
    title: title || displayUrl || urlObj.toString(),
    description,
    image,
    previewUrl: image,
    siteName,
    favicon,
    displayUrl,
  };
};

router.get('/', async (req, res) => {
  const { url, title: overrideTitle } = req.query;

  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return res.status(400).json({ success: false, error: 'Missing or invalid url parameter' });
  }

  try {
    const urlObj = new URL(normalizedUrl);
    const displayUrl = buildDisplayUrl(urlObj);

    const specialCase = buildSpecialCasePreview(urlObj, overrideTitle);
    if (specialCase) {
      return res.json({ success: true, data: specialCase, source: 'special-case' });
    }

    const apiPreview = await fetchPreviewViaApi(urlObj.toString(), overrideTitle, displayUrl);
    if (apiPreview) {
      return res.json({ success: true, data: apiPreview, source: 'linkpreview-api' });
    }

    const scrapedPreview = await scrapePreview(urlObj, overrideTitle);
    return res.json({ success: true, data: scrapedPreview, source: 'scrape' });
  } catch (error) {
    console.error('[link-preview] Failed to generate preview:', error.message);

    try {
      const fallbackUrl = normalizeUrl(url);
      const urlObj = fallbackUrl ? new URL(fallbackUrl) : null;
      const displayUrl = urlObj ? buildDisplayUrl(urlObj) : fallbackUrl;

      return res.json({
        success: true,
        data: {
          url: fallbackUrl,
          title: overrideTitle || fallbackUrl,
          displayUrl,
        },
        source: 'fallback',
      });
    } catch (innerError) {
      return res.status(500).json({ success: false, error: 'Unable to process URL' });
    }
  }
});

module.exports = router;


