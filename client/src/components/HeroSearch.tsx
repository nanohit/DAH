import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { BookResult, SearchError, BookFormat, SimilarRecommendation } from '@/types/books';
import { useAuth } from '@/context/AuthContext';

const isBrowser = typeof window !== 'undefined';
const isLocalhost =
  isBrowser &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0');
const disableZlibrary = isLocalhost || process.env.NEXT_PUBLIC_DISABLE_ZLIB === 'true';

type HistoryEntry =
  | {
      view: 'search';
      state: {
        term: string;
        results: BookResult[];
        error: SearchError | null;
      };
    }
  | {
      view: 'similar';
      state: {
        term: string;
        seedTitle: string;
        seedAuthor?: string;
        workId?: number;
        recommendations: SimilarRecommendation[];
      };
    };

type SimilarTriggerPayload = {
  id: string;
  title: string;
  author?: string;
  workId?: number | null;
  titleLang?: 'ru' | 'en';
};

const PLACEHOLDERS = [
  'Евгений Онегин...',
  'Мышление и речь',
  '',
  'Дюна...',
  'Матанализ учебник...',
  'Generation «П»...',
  'Zero to one...',
  'Гарри Поттер и методы рационального мышления....',
  'Посторонний....',
  'Steppenwolf...',
  'Маленький принц...',
  'Тихий Дон...',   
  'Норвежский лес....',
  'Манга Занимательная статистика....',
  'Задача трёх тел...',
];

type BookRailItem = {
  id: string;
  title: string;
  author?: string;
};

type TrackedDownload = {
  id: string;
  title: string;
  author?: string;
  downloadedAt?: string;
  source?: string;
  format?: string;
  bookSv?: {
    workId?: number;
    title?: string;
    author?: string;
  };
};

type PersonalRecommendationItem = {
  id: string;
  title: string;
  author?: string;
  workId?: number | null;
  goodreadsUrl?: string | null;
};

type BookRailProps = {
  title: string;
  items: BookRailItem[];
  loading?: boolean;
  onItemClick: (item: BookRailItem) => void;
};

const MAX_RAIL_ITEMS = 24;

