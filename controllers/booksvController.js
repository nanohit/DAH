const crypto = require('crypto');
const bookSvService = require('../services/booksv/BookSvService');
const BookDownloadProfile = require('../models/BookDownloadProfile');

const MAX_TRACKED_BOOKS = 120;
const MAX_DOWNLOADS_RESPONSE = 40;
const MAX_BULK_SEED_BOOKS = 70;
const MAX_RECOMMENDATIONS = 70;
const RECOMMENDATION_TTL_MS = 1000 * 60 * 60 * 6;
const DEFAULT_FILTER_TOP = false;

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const hashValue = (value = '') => crypto.createHash('sha256').update(value).digest('hex');

const extractClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded) && forwarded.length) {
    return forwarded[0];
  }
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    null
  );
};

const computeDownloadsFingerprint = (downloads = []) => {
  if (!downloads.length) {
    return '';
  }
  const hash = crypto.createHash('sha1');
  downloads.forEach((entry) => {
    hash.update(`${entry.titleNormalized}:${entry.authorNormalized}|`);
  });
  return hash.digest('hex');
};

const formatDownloads = (downloads = []) =>
  downloads.slice(0, MAX_DOWNLOADS_RESPONSE).map((entry) => ({
    id: entry._id ? entry._id.toString() : `${entry.titleNormalized}-${entry.authorNormalized}`,
    title: entry.title,
    author: entry.author,
    downloadedAt: entry.downloadedAt,
    source: entry.source,
    format: entry.format,
    bookSv: entry.bookSv
      ? {
          workId: entry.bookSv.workId,
          title: entry.bookSv.title,
          author: entry.bookSv.author,
        }
      : undefined,
  }));

const resolveProfile = async ({ userId, ipHash, lastIp, uaHash, createIfMissing = true }) => {
  let profile = null;

  if (userId) {
    profile = await BookDownloadProfile.findOne({ user: userId });
  }

  if (!profile && ipHash) {
    const query = { ipHash };
    if (userId) {
      query.$or = [{ user: userId }, { user: { $exists: false } }, { user: null }];
    }
    profile = await BookDownloadProfile.findOne(query).sort({ updatedAt: -1 });
    if (profile && userId && profile.user && profile.user.toString() !== userId) {
      profile = null;
    }
  }

  if (!profile) {
    if (!createIfMissing) {
      return { profile: null, mutated: false };
    }
    profile = new BookDownloadProfile({
      user: userId || undefined,
      ipHash: ipHash || undefined,
      lastIp: lastIp || '',
      uaHash: uaHash || '',
    });
    return { profile, mutated: true };
  }

  let mutated = false;

  if (userId && (!profile.user || profile.user.toString() !== userId)) {
    profile.user = userId;
    mutated = true;
  }

  if (ipHash && profile.ipHash !== ipHash) {
    profile.ipHash = ipHash;
    mutated = true;
  }

  if (lastIp && profile.lastIp !== lastIp) {
    profile.lastIp = lastIp;
    mutated = true;
  }

  if (uaHash && profile.uaHash !== uaHash) {
    profile.uaHash = uaHash;
    mutated = true;
  }

  return { profile, mutated };
};

const mapRecommendationPayload = (items = []) =>
  items.slice(0, MAX_RECOMMENDATIONS).map((item) => ({
    id: item.recommendationId,
    title: item.title,
    author: item.author,
    workId: item.workId,
    goodreadsUrl: item.goodreadsUrl,
  }));

const normalizeBookSvRecommendations = (items = []) => {
  const seen = new Set();
  const normalized = [];

  items.forEach((item) => {
    if (!item) {
      return;
    }
    const workId = Number(item.workID ?? item.workId);
    const bookId = Number(item.id ?? item.bookId);
    const recommendationId = String(
      Number.isFinite(workId)
        ? workId
        : Number.isFinite(bookId)
          ? bookId
          : `${item.title}-${item.authors?.[0]?.name || ''}`
    );
    if (seen.has(recommendationId)) {
      return;
    }
    seen.add(recommendationId);
    normalized.push({
      recommendationId,
      title: item.title || 'Unknown title',
      author: item.authors?.[0]?.name || item.author || '',
      workId: Number.isFinite(workId) ? workId : null,
      bookId: Number.isFinite(bookId) ? bookId : null,
      goodreadsUrl: Number.isFinite(bookId) ? `https://goodreads.com/book/show/${bookId}` : null,
    });
  });

  return normalized;
};