const BookRail = ({
  title,
  items,
  loading,
  onItemClick,
}: BookRailProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    const node = scrollRef.current;
    if (!node) return;
    const scrollAmount = Math.max(node.clientWidth * 0.85, 240);
    const delta = direction === 'left' ? -scrollAmount : scrollAmount;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const updateArrows = () => {
    const node = scrollRef.current;
    if (!node) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
    const maxScroll = node.scrollWidth - node.clientWidth;
    setShowLeft(node.scrollLeft > 2);
    setShowRight(node.scrollLeft < maxScroll - 2);
  };

  useEffect(() => {
    updateArrows();
    const node = scrollRef.current;
    if (!node) return;
    const handler = () => updateArrows();
    node.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      node.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [items]);

  if (loading) {
    return (
      <div className="book-rail">
        <p className="book-rail-title">{title}</p>
        <div className="book-rail-scroll">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="book-rail-item skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="book-rail">
      <p className="book-rail-title">{title}</p>
      <div className="book-rail-container">
        {showLeft && (
          <button
            type="button"
            onClick={() => {
              scroll('left');
              setTimeout(updateArrows, 300);
            }}
            aria-label="Scroll left"
            className="book-rail-arrow book-rail-arrow-left"
          >
            ‹
          </button>
        )}
        <div ref={scrollRef} className="book-rail-scroll">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item)}
              className="book-rail-item"
            >
              <h4 className="book-rail-item-title">{item.title}</h4>
              {item.author && <p className="book-rail-item-author">{item.author}</p>}
            </button>
          ))}
        </div>
        {showRight && (
          <button
            type="button"
            onClick={() => {
              scroll('right');
              setTimeout(updateArrows, 300);
            }}
            aria-label="Scroll right"
            className="book-rail-arrow book-rail-arrow-right"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
};

const SIMILAR_PREFIX = 'похоже на: ';
const SIMILAR_PREFIX_LOWER = SIMILAR_PREFIX.toLowerCase();
const RU_BETA_SUFFIX = ' (проверьте корректность названия на русском, функция в бете!)';

type UserMapData = {
  _id: string;
  name: string;
};

interface HeroSearchProps {
  onShowForum?: () => void;
  // Backwards-compatible alias used by older callers
  onForumRequest?: () => void;
}

export const HeroSearch = ({ onShowForum, onForumRequest }: HeroSearchProps) => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRecentMap, setUserRecentMap] = useState<UserMapData | null>(null);
  const [popularBooks, setPopularBooks] = useState<BookRailItem[]>([]);
  const [error, setError] = useState<SearchError | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(PLACEHOLDERS[0]);
  const [nextPlaceholder, setNextPlaceholder] = useState(PLACEHOLDERS[1] ?? PLACEHOLDERS[0]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const [resultsView, setResultsView] = useState<'search' | 'similar'>('search');
  const [similarSnapshot, setSimilarSnapshot] = useState<{
    seedTitle: string;
    seedAuthor?: string;
    workId?: number;
    recommendations: SimilarRecommendation[];
  } | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const [similarLoadingId, setSimilarLoadingId] = useState<string | null>(null);
  const [autoSearchLoading, setAutoSearchLoading] = useState<{
    key: string;
    lang: 'ru' | 'en';
  } | null>(null);
  const [shouldShowRuBetaHint, setShouldShowRuBetaHint] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [trackedDownloads, setTrackedDownloads] = useState<TrackedDownload[]>([]);
  const [personalRecommendations, setPersonalRecommendations] = useState<PersonalRecommendationItem[]>([]);
  const [isPersonalFeedLoading, setIsPersonalFeedLoading] = useState(false);
  const [personalFeedError, setPersonalFeedError] = useState<string | null>(null);
  const [isToolHovered, setIsToolHovered] = useState(false);
  const [isBoardHovered, setIsBoardHovered] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const similarRequestIdRef = useRef(0);
  const historyIndexRef = useRef(-1);
  const personalFeedRequestRef = useRef(0);
  const personalFeedLoadingRequestRef = useRef<number | null>(null);

  const stripSimilarPrefix = (value: string) => {
    if (value.toLowerCase().startsWith(SIMILAR_PREFIX_LOWER)) {
      return value.slice(SIMILAR_PREFIX.length);
    }
    return value;
  };

  const resetHistory = () => {
    historyIndexRef.current = -1;
    setHistory([]);
    setHistoryIndex(-1);
  };

  const clearSimilarContext = () => {
    similarRequestIdRef.current += 1;
    setResultsView('search');
    setSimilarSnapshot(null);
    setSimilarError(null);
    setIsSimilarLoading(false);
    setSimilarLoadingId(null);
    setShouldShowRuBetaHint(false);
    resetHistory();
  };

  const fetchPersonalFeed = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const requestId = (personalFeedRequestRef.current += 1);
      if (!options?.silent) {
        personalFeedLoadingRequestRef.current = requestId;
        setIsPersonalFeedLoading(true);
      }
      try {
        const response = await api.get('/api/books/booksv/personal-feed', {
          params: { force: options?.force ? 'true' : undefined },
        });
        if (requestId !== personalFeedRequestRef.current) {
          return;
        }
        const downloadsPayload: TrackedDownload[] = Array.isArray(response.data?.downloads)
          ? response.data.downloads
          : [];
        const recommendationsPayload: PersonalRecommendationItem[] = Array.isArray(
          response.data?.recommendations
        )
          ? response.data.recommendations
          : [];
        setTrackedDownloads(downloadsPayload);
        setPersonalRecommendations(recommendationsPayload);
        setPersonalFeedError(null);
      } catch (feedError) {
        if (!options?.silent) {
          console.warn('Failed to load personal feed', feedError);
          setPersonalFeedError('Не удалось загрузить персональные подборки.');
        }
      } finally {
        if (!options?.silent && personalFeedLoadingRequestRef.current === requestId) {
          personalFeedLoadingRequestRef.current = null;
          setIsPersonalFeedLoading(false);
        }
      }
    },
    []
  );

  const refreshRecommendationsFromDownloads = useCallback(async () => {
    const latest = trackedDownloads.slice(0, 5);
    if (!latest.length) return;
    const allRecs: PersonalRecommendationItem[] = [];
    for (const item of latest) {
      try {
        const resp = await api.get('/api/books/booksv/similar', {
          params: { title: item.title, author: item.author },
        });
        const payload = resp.data?.data || resp.data;
        const recs: PersonalRecommendationItem[] = payload?.recommendations || [];
        allRecs.push(...recs.slice(0, 6));
      } catch (err) {
        // ignore individual failures
      }
    }
    const seen = new Set<string>();
    const deduped: PersonalRecommendationItem[] = [];
    for (const r of allRecs) {
      const key = `${r.title}|${r.author}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      }
    }
    setPersonalRecommendations(deduped.slice(0, MAX_RAIL_ITEMS));
  }, [trackedDownloads]);

  const recordDownload = useCallback(
    async (book: BookResult, format: BookFormat) => {
      const payload = {
        title: book.title,
        author: book.author,
        source: book.source,
        bookId: book.id,
        format: format.format,
      };

      try {
        const response = await api.post('/api/books/booksv/downloads', payload);
        const downloadsPayload: TrackedDownload[] = Array.isArray(response.data?.downloads)
          ? response.data.downloads
          : null;
        if (downloadsPayload) {
          setTrackedDownloads(downloadsPayload);
        }
        await fetchPersonalFeed({ force: true });
        refreshRecommendationsFromDownloads().catch(() => {});
      } catch (registrationError) {
        console.warn('Failed to register download', registrationError);
      } finally {
        await fetchPersonalFeed({ force: true, silent: true });
      }
    },
    [fetchPersonalFeed, refreshRecommendationsFromDownloads]
  );

  const applyHistoryEntry = (entry: HistoryEntry) => {
    if (entry.view === 'search') {
      setResultsView('search');
      setSearchTerm(entry.state.term);
      setSearchResults(entry.state.results);
      setError(entry.state.error);
      setSimilarSnapshot(null);
      setSimilarError(null);
    } else {
      setResultsView('similar');
      setSearchTerm(entry.state.term);
      setSimilarSnapshot({
        seedTitle: entry.state.seedTitle,
        seedAuthor: entry.state.seedAuthor,
        workId: entry.state.workId,
        recommendations: entry.state.recommendations,
      });
      setSimilarError(null);
    }
    setIsSimilarLoading(false);
    setSimilarLoadingId(null);
    setIsResultsVisible(true);
    setHasSearched(true);
    setShouldShowRuBetaHint(false);
  };

  const navigateHistory = (direction: -1 | 1) => {
    const nextIndex = historyIndex + direction;
    if (nextIndex < 0 || nextIndex >= history.length) {
      return;
    }
    setHistoryIndex(nextIndex);
    historyIndexRef.current = nextIndex;
    applyHistoryEntry(history[nextIndex]);
  };

  const replaceHistoryWithSearch = (entry: HistoryEntry) => {
    historyIndexRef.current = 0;
    setHistory([entry]);
    setHistoryIndex(0);
  };

  const pushHistoryEntry = (entry: HistoryEntry) => {
    setHistory((prev) => {
      const base = prev.slice(0, historyIndexRef.current + 1);
      const next = [...base, entry];
      const nextIndex = next.length - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return next;
    });
  };

  useEffect(() => {
    if (disableZlibrary) return;
    api.get('/api/books/zlibrary/warmup').catch(() => {});
  }, []);

  // Fetch user's most recent TLDRAW map
  useEffect(() => {
    const fetchUserMap = async () => {
      if (!isAuthenticated || !user?._id) {
        setUserRecentMap(null);
        return;
      }
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        // Fetch TLDRAW maps (the new canvas-based maps), not legacy maps
        const response = await api.get('/api/tl-maps', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(response.data) && response.data.length > 0) {
          // TL maps endpoint already filters by user, just sort by date
          const sortedMaps = [...response.data].sort((a: any, b: any) => {
            const dateA = new Date(a.lastSaved || a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.lastSaved || b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
          });
          setUserRecentMap({
            _id: sortedMaps[0]._id,
            name: sortedMaps[0].name || 'Безымянная доска'
          });
        }
      } catch (err) {
        console.warn('Failed to fetch user TL maps:', err);
      }
    };
    fetchUserMap();
  }, [isAuthenticated, user?._id]);

  // Fetch popular books for new users
  useEffect(() => {
    const fetchPopularBooks = async () => {
      try {
        const response = await api.get('/api/users/stats/popular-books');
        if (response.data?.books && Array.isArray(response.data.books)) {
          setPopularBooks(response.data.books);
        }
      } catch (err) {
        console.warn('Failed to fetch popular books:', err);
      }
    };
    fetchPopularBooks();
  }, []);

  useEffect(() => {
    fetchPersonalFeed();
  }, [fetchPersonalFeed]);

  const insertSimilarPrefix = () => {
    const prefix = SIMILAR_PREFIX;
    setSearchTerm(prefix);
    setResultsView('similar');
    setShouldShowRuBetaHint(false);
    setIsResultsVisible(true);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = prefix.length;
        inputRef.current.setSelectionRange(len, len);
      }
    });
  };

  const mapFlibustaResults = (results: BookResult[] = []) =>
    results.map((book) => ({
      ...book,
      source: 'flibusta' as const,
      formats: (book.formats || []).map((format) => ({
        ...format,
        source: 'flibusta' as const,
      })),
    }));

  const mapZlibraryResults = (results: BookResult[] = []) =>
    results.map((book) => ({
      ...book,
      source: 'zlibrary' as const,
      formats: (book.formats || []).map((format) => ({
        ...format,
        source: 'zlibrary' as const,
      })),
    }));

  const mapLiber3Results = (results: BookResult[] = []) =>
    results.map((book) => ({
      ...book,
      source: 'liber3' as const,
      formats: (book.formats || []).map((format) => ({
        ...format,
        source: 'liber3' as const,
      })),
    }));

  const mapMotwResults = (results: BookResult[] = []) =>
    results.map((book) => ({
      ...book,
      source: 'motw' as const,
      formats: (book.formats || []).map((format) => ({
        ...format,
        source: 'motw' as const,
      })),
    }));

  const mergeResults = (primary: BookResult[], secondary: BookResult[]) => {
    if (!secondary.length) {
      return primary;
    }

    const seen = new Set(
      primary.map((item) => `${item.source || 'flibusta'}-${item.id}`)
    );
    const merged = [...primary];

    secondary.forEach((book) => {
      const key = `${book.source || 'flibusta'}-${book.id}`;
      if (!seen.has(key)) {
        merged.push(book);
        seen.add(key);
      }
    });

    return merged;
  };

  const fetchFlibustaResults = async (term: string) => {
    const query = term.trim();
    if (!query) return [];
    const encodedQuery = encodeURIComponent(query);
    const response = await api.get(`/api/books/flibusta/search?query=${encodedQuery}`);
    return mapFlibustaResults(response.data?.data || []);
  };

  const fetchZlibraryResults = async (term: string) => {
    const query = term.trim();
    if (!query) return [];
    const encodedQuery = encodeURIComponent(query);
    const response = await api.get(`/api/books/zlibrary/search?query=${encodedQuery}`);
    return mapZlibraryResults(response.data?.data || []);
  };

  const fetchLiber3Results = async (term: string) => {
    const query = term.trim();
    if (!query) return [];
    const encodedQuery = encodeURIComponent(query);
    const response = await api.get(`/api/books/liber3/search?query=${encodedQuery}`);
    return mapLiber3Results(response.data?.data || []);
  };

  const fetchMotwResults = async (term: string) => {
    const query = term.trim();
    if (!query) return [];
    const encodedQuery = encodeURIComponent(query);
    const response = await api.get(`/api/books/motw/search?query=${encodedQuery}`);
    return mapMotwResults(response.data?.data || []);
  };

  const translateTitleToRussian = async (title: string, author?: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return null;
    }

    try {
      const response = await api.get('/api/books/wikidata/translate', {
        params: {
          title: normalizedTitle,
          author,
          direction: 'en_to_ru',
        },
      });
      const translated = response.data?.data?.title || response.data?.title;
      return translated?.trim() || null;
    } catch (translationError) {
      console.warn('Failed to translate title via Wikidata:', translationError);
      return null;
    }
  };

  const triggerManualSimilarSearch = (title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }
    const containsCyrillic = /[а-яё]/i.test(normalizedTitle);
    handleSimilarClick({
      id: `manual-${normalizedTitle}-${Date.now()}`,
      title: normalizedTitle,
      titleLang: containsCyrillic ? 'ru' : 'en',
    });
  };

  const handleSearch = async (termOverride?: string) => {
    const baseTerm = termOverride ?? searchTerm;
    const trimmedTerm = baseTerm.trim();
    if (!trimmedTerm) return;

    const normalizedLowerTerm = trimmedTerm.toLowerCase();
    if (normalizedLowerTerm.startsWith(SIMILAR_PREFIX_LOWER)) {
      const manualTitle = stripSimilarPrefix(trimmedTerm).trim();
      if (manualTitle) {
        setShouldShowRuBetaHint(false);
        triggerManualSimilarSearch(manualTitle);
      }
      return;
    }

    setShouldShowRuBetaHint(false);
    clearSimilarContext();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setIsResultsVisible(true);
    setSearchTerm(trimmedTerm);

    let searchError: SearchError | null = null;

    try {
      const encodedQuery = encodeURIComponent(trimmedTerm);
      let flibustaError: unknown = null;
      let zlibraryError: unknown = null;
      let liber3Error: unknown = null;
      let motwError: unknown = null;

      const flibustaPromise = api
        .get(`/api/books/flibusta/search?query=${encodedQuery}`)
        .then((res) => mapFlibustaResults(res.data?.data || []))
        .catch((err) => {
          flibustaError = err;
          console.warn('Flibusta search failed:', err);
          return [];
        });

      const zlibraryPromise = disableZlibrary
        ? Promise.resolve([])
        : api
            .get(`/api/books/zlibrary/search?query=${encodedQuery}`)
            .then((res) => mapZlibraryResults(res.data?.data || []))
            .catch((err) => {
              zlibraryError = err;
              console.warn('Z-Library search failed:', err);
              return [];
            });

      const liber3Promise = api
        .get(`/api/books/liber3/search?query=${encodedQuery}`)
        .then((res) => mapLiber3Results(res.data?.data || []))
        .catch((err) => {
          liber3Error = err;
          console.warn('Liber3 search failed:', err);
          return [];
        });

      const motwPromise: Promise<BookResult[]> = api
        .get(`/api/books/motw/search?query=${encodedQuery}`)
        .then((res) => mapMotwResults(res.data?.data || []))
        .catch((err) => {
          motwError = err;
          console.warn('MOTW search failed:', err);
          return [];
        });

      const flibustaResults = await flibustaPromise;
      setSearchResults(flibustaResults);

      const [zlibraryResults, liber3Results, motwResults] = await Promise.all<BookResult[]>([
        zlibraryPromise,
        liber3Promise,
        motwPromise,
      ]);

      const combinedResults = mergeResults(
        flibustaResults,
        mergeResults(
          motwResults,
          mergeResults(zlibraryResults, liber3Results)
        )
      );
      setSearchResults(combinedResults);
      setIsLoading(false);

      if (
        !flibustaResults.length &&
        !zlibraryResults.length &&
        !liber3Results.length &&
        !motwResults.length
      ) {
        const fallbackError = flibustaError || zlibraryError || liber3Error || motwError;
        const constructedError: SearchError = {
          message:
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Не удалось найти книги. Попробуйте другой запрос.',
          code: 'SEARCH_ERROR',
        };
        searchError = constructedError;
        setError(constructedError);
      }

      replaceHistoryWithSearch({
        view: 'search',
        state: {
          term: trimmedTerm,
          results: combinedResults,
          error: searchError,
        },
      });
    } catch (err) {
      console.error('Error searching books:', err);
      const constructedError: SearchError = {
        message: err instanceof Error ? err.message : 'Failed to search',
        code: 'SEARCH_ERROR',
      };
      searchError = constructedError;
      setError(constructedError);
      setSearchResults([]);
      setIsResultsVisible(true);
      setIsLoading(false);
      resetHistory();
    }
  };

  const handleDownload = async (book: BookResult, format: BookFormat) => {
    try {
      await recordDownload(book, format);
      if (format.source === 'zlibrary' && format.token) {
        const response = await api.get(`/api/books/zlibrary/download/${book.id}/${format.token}`);
        const downloadUrl: string | undefined = response.data?.data?.downloadUrl;
        if (!downloadUrl) {
          throw new Error('Download link is not available');
        }
        window.location.href = downloadUrl;
        return;
      }

      if (format.source === 'liber3' && format.downloadPath) {
        const mirrors = format.mirrors && format.mirrors.length ? format.mirrors : [format.downloadPath];

        for (const url of mirrors) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(url, { signal: controller.signal, mode: 'cors' });
            clearTimeout(timeout);
            if (resp.ok) {
              const blob = await resp.blob();
              const dlUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = dlUrl;
              a.download = `${book.title || format.id || 'book'}.${(format.format || 'bin').toLowerCase()}`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(dlUrl);
              return;
            }
          } catch (_) {
            // try next mirror
          }
        }

        if (format.cid) {
          window.location.href = `/api/books/liber3/download/${format.cid}`;
          return;
        }
        window.location.href = mirrors[0];
        return;
      }

      if (format.source === 'motw' && format.downloadPath) {
        window.location.href = format.downloadPath;
        return;
      }

      const proxyUrl =
        process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL || 'https://flibusta-proxy.alphy-flibusta.workers.dev';
      window.location.href = `${proxyUrl}/${book.id}/${format.format.toLowerCase()}`;
    } catch (error) {
      console.error('Error downloading book:', error);
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.code;
        const message = error.response?.data?.error;
        if (code === 'ZLIB_DAILY_LIMIT') {
          toast.error(message || 'Z-Library daily download limit is reached. Please try again later.');
          return;
        }
      }
      toast.error('Failed to download book. Please try again.');
    }
  };

  const handleSimilarClick = async ({ id, title, author, workId, titleLang }: SimilarTriggerPayload) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;

    setShouldShowRuBetaHint(false);
    setResultsView('similar');
    setSimilarSnapshot(null);
    setSimilarError(null);
    setIsSimilarLoading(true);
    setSimilarLoadingId(id);
    setSearchTerm(`${SIMILAR_PREFIX}${normalizedTitle}`);
    setIsResultsVisible(true);

    const requestId = (similarRequestIdRef.current += 1);

    const resolvedWorkIdParam = typeof workId === 'number' ? workId : undefined;

    try {
      const response = await api.get('/api/books/booksv/similar', {
        params: {
          title: normalizedTitle,
          author,
          workId: resolvedWorkIdParam,
          titleLang,
        },
      });

      const payload = response.data?.data || response.data;
      const recommendations: SimilarRecommendation[] = payload?.recommendations || [];
      const resolvedSeedTitle = payload?.seed?.title || normalizedTitle;
      const resolvedSeedAuthor = payload?.seed?.author || author || '';
      const resolvedWorkId = payload?.workId ?? resolvedWorkIdParam;
      const displayTerm = `${SIMILAR_PREFIX}${resolvedSeedTitle}`;

      if (requestId !== similarRequestIdRef.current) {
        return;
      }

      const snapshot = {
        seedTitle: resolvedSeedTitle,
        seedAuthor: resolvedSeedAuthor,
        workId: resolvedWorkId,
        recommendations,
      };

      setSimilarSnapshot(snapshot);
      setSimilarError(null);
      setSearchTerm(displayTerm);

      pushHistoryEntry({
        view: 'similar',
        state: {
          term: displayTerm,
          seedTitle: resolvedSeedTitle,
          seedAuthor: resolvedSeedAuthor,
          workId: resolvedWorkId,
          recommendations,
        },
      });
    } catch (err) {
      console.error('Error fetching similar books:', err);
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Не удалось получить похожие книги. Попробуйте другой запрос.';
      if (requestId === similarRequestIdRef.current) {
        setSimilarError(message);
        toast.error(message);
      }
    } finally {
      if (requestId === similarRequestIdRef.current) {
        setIsSimilarLoading(false);
        setSimilarLoadingId(null);
      }
    }
  };

  const handleRecommendationAutoSearch = async ({
    recommendation,
    language,
  }: {
    recommendation: SimilarRecommendation;
    language: 'ru' | 'en';
  }) => {
    const baseTitle = recommendation.title?.trim();
    if (!baseTitle) {
      return;
    }
    if (autoSearchLoading) {
      return;
    }

    const recommendationKey = String(recommendation.id ?? recommendation.title ?? '');
    const loadingKey = `${recommendationKey}-${language}`;

    if (language === 'en') {
      setSearchTerm(baseTitle);
      setShouldShowRuBetaHint(false);
    } else {
      setShouldShowRuBetaHint(false);
    }

    setAutoSearchLoading({ key: loadingKey, lang: language });
    setResultsView('search');
    setIsResultsVisible(true);
    setHasSearched(true);
    setIsLoading(true);
    setError(null);
    setSimilarError(null);
    setSearchResults([]);

    try {
      let resolvedTerm = baseTitle;
      let results: BookResult[] = [];
      let searchError: SearchError | null = null;

      if (language === 'ru') {
        const translated = await translateTitleToRussian(baseTitle, recommendation.author);
        if (translated) {
          resolvedTerm = translated;
        }

        results = await fetchFlibustaResults(resolvedTerm);

        if (!results.length && translated && translated !== baseTitle) {
          const fallbackResults = await fetchFlibustaResults(baseTitle);
          if (fallbackResults.length) {
            resolvedTerm = baseTitle;
            results = fallbackResults;
            searchError = {
              message: 'Не нашли русское издание, используем оригинальное название.',
              code: 'AUTO_SEARCH_FALLBACK',
              isWarning: true,
            };
          }
        }
      } else {
        const motw = await fetchMotwResults(baseTitle);
        const p2p = await fetchLiber3Results(baseTitle);
        results = [...motw, ...p2p];
      }

      if (!results.length) {
        searchError = {
          message:
            language === 'ru'
              ? 'Нет совпадений на Флибусте.'
              : 'Нет совпадений на Z-Library.',
          code: 'AUTO_SEARCH_EMPTY',
          isWarning: true,
        };
      }

      setSearchTerm(resolvedTerm);
      setSearchResults(results);
      setError(searchError);
      setShouldShowRuBetaHint(language === 'ru');

      pushHistoryEntry({
        view: 'search',
        state: {
          term: resolvedTerm,
          results,
          error: searchError,
        },
      });
    } catch (err) {
      console.error('Auto search error:', err);
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Не удалось выполнить поиск. Попробуйте позже.';
      const constructedError: SearchError = {
        message,
        code: 'AUTO_SEARCH_ERROR',
      };
      setSearchTerm(baseTitle);
      setShouldShowRuBetaHint(false);
      setError(constructedError);
      toast.error(message);
    } finally {
      setAutoSearchLoading((current) => (current?.key === loadingKey ? null : current));
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && shouldShowAutosuggest) {
      e.preventDefault();
      setSearchTerm(SIMILAR_PREFIX);
      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (node) {
          const nextPos = SIMILAR_PREFIX.length;
          node.setSelectionRange(nextPos, nextPos);
        }
      });
      return;
    }
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Schedule placeholder flip every 2 seconds
  useEffect(() => {
    if (isInputFocused || searchTerm.trim() || isFlipping) {
      return;
    }

    const interval = setInterval(() => {
      const candidates = PLACEHOLDERS.filter(
        (item) => item !== currentPlaceholder
      );

      const randomPlaceholder =
        candidates[Math.floor(Math.random() * candidates.length)] ??
        currentPlaceholder;

      setNextPlaceholder(randomPlaceholder);
      setIsFlipping(true);
    }, 2700);

    return () => clearInterval(interval);
  }, [isInputFocused, searchTerm, currentPlaceholder, isFlipping]);

  // Complete the flip after animation finishes
  useEffect(() => {
    if (!isFlipping) {
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentPlaceholder(nextPlaceholder);
      setIsFlipping(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [isFlipping, nextPlaceholder]);

  useEffect(() => {
    const idx = Math.floor(Math.random() * PLACEHOLDERS.length);
    const nextIdx = (idx + 1) % PLACEHOLDERS.length;
    setCurrentPlaceholder(PLACEHOLDERS[idx]);
    setNextPlaceholder(PLACEHOLDERS[nextIdx]);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isResultsVisible) return;
      if (searchContainerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsResultsVisible(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isResultsVisible]);

  const handleToolClick = () => {
    router.push('/tl-maps');
  };

  const forumCallback = onShowForum || onForumRequest;

  const handleBoardClick = () => {
    if (userRecentMap) {
      // Navigate to TLDRAW canvas editor with the map ID
      router.push(`/map-canvas?id=${userRecentMap._id}`);
    } else {
      // Create new TLDRAW canvas
      router.push('/map-canvas');
    }
  };

  const activeSimilarRecommendations = similarSnapshot?.recommendations || [];
  const isAutoSearchBusy = Boolean(autoSearchLoading);
  const lowerSearchTerm = searchTerm.toLowerCase();
  const hasFullSimilarPrefix = searchTerm.length > 0 && lowerSearchTerm.startsWith(SIMILAR_PREFIX_LOWER);
  const hasPartialSimilarPrefix =
    searchTerm.length > 0 &&
    SIMILAR_PREFIX_LOWER.startsWith(lowerSearchTerm) &&
    !hasFullSimilarPrefix;
  const shouldShowSimilarPrefixOverlay = hasFullSimilarPrefix || hasPartialSimilarPrefix;
  const overlayPrefixText = shouldShowSimilarPrefixOverlay ? SIMILAR_PREFIX : '';
  const overlaySuffixText = hasFullSimilarPrefix
    ? searchTerm.slice(SIMILAR_PREFIX.length)
    : shouldShowSimilarPrefixOverlay
      ? ''
      : searchTerm;
  const shouldShowAutosuggest = hasPartialSimilarPrefix;
  const shouldRenderDropdown =
    isResultsVisible &&
    (resultsView === 'similar' ||
      searchResults.length > 0 ||
      error ||
      (hasSearched && !isLoading && searchResults.length === 0));
  const showHistoryControls = history.length > 1;
  const canNavigateBack = historyIndex > 0;
  const canNavigateForward = historyIndex >= 0 && historyIndex < history.length - 1;
  const downloadRailItems: BookRailItem[] = trackedDownloads.slice(0, MAX_RAIL_ITEMS).map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author,
  }));
  const recommendationRailItems: BookRailItem[] = personalRecommendations.slice(0, MAX_RAIL_ITEMS).map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author,
  }));
  const hasDownloads = downloadRailItems.length > 0;
  
  // For new users without downloads, show popular books instead of recommendations
  const displayRecommendations = hasDownloads ? recommendationRailItems : popularBooks;
  const recommendationTitle = hasDownloads ? 'Рекомендовано:' : 'Популярно на alphy:';

  return (
    <>
      <section className="hero-section">
        <div className="hero-content">
          {/* Title Section */}
          <div className="title-section">
            <h1 className="hero-title">
              Бесплатный доступ к любым книгам
            </h1>
            <h2 className="hero-subtitle">
              <button
                type="button"
                className={`tool-button ${isToolHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setIsToolHovered(true)}
                onMouseLeave={() => setIsToolHovered(false)}
                onClick={handleToolClick}
              >
                <span className="tool-text">Мощный инструмент</span>
                <span className="tool-fill" />
              </button>
              {' '}работы с ними
            </h2>
          </div>

          {/* Search Bar Container with "найти похожее" positioned half-on */}
          <div className="search-wrapper">
            <button
              type="button"
              onClick={insertSimilarPrefix}
              className="similar-button"
            >
              или найти похожее
            </button>
            
            {/* Search Bar */}
            <div className="search-row">
            {showHistoryControls && (
              <div className="history-controls">
                <button
                  type="button"
                  onClick={() => navigateHistory(-1)}
                  disabled={!canNavigateBack}
                  aria-label="Back"
                  className="history-btn"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => navigateHistory(1)}
                  disabled={!canNavigateForward}
                  aria-label="Forward"
                  className="history-btn"
                >
                  ›
                </button>
              </div>
            )}
            <div className="search-container" ref={searchContainerRef}>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (resultsView === 'similar' || history.length > 0) {
                    clearSimilarContext();
                  }
                  setSearchTerm(nextValue);
                  setShouldShowRuBetaHint(false);
                  if (nextValue === '') {
                    setSearchResults([]);
                    setError(null);
                    setHasSearched(false);
                    setIsResultsVisible(false);
                    resetHistory();
                  }
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  setIsInputFocused(true);
                  setShouldShowRuBetaHint(false);
                  setIsFlipping(false);
                  if (hasSearched) {
                    setIsResultsVisible(true);
                  }
                }}
                onBlur={() => setIsInputFocused(false)}
                placeholder=""
                aria-label="Search books"
                className="search-input"
              />

              {!searchTerm && (
                <div className="placeholder-wrapper">
                  <span className={`placeholder-text ${isFlipping ? 'flip-out' : 'flip-static'}`}>
                    {currentPlaceholder}
                  </span>
                  {isFlipping && (
                    <span className="placeholder-text flip-in">
                      {nextPlaceholder}
                    </span>
                  )}
                </div>
              )}

              {searchTerm && (
                <div className="search-overlay" aria-hidden="true">
                  {shouldShowSimilarPrefixOverlay ? (
                    <>
                      <span className="overlay-prefix">{overlayPrefixText}</span>
                      <span className="overlay-suffix">{overlaySuffixText}</span>
                    </>
                  ) : (
                    <span className="overlay-suffix">{searchTerm}</span>
                  )}
                  {shouldShowRuBetaHint && !isInputFocused && (
                    <span className="overlay-hint">{RU_BETA_SUFFIX}</span>
                  )}
                </div>
              )}
              
              {/* Results Dropdown */}
              {shouldRenderDropdown && (
                <div className="results-dropdown">
                  {resultsView === 'search' && error && (
                    <div className="error-message">
                      {error.message}
                    </div>
                  )}
                  {resultsView === 'similar' && similarError && (
                    <div className="error-message">
                      {similarError}
                    </div>
                  )}

                  {resultsView === 'similar' && (
                    <div className="similar-header">
                      <p>
                        Похожие книги на{' '}
                        <span className="font-semibold">
                          {similarSnapshot?.seedTitle || stripSimilarPrefix(searchTerm)}
                        </span>
                        {similarSnapshot?.seedAuthor && (
                          <span className="text-gray-500">{' '}by {similarSnapshot.seedAuthor}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {resultsView === 'search' &&
                    searchResults.map((book) => {
                      const badgeLabel =
                        book.source === 'zlibrary'
                          ? 'zlb'
                          : book.source === 'flibusta'
                            ? 'ft'
                            : book.source === 'liber3'
                              ? 'p2p'
                              : book.source === 'motw'
                                ? 'motw'
                              : book.source || '';
                      const canShowSimilar =
                        book.source === 'zlibrary' ||
                        book.source === 'flibusta' ||
                        book.source === 'liber3' ||
                        book.source === 'motw';
                      const similarButtonId = `${book.source || 'book'}-${book.id}`;
                      const titleLang = book.source === 'flibusta' ? 'ru' : 'en';

                      return (
                        <div key={book.id} className="result-item">
                          <div className="result-content">
                            <div className="result-info">
                              <h3 className="result-title">{book.title}</h3>
                              <p className="result-author">{book.author}</p>
                            </div>
                            <div className="result-actions">
                              {badgeLabel && (
                                <span className="source-badge">
                                  {badgeLabel}
                                </span>
                              )}
                              {book.formats
                                .filter((format) => format.format !== 'mobi')
                                .map((format) => (
                                  <button
                                    key={format.id ?? format.format}
                                    onClick={() => handleDownload(book, format)}
                                    className="format-btn"
                                  >
                                    <span>{format.format}</span>
                                    {format.size && (
                                      <span className="format-size">
                                        {format.size}
                                      </span>
                                    )}
                                    {format.source === 'zlibrary' && (
                                      <span className="zlib-badge">Z</span>
                                    )}
                                  </button>
                                ))}
                              {book.source === 'flibusta' && (
                                <a
                                  href={`https://flibusta.is/b/${book.id}/read`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="format-btn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  READ
                                </a>
                              )}
                              {canShowSimilar && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSimilarClick({
                                      id: similarButtonId,
                                      title: book.title,
                                      author: book.author,
                                      titleLang,
                                    })
                                  }
                                  disabled={isSimilarLoading && similarLoadingId === similarButtonId}
                                  className="similar-action-btn"
                                >
                                  {isSimilarLoading && similarLoadingId === similarButtonId ? (
                                    <span className="spinner" />
                                  ) : null}
                                  <span>Похожее</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {resultsView === 'search' && !isLoading && hasSearched && searchResults.length === 0 && !error && (
                    <div className="empty-message">
                      Ничего не найдено. Попробуйте другой запрос.
                    </div>
                  )}

                  {resultsView === 'similar' && isSimilarLoading && !similarSnapshot && (
                    <div className="empty-message">
                      Загружаем похожие книги...
                    </div>
                  )}

                  {resultsView === 'similar' &&
                    !isSimilarLoading &&
                    !similarError &&
                    activeSimilarRecommendations.map((rec) => {
                      const similarButtonId =
                        rec.workId != null
                          ? `booksv-${rec.workId}`
                          : `${rec.id ?? rec.title}`;
                      const recommendationKey = String(rec.id ?? rec.title);
                      const ruLoading = autoSearchLoading?.key === `${recommendationKey}-ru`;
                      const engLoading = autoSearchLoading?.key === `${recommendationKey}-en`;
                      return (
                        <div
                          key={rec.id ?? rec.title}
                          className="result-item"
                        >
                          <div className="result-content">
                            <div className="result-info">
                              {rec.goodreadsUrl ? (
                                <a
                                  href={rec.goodreadsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="result-title-link"
                                >
                                  {rec.title}
                                </a>
                              ) : (
                                <h3 className="result-title">{rec.title}</h3>
                              )}
                              <p className="result-author">{rec.author}</p>
                            </div>
                            <div className="result-actions">
                              <div className="download-group">
                                <span className="download-label">скачать</span>
                                <div className="download-buttons">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecommendationAutoSearch({
                                        recommendation: rec,
                                        language: 'ru',
                                      })
                                    }
                                    disabled={isAutoSearchBusy || isSimilarLoading}
                                    className="lang-btn"
                                  >
                                    {ruLoading ? <span className="spinner" /> : 'Ru'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecommendationAutoSearch({
                                        recommendation: rec,
                                        language: 'en',
                                      })
                                    }
                                    disabled={isAutoSearchBusy || isSimilarLoading}
                                    className="lang-btn"
                                  >
                                    {engLoading ? <span className="spinner" /> : 'Eng'}
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSimilarClick({
                                    id: similarButtonId,
                                    title: rec.title,
                                    author: rec.author,
                                    workId: rec.workId,
                                    titleLang: 'en',
                                  })
                                }
                                disabled={isSimilarLoading && similarLoadingId === similarButtonId}
                                className="similar-action-btn"
                              >
                                {isSimilarLoading && similarLoadingId === similarButtonId ? (
                                  <span className="spinner" />
                                ) : null}
                                <span>Похожее</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {resultsView === 'similar' &&
                    !isSimilarLoading &&
                    !similarError &&
                    activeSimilarRecommendations.length === 0 && (
                      <div className="empty-message">
                        {searchTerm.trim() === SIMILAR_PREFIX.trim()
                          ? 'Введите название книги и получите список похожих на неё книг'
                          : 'Нет рекомендаций для этой книги.'}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={() => {
                handleSearch();
                setIsResultsVisible(true);
              }}
              disabled={isLoading}
              className="submit-btn"
            >
              {isLoading ? (
                <div className="spinner-large" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </button>
            </div>

            {/* "или начните работать на доске +" under search bar */}
            <div className="board-action-row">
              <span className="board-action-text">или</span>
              {userRecentMap ? (
                <>
                  <span className="board-action-text">&nbsp;продолжите работу с&nbsp;</span>
                  <button
                    type="button"
                    className={`board-button ${isBoardHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => setIsBoardHovered(true)}
                    onMouseLeave={() => setIsBoardHovered(false)}
                    onClick={handleBoardClick}
                  >
                    <span className="board-text">{userRecentMap.name}</span>
                    <span className="board-fill" />
                  </button>
                </>
              ) : (
                <>
                  <span className="board-action-text">&nbsp;начните&nbsp;</span>
                  <span className="board-action-text">работать на&nbsp;</span>
                  <button
                    type="button"
                    className={`board-button ${isBoardHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => setIsBoardHovered(true)}
                    onMouseLeave={() => setIsBoardHovered(false)}
                    onClick={handleBoardClick}
                  >
                    <span className="board-text">доске  +</span>
                    <span className="board-fill" />
                  </button>
                  <span className="board-action-text">&nbsp;</span>
                </>
              )}
            </div>
          </div>

          {/* Book Rails Section - for users with downloads */}
          {hasDownloads && (
            <div className="rails-section">
              <BookRail
                title="Скачано:"
                items={downloadRailItems}
                loading={isPersonalFeedLoading && !downloadRailItems.length}
                onItemClick={(item) => {
                  void handleSearch(item.title);
                  setIsResultsVisible(true);
                }}
              />
              {displayRecommendations.length > 0 && (
                <BookRail
                  title={recommendationTitle}
                  items={displayRecommendations}
                  loading={isPersonalFeedLoading && !displayRecommendations.length}
                  onItemClick={(item) => {
                    void handleSearch(item.title);
                    setIsResultsVisible(true);
                  }}
                />
              )}
            </div>
          )}

          {/* Quote for users without downloads */}
          {!hasDownloads && (
            <div className="quote-section">
              <p className="quote-text">
                "The only thing that you absolutely have to know, is the location of the library."
              </p>
              <p className="quote-author">— Albert Einstein</p>
            </div>
          )}

          {/* Popular books section - positioned at bottom for non-registered users */}
          {!hasDownloads && displayRecommendations.length > 0 && (
            <div className="rails-section rails-section-bottom">
              <BookRail
                title={recommendationTitle}
                items={displayRecommendations}
                loading={isPersonalFeedLoading}
                onItemClick={(item) => {
                  void handleSearch(item.title);
                  setIsResultsVisible(true);
                }}
              />
            </div>
          )}

          {/* "перейти на форум >" button */}
          {forumCallback && (
            <button
              type="button"
              onClick={forumCallback}
              className="forum-trigger"
            >
              перейти на форум <span className="forum-arrow">›</span>
            </button>
          )}
        </div>
      </section>

      <style jsx>{`
        .hero-section {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 24px;
        }

        .hero-content {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding-top: 20px;
          padding-left: 40px;
          padding-bottom: 10px;
          margin: 0 auto;
        }

        .title-section {
          text-align: left;
          margin-bottom: 20px;
          width: 100%;
        }

        .hero-title {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 32px;
          font-weight: 700;
          color: white;
          margin: 0 0 6px 0;
          line-height: 1.25;
        }

        .hero-subtitle {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 32px;
          font-weight: 700;
          color: white;
          margin: 0;
          line-height: 1.25;
        }

        .tool-button {
          position: relative;
          display: inline-block;
          padding: 6px 14px;
          background: transparent;
          border: 2px solid rgba(255, 255, 255, 0.9);
          border-radius: 10px;
          color: white;
          font-family: inherit;
          font-size: inherit;
          font-weight: inherit;
          cursor: pointer;
          overflow: hidden;
          transition: color 0.35s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.35s ease;
        }

        .tool-button:active {
          transform: scale(0.98);
        }

        .tool-text {
          position: relative;
          z-index: 2;
          transition: color 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tool-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 0%;
          height: 100%;
          background: white;
          z-index: 1;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tool-button.hovered .tool-fill {
          width: 100%;
        }

        .tool-button.hovered .tool-text {
          color: black;
        }

        .tool-button.hovered {
          border-color: white;
        }

        .search-wrapper {
          width: 100%;
          max-width: 760px;
          position: relative;
        }

        .similar-button {
          position: absolute;
          right: 60px;
          top: -14px;
          z-index: 10;
          padding: 6px 16px;
          background: rgba(30, 30, 30, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          color: rgba(255, 255, 255, 0.85);
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .similar-button:hover {
          background: rgba(50, 50, 50, 0.7);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .history-controls {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .history-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .history-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .history-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .search-container {
          flex: 1;
          position: relative;
        }

        .search-input {
          width: 100%;
          height: 56px;
          padding: 0 24px;
          background: white;
          border: none;
          border-radius: 14px;
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
          color: transparent;
          caret-color: #000;
          outline: none;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }

        .placeholder-wrapper {
          position: absolute;
          left: 24px;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          perspective: 800px;
          color: #9ca3af;
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
        }

        .board-action-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin-top: 20px;
          gap: 0;
          width: 100%;
        }

        .board-action-text {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.65);
          letter-spacing: 0.01em;
        }

        .board-action-text.spaced {
          margin-right: 6px;
        }

        .board-button {
          position: relative;
          display: inline-block;
          padding: 5px 14px;
          margin: 0 4px;
          background: transparent;
          border: 1.5px solid rgba(255, 255, 255, 0.5);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 18px;
          font-weight: 500;
          cursor: pointer;
          overflow: hidden;
          transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease;
        }

        .board-button:active {
          transform: scale(0.98);
        }

        .board-text {
          position: relative;
          z-index: 2;
          transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .board-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 0%;
          height: 100%;
          background: rgba(255, 255, 255, 0.9);
          z-index: 1;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .board-button.hovered .board-fill {
          width: 100%;
        }

        .board-button.hovered .board-text {
          color: black;
        }

        .board-button.hovered {
          border-color: rgba(255, 255, 255, 0.9);
        }

        .forum-trigger {
          margin-top: 16px;
          padding: 10px 24px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          align-self: center;
          width: 100%;
          text-align: center;
        }

        .forum-trigger:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .forum-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
          margin-left: 4px;
        }

        .forum-trigger:hover .forum-arrow {
          transform: translateX(4px);
        }

        .placeholder-text {
          display: block;
          transform-origin: center;
        }

        .placeholder-text.flip-static {
          transform: rotateX(0deg);
          opacity: 1;
        }

        .placeholder-text.flip-out {
          animation: flipOut 0.6s forwards;
        }

        .placeholder-text.flip-in {
          position: absolute;
          left: 0;
          top: 0;
          animation: flipIn 0.6s forwards;
        }

        .search-overlay {
          position: absolute;
          left: 24px;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
          white-space: pre;
        }

        .overlay-prefix {
          color: #9ca3af;
        }

        .overlay-suffix {
          color: #000;
        }

        .overlay-hint {
          color: #9ca3af;
        }

        .submit-btn {
          width: 56px;
          height: 56px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: none;
          border-radius: 14px;
          color: #555;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }

        .submit-btn:hover:not(:disabled) {
          color: #000;
          transform: translateX(2px);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .rails-section {
          width: 100%;
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: visible;
          padding-bottom: 0;
        }

        .rails-section-bottom {
          margin-top: 20px;
        }

        .quote-section {
          margin-top: 40px;
          text-align: center;
          padding: 0 20px;
        }

        .quote-text {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
          font-style: normal;
          color: rgba(255, 255, 255, 0.65);
          margin: 0 0 10px 0;
          line-height: 1.5;
        }

        .quote-author {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.45);
          margin: 0;
        }

        /* Results Dropdown */
        .results-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-height: 65vh;
          overflow-y: auto;
          z-index: 50;
        }

        .error-message {
          padding: 16px;
          color: #dc2626;
          background: #fef2f2;
          border-bottom: 1px solid #fecaca;
        }

        .similar-header {
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 14px;
          color: #374151;
        }

        .result-item {
          padding: 14px 16px;
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.15s ease;
        }

        .result-item:hover {
          background: #f9fafb;
        }

        .result-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .result-info {
          flex: 1;
          min-width: 0;
        }

        .result-title {
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .result-title-link {
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: #111827;
          text-decoration: none;
        }

        .result-title-link:hover {
          text-decoration: underline;
        }

        .result-author {
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .result-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .format-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #374151;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .format-btn:hover {
          background: #e5e7eb;
        }

        .format-size {
          font-size: 10px;
          color: #9ca3af;
        }

        .zlib-badge {
          font-size: 9px;
          font-weight: 600;
          color: #7c3aed;
        }

        .similar-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .similar-action-btn:hover:not(:disabled) {
          background: #f9fafb;
        }

        .similar-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .download-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .download-label {
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.05em;
        }

        .download-buttons {
          display: flex;
          gap: 6px;
        }

        .lang-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          padding: 4px 10px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .lang-btn:hover:not(:disabled) {
          background: #f9fafb;
        }

        .lang-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty-message {
          padding: 32px;
          text-align: center;
          font-family: 'Geometria', 'Manrope', system-ui, sans-serif;
          font-size: 14px;
          color: #6b7280;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #e5e7eb;
          border-top-color: #374151;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spinner-large {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top-color: #374151;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes flipOut {
          0% { transform: rotateX(0deg); opacity: 1; }
          100% { transform: rotateX(90deg); opacity: 0; }
        }

        @keyframes flipIn {
          0% { transform: rotateX(-90deg); opacity: 0; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }

        @media (max-width: 768px) {
          .hero-content {
            padding-top: 24px;
            padding-left: 16px;
            align-items: flex-start;
          }

          .title-section {
            text-align: left;
          }

          .hero-title,
          .hero-subtitle {
            font-size: 24px;
          }

          .search-wrapper {
            max-width: 100%;
          }

          .similar-button {
            right: 50px;
            top: -12px;
            font-size: 12px;
            padding: 5px 12px;
          }

          .search-row {
            flex-wrap: wrap;
          }

          .search-input {
            height: 50px;
            font-size: 16px;
          }

          .submit-btn {
            width: 50px;
            height: 50px;
          }

          .board-action-row {
            flex-wrap: wrap;
            justify-content: flex-start;
          }

          .board-action-text {
            font-size: 15px;
          }

          .board-button {
            font-size: 15px;
            padding: 4px 10px;
          }

          .rails-section {
            margin-top: 25px;
            gap: 14px;
          }

          .rails-section-bottom {
            margin-top: 16px;
          }

          .forum-trigger {
            margin-top: 14px;
            align-self: center;
            text-align: center;
          }

          .quote-section {
            margin-top: 30px;
          }

          .result-content {
            flex-direction: column;
          }

          .result-actions {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Book Rail Styles */
        .book-rail {
          width: 100%;
          overflow: visible;
        }

        .book-rail-title {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: white;
          margin: 0 0 14px 0;
        }

        .book-rail-container {
          position: relative;
          overflow: visible;
          padding: 10px 0;
          margin: -10px 0;
        }

        .book-rail-scroll {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          overflow-y: visible;
          padding: 10px 50px 10px 0;
          margin: -10px 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-snap-type: x mandatory;
        }

        .book-rail-scroll::-webkit-scrollbar {
          display: none;
        }

        .book-rail-item {
          flex: 0 0 auto;
          width: 180px;
          min-height: 100px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          text-align: left;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          scroll-snap-align: start;
        }

        .book-rail-item:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-5px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .book-rail-item:active {
          transform: translateY(-2px) scale(0.98);
        }

        .book-rail-item.skeleton {
          background: rgba(255, 255, 255, 0.06);
          animation: pulse 1.5s ease-in-out infinite;
        }

        .book-rail-item-title {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin: 0 0 6px 0;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .book-rail-item-author {
          font-family: 'Geometria', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .book-rail-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 50%;
          color: white;
          font-size: 26px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        .book-rail-arrow-left {
          left: -10px;
        }

        .book-rail-arrow-right {
          right: 0;
        }

        .book-rail-arrow:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-50%) scale(1.05);
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
};