const resolveBookSvMetadata = async ({ title, author }) => {
  if (!title) {
    return null;
  }
  try {
    const lookup = await bookSvService.lookupTitle({ title, author });
    return lookup;
  } catch (error) {
    if (error?.code !== 'BOOKSV_TITLE_NOT_FOUND') {
      console.warn('book.sv lookup failed', title, error?.message || error);
    }
    return null;
  }
};

const buildBookSvPayload = (lookup, { fallbackTitle, fallbackAuthor, matchedAt }) => {
  if (!lookup?.workID) {
    return undefined;
  }
  return {
    workId: lookup.workID,
    bookId: lookup.id,
    title: lookup.title || fallbackTitle || '',
    author: lookup.authors?.[0]?.name || fallbackAuthor || '',
    matchedAt: matchedAt || new Date(),
  };
};

const ensureBookSvWorkIds = async (profile) => {
  const downloads = Array.isArray(profile.downloads) ? profile.downloads : [];
  const workIds = [];
  const seen = new Set();
  let mutated = false;

  for (const entry of downloads) {
    if (workIds.length >= MAX_BULK_SEED_BOOKS) {
      break;
    }

    let workId = entry.bookSv?.workId;
    if (!workId) {
      const lookup = await resolveBookSvMetadata({ title: entry.title, author: entry.author });
      if (lookup?.workID) {
        entry.bookSv = buildBookSvPayload(lookup, {
          fallbackTitle: entry.title,
          fallbackAuthor: entry.author,
          matchedAt: new Date(),
        });
        workId = lookup.workID;
        mutated = true;
      }
    }

    const numericWorkId = Number(workId);
    if (Number.isFinite(numericWorkId) && numericWorkId > 0 && !seen.has(numericWorkId)) {
      seen.add(numericWorkId);
      workIds.push(numericWorkId);
    }
  }

  return { workIds, mutated };
};

const fetchBulkRecommendations = async (workIds = []) => {
  if (!workIds.length) {
    return {
      seedsProcessed: 0,
      recommendations: [],
    };
  }

  try {
    const raw = await bookSvService.getBulkRecommendations({
      workIds,
      filterTop: DEFAULT_FILTER_TOP,
    });
    const normalized = normalizeBookSvRecommendations(raw).slice(0, MAX_RECOMMENDATIONS);

    return {
      seedsProcessed: workIds.length,
      recommendations: normalized,
    };
  } catch (error) {
    console.error('Failed to fetch bulk book.sv recommendations', error);
    return {
      seedsProcessed: workIds.length,
      recommendations: [],
    };
  }
};

const shouldReuseCache = (profile = {}) => {
  if (!profile.recommendationCache) {
    return false;
  }
  const { recommendationCache } = profile;
  if (!Array.isArray(recommendationCache.items) || recommendationCache.items.length === 0) {
    return false;
  }
  if (
    !recommendationCache.downloadsFingerprint ||
    recommendationCache.downloadsFingerprint !== profile.downloadsFingerprint
  ) {
    return false;
  }
  if (!recommendationCache.generatedAt) {
    return false;
  }
  return Date.now() - recommendationCache.generatedAt.getTime() < RECOMMENDATION_TTL_MS;
};

exports.getBookSvSimilar = async (req, res) => {
  const { title, author, workId: workIdParam, titleLang } = req.query;
  const workId = workIdParam ? Number(workIdParam) : undefined;

  if (!title && !workId) {
    return res.status(400).json({
      success: false,
      code: 'BOOKSV_TITLE_REQUIRED',
      message: 'Query parameter "title" or "workId" is required.',
    });
  }

  try {
    const data = await bookSvService.getSimilarRecommendations({
      title,
      author,
      workId,
      titleLang,
    });
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    const status =
      error.code === 'BOOKSV_TITLE_NOT_FOUND' ? 404 : error.code === 'BOOKSV_TITLE_REQUIRED' ? 400 : 502;

    return res.status(status).json({
      success: false,
      code: error.code || 'BOOKSV_UNKNOWN_ERROR',
      message: error.message || 'Failed to fetch recommendations from book.sv',
      details: error.details,
    });
  }
};

exports.registerBookDownload = async (req, res) => {
  try {
    const userId = req.user?._id ? req.user._id.toString() : null;
    const ip = extractClientIp(req);

    if (!userId && !ip) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine client identity.',
      });
    }

    const {
      title,
      author: rawAuthor = '',
      source: rawSource = 'unknown',
      bookId = '',
      format: rawFormat = '',
    } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Title is required.',
      });
    }

    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Normalized title is empty.',
      });
    }
    const author = typeof rawAuthor === 'string' ? rawAuthor : '';
    const normalizedAuthor = normalizeText(author);
    const source = typeof rawSource === 'string' && rawSource ? rawSource : 'unknown';
    const format = typeof rawFormat === 'string' ? rawFormat.toUpperCase() : '';

    const ipHash = ip ? hashValue(ip) : null;
    const uaRaw = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const uaHash = uaRaw ? hashValue(uaRaw) : '';

    const { profile } = await resolveProfile({
      userId,
      ipHash,
      lastIp: ip,
      uaHash,
      createIfMissing: true,
    });

    const duplicateIndex = profile.downloads.findIndex(
      (entry) => entry.titleNormalized === normalizedTitle && entry.authorNormalized === normalizedAuthor
    );

    if (duplicateIndex >= 0) {
      profile.downloads.splice(duplicateIndex, 1);
    }

    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const now = new Date();
    const lookup = await resolveBookSvMetadata({ title: trimmedTitle, author: trimmedAuthor });
    const bookSvPayload = buildBookSvPayload(lookup, {
      fallbackTitle: trimmedTitle,
      fallbackAuthor: trimmedAuthor,
      matchedAt: now,
    });

    const downloadEntry = {
      title: trimmedTitle,
      titleNormalized: normalizedTitle,
      author: trimmedAuthor,
      authorNormalized: normalizedAuthor,
      source,
      bookId: bookId ? String(bookId) : '',
      format,
      downloadedAt: now,
    };

    if (bookSvPayload) {
      downloadEntry.bookSv = bookSvPayload;
    }

    profile.downloads.unshift(downloadEntry);

    if (profile.downloads.length > MAX_TRACKED_BOOKS) {
      profile.downloads = profile.downloads.slice(0, MAX_TRACKED_BOOKS);
    }

    profile.downloadsFingerprint = computeDownloadsFingerprint(profile.downloads);
    if (!profile.recommendationCache) {
      profile.recommendationCache = {
        items: [],
        seedCount: 0,
        downloadsFingerprint: '',
      };
    } else {
      profile.recommendationCache.downloadsFingerprint = '';
    }

    await profile.save();

    return res.json({
      success: true,
      downloads: formatDownloads(profile.downloads),
      meta: {
        totalDownloads: profile.downloads.length,
      },
    });
  } catch (error) {
    console.error('Failed to register book download', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register book download.',
    });
  }
};

exports.getPersonalBookFeed = async (req, res) => {
  try {
    const userId = req.user?._id ? req.user._id.toString() : null;
    const ip = extractClientIp(req);

    if (!userId && !ip) {
      return res.json({
        success: true,
        downloads: [],
        recommendations: [],
        meta: {
          downloadCount: 0,
          recommendationCount: 0,
        },
      });
    }

    const ipHash = ip ? hashValue(ip) : null;
    const uaRaw = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const uaHash = uaRaw ? hashValue(uaRaw) : '';

    const { profile, mutated: profileMutated } = await resolveProfile({
      userId,
      ipHash,
      lastIp: ip,
      uaHash,
      createIfMissing: false,
    });

    if (!profile) {
      return res.json({
        success: true,
        downloads: [],
        recommendations: [],
        meta: {
          downloadCount: 0,
          recommendationCount: 0,
        },
      });
    }

    const downloads = formatDownloads(profile.downloads);
    let recommendations = Array.isArray(profile.recommendationCache?.items)
      ? profile.recommendationCache.items
      : [];
    let generatedAt = profile.recommendationCache?.generatedAt;
    let seedsProcessed = profile.recommendationCache?.seedCount || 0;

    let profileNeedsSave = profileMutated;
    let workIds = [];

    if (profile.downloads.length) {
      const ensureResult = await ensureBookSvWorkIds(profile);
      if (ensureResult.mutated) {
        profile.markModified('downloads');
        profileNeedsSave = true;
      }
      workIds = ensureResult.workIds;
    }

    if (workIds.length && !shouldReuseCache(profile)) {
      const syncResult = await fetchBulkRecommendations(workIds);
      recommendations = syncResult.recommendations;
      generatedAt = new Date();
      seedsProcessed = syncResult.seedsProcessed;
      profile.recommendationCache = {
        items: recommendations,
        generatedAt,
        seedCount: seedsProcessed,
        downloadsFingerprint: profile.downloadsFingerprint,
      };
      profileNeedsSave = true;
    }

    if (profileNeedsSave) {
      await profile.save();
    }

    return res.json({
      success: true,
      downloads,
      recommendations: mapRecommendationPayload(recommendations),
      meta: {
        downloadCount: profile.downloads.length,
        recommendationCount: recommendations.length,
        generatedAt,
        seedsProcessed,
      },
    });
  } catch (error) {
    console.error('Failed to fetch personal book feed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch download history.',
    });
  }
};

