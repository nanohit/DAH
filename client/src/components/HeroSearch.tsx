import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
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
  eyebrow?: string;
  title: string;
  description?: string;
  actionSlot?: ReactNode;
  items: BookRailItem[];
  loading?: boolean;
  emptyMessage?: string;
  onItemSearch: (item: BookRailItem) => void;
};

const MAX_RAIL_ITEMS = 24;

const BookRail = ({
  eyebrow,
  title,
  description,
  actionSlot,
  items,
  loading,
  emptyMessage,
  onItemSearch,
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
    if (maxScroll <= 2) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
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
  }, []);

  const showEmptyState = !loading && items.length === 0;
  const skeletons = Array.from({ length: 4 }, (_, index) => (
    <div
      key={`rail-skeleton-${index}`}
      className="w-full min-w-0 h-[110px] rounded-xl border border-gray-100 bg-gray-50 animate-pulse"
    />
  ));

  return (
    <div className="w-full">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold font-geometria mb-2">{eyebrow}</p>
      )}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-black font-geometria">{title}</h3>
            {actionSlot ? <div className="flex-shrink-0">{actionSlot}</div> : null}
          </div>
        </div>
        {description && <p className="text-sm text-gray-500 font-geometria">{description}</p>}
      </div>
      {showEmptyState ? (
        <div className="p-4 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500 font-geometria bg-gray-50/50">
          {emptyMessage || 'Пока нет данных.'}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            className="rail-scroll grid grid-flow-col auto-cols-[minmax(170px,1fr)] sm:auto-cols-[minmax(200px,1fr)] md:auto-cols-[minmax(230px,1fr)] lg:auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto overflow-y-hidden pb-3 pr-12 sm:pr-14 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {loading
              ? skeletons.map((skeleton, index) => (
                  <div key={`rail-skeleton-${index}`} className="w-full min-w-0 snap-start">
                    {skeleton}
                  </div>
                ))
              : items.map((item) => (
                  <div
                    key={item.id}
                    className="w-full min-w-0 min-h-[110px] rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex flex-col justify-between snap-start"
                  >
                    <div>
                      <h4
                        className="text-sm font-semibold text-gray-900 font-geometria leading-snug"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.title}
                      </h4>
                      {item.author && (
                        <p className="text-xs text-gray-600 font-geometria mt-1 truncate">{item.author}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onItemSearch(item)}
                      className="mt-3 inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-black border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-geometria"
                    >
                      <span>Найти</span>
                    </button>
                  </div>
                ))}
          </div>
          {!showEmptyState && items.length > 0 && (
            <>
              {showLeft && (
                <button
                  type="button"
                  onClick={() => {
                    scroll('left');
                    setTimeout(updateArrows, 300);
                  }}
                  aria-label="Прокрутить влево"
                  className="inline-flex absolute left-[-10px] top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
                >
                  ‹
                </button>
              )}
              {showRight && (
                <button
                  type="button"
                  onClick={() => {
                    scroll('right');
                    setTimeout(updateArrows, 300);
                  }}
                  aria-label="Прокрутить вправо"
                  className="inline-flex absolute right-[-10px] top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
                >
                  ›
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const SIMILAR_PREFIX = 'похоже на: ';
const SIMILAR_PREFIX_LOWER = SIMILAR_PREFIX.toLowerCase();
const RU_BETA_SUFFIX = ' (проверьте корректность названия на русском, функция в бете!)';

export const HeroSearch = ({ onForumRequest }: { onForumRequest?: () => void }) => {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  // To avoid hydration mismatch, use a deterministic initial placeholder, then randomize on mount
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
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const similarRequestIdRef = useRef(0);
  const historyIndexRef = useRef(-1);
  const personalFeedRequestRef = useRef(0);
  const personalFeedLoadingRequestRef = useRef<number | null>(null);
  const [lastTlMap, setLastTlMap] = useState<{ id: string; name: string } | null>(null);

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

  const handleRecommendationsRefresh = useCallback(async () => {
    await fetchPersonalFeed({ force: true });
  }, [fetchPersonalFeed]);

  const refreshRecommendationsFromDownloads = useCallback(async () => {
    // Use trackedDownloads to get up to 5 latest titles, query booksv similar, take results
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
        allRecs.push(...recs.slice(0, 6)); // keep it short per item
      } catch (err) {
        // ignore individual failures
      }
    }
    // Deduplicate by title+author
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
        // Refresh recs based on latest downloads (force server refresh + local fallback)
        await fetchPersonalFeed({ force: true });
        refreshRecommendationsFromDownloads().catch(() => {});
      } catch (registrationError) {
        console.warn('Failed to register download', registrationError);
      } finally {
        // Ensure UI updated even if forced refresh above failed
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

  useEffect(() => {
    fetchPersonalFeed();
  }, [fetchPersonalFeed]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLastTlMap(null);
      return;
    }

    const token = isBrowser ? localStorage.getItem('token') : null;
    if (!token) {
      setLastTlMap(null);
      return;
    }

    const controller = new AbortController();

    const loadLatestTlMap = async () => {
      try {
        const res = await fetch('/api/tl-maps', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0];
          setLastTlMap({
            id: latest._id,
            name: latest.name || 'Untitled Map',
          });
        } else {
          setLastTlMap(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Failed to load latest TL map', err);
      }
    };

    loadLatestTlMap();

    return () => controller.abort();
  }, [isAuthenticated]);

  const scrollToForum = () => {
    onForumRequest?.();
    const forumSection = document.getElementById('alphy-forum-feed');
    if (forumSection) {
      forumSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
          mergeResults(zlibraryResults, liber3Results) // p2p last
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

        // Try client-side fetch first (uses end-user network, bypasses server IP blocking)
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

        // Fallback to server proxy (may still fail if gateways block server IP)
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
        // English: prefer MOTW first, then p2p (Liber3). Skip Flibusta.
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
    }, 600); // match CSS animation duration

    return () => clearTimeout(timeout);
  }, [isFlipping, nextPlaceholder]);

  useEffect(() => {
    // Randomize placeholders after mount to avoid SSR/CSR mismatch
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
  const hasRailsContent = downloadRailItems.length > 0 || recommendationRailItems.length > 0;

  return (
    <>
      <section className="relative w-full overflow-hidden">
        <div className="relative flex flex-col">
          <div className="flex-1 w-full">
            <div className="max-w-5xl mx-auto mb-10 mt-3 px-3 sm:px-4 relative">
              {/* Title Section - compact, image removed on mobile */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4 mb-4">
                <div className="text-left w-full">
                  <h1 className="text-[20px] sm:text-[24px] md:text-[32px] font-medium text-black leading-tight font-geometria">
                    Бесплатный доступ к любой литературе.
                    <br />
                    Мощный инструмент работы с ней.
                  </h1>
                </div>
              </div>

              <div className="flex flex-row flex-nowrap items-stretch gap-2 max-w-4xl w-full">
                {/* Input Group */}
                <div className="flex items-start gap-2 w-full min-w-0">
                  {showHistoryControls && (
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => navigateHistory(-1)}
                        disabled={!canNavigateBack}
                        aria-label="Вернуться к предыдущему списку"
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-black disabled:opacity-50 disabled:hover:text-gray-500 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateHistory(1)}
                        disabled={!canNavigateForward}
                        aria-label="Перейти к следующему списку"
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-black disabled:opacity-50 disabled:hover:text-gray-500 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="flex-1 w-full relative group" ref={searchContainerRef}>
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
                      style={{
                        color: 'transparent',
                        caretColor: '#000',
                      }}
                      className="w-full h-12 px-4 bg-white text-black border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 transition-all duration-200 text-base font-geometria"
                    />

                    {!searchTerm && (
                      <div className="placeholder-wrapper">
                        <span
                          className={`placeholder-text ${
                            isFlipping ? 'flip-out' : 'flip-static'
                          }`}
                        >
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
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center px-4 font-geometria text-base whitespace-pre"
                      >
                        {shouldShowSimilarPrefixOverlay ? (
                          <>
                            <span className="text-gray-400 select-none">{overlayPrefixText}</span>
                            <span className="text-black select-none">{overlaySuffixText}</span>
                          </>
                        ) : (
                          <span className="text-black select-none">{searchTerm}</span>
                        )}
                        {shouldShowRuBetaHint && !isInputFocused && (
                          <span className="text-gray-400 select-none">{RU_BETA_SUFFIX}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Results Dropdown */}
                    {shouldRenderDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl overflow-hidden z-50 max-h-[65vh] overflow-y-auto border border-gray-200">
                        {resultsView === 'search' && error && (
                          <div className="p-4 text-red-600 bg-red-50 border-b border-red-100">
                            {error.message}
                          </div>
                        )}
                        {resultsView === 'similar' && similarError && (
                          <div className="p-4 text-red-600 bg-red-50 border-b border-red-100">
                            {similarError}
                          </div>
                        )}

                        {resultsView === 'similar' && (
                          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                            <p className="text-sm text-gray-700 font-geometria">
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
                                  ? 'flbst'
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
                              <div key={book.id} className="p-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3.5">
                                  <div className="space-y-1">
                                    <h3 className="text-base font-medium text-gray-900 font-geometria">{book.title}</h3>
                                    <p className="text-sm text-gray-600 font-geometria">{book.author}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
                                    {badgeLabel && (
                                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] uppercase text-gray-600 border border-gray-200 rounded-full font-geometria">
                                        {badgeLabel}
                                      </span>
                                    )}
                                    {book.formats
                                      .filter((format) => format.format !== 'mobi')
                                      .map((format) => (
                                        <button
                                          key={format.id ?? format.format}
                                          onClick={() => handleDownload(book, format)}
                                          className="px-2.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors font-semibold uppercase font-geometria flex items-center gap-1.5"
                                        >
                                          <span>{format.format}</span>
                                          {format.size && (
                                            <span className="text-[10px] text-gray-500 uppercase">
                                              {format.size}
                                            </span>
                                          )}
                                          {format.source === 'zlibrary' && (
                                            <span className="text-[9px] font-semibold text-purple-600">Z</span>
                                          )}
                                        </button>
                                      ))}
                                    {book.source === 'flibusta' && (
                                      <a
                                        href={`https://flibusta.is/b/${book.id}/read`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors font-semibold uppercase font-geometria"
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
                                        className="px-3 py-0.5 text-xs bg-white border border-gray-200 text-gray-700 rounded transition-colors font-semibold uppercase font-geometria hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1"
                                      >
                                        {isSimilarLoading && similarLoadingId === similarButtonId ? (
                                          <span className="inline-flex h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
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
                          <div className="p-8 text-center text-gray-500 font-geometria">
                            Ничего не найдено. Попробуйте другой запрос.
                          </div>
                        )}

                        {resultsView === 'similar' && isSimilarLoading && !similarSnapshot && (
                          <div className="p-8 text-center text-gray-500 font-geometria text-sm">
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
                                className="p-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3.5">
                                  <div className="space-y-1">
                                    {rec.goodreadsUrl ? (
                                      <a
                                        href={rec.goodreadsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-base font-medium text-gray-900 font-geometria hover:underline"
                                      >
                                        {rec.title}
                                      </a>
                                    ) : (
                                      <h3 className="text-base font-medium text-gray-900 font-geometria">{rec.title}</h3>
                                    )}
                                    <p className="text-sm text-gray-600 font-geometria">{rec.author}</p>
                                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] uppercase text-gray-400 tracking-[0.08em] font-semibold">
                        скачать
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleRecommendationAutoSearch({
                              recommendation: rec,
                              language: 'ru',
                            })
                          }
                          disabled={isAutoSearchBusy || isSimilarLoading}
                          className="px-2.5 py-0.5 text-xs bg-white border border-gray-200 text-gray-700 rounded font-semibold uppercase font-geometria hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center min-w-[44px]"
                        >
                          {ruLoading ? (
                            <span className="inline-flex h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                          ) : (
                            'Ru'
                          )}
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
                          className="px-2.5 py-0.5 text-xs bg-white border border-gray-200 text-gray-700 rounded font-semibold uppercase font-geometria hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center min-w-[44px]"
                        >
                          {engLoading ? (
                            <span className="inline-flex h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                          ) : (
                            'Eng'
                          )}
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
                      className="px-3 py-0.5 text-xs bg-white border border-gray-200 text-gray-700 rounded transition-colors font-semibold uppercase font-geometria hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1"
                    >
                      {isSimilarLoading && similarLoadingId === similarButtonId ? (
                        <span className="inline-flex h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
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
                            <div className="p-8 text-center text-gray-500 font-geometria">
                              {searchTerm.trim() === SIMILAR_PREFIX.trim()
                                ? 'Введите название книги и получите список похожих на неё книг'
                                : 'Нет рекомендаций для этой книги.'}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button - Separate button */}
                <button
                  onClick={() => {
                    handleSearch();
                    setIsResultsVisible(true);
                  }}
                  disabled={isLoading}
                  className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white text-gray-500 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-black transition-colors disabled:opacity-50 text-sm"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
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

              {/* Attached similar button */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  type="button"
                  onClick={insertSimilarPrefix}
                  className="inline-flex items-center px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg text-gray-700 hover:text-black hover:bg-gray-50 transition-colors font-geometria shadow-sm w-full sm:w-auto"
                  style={{
                    position: 'absolute',
                    left: '661px',
                    top: '142px',
                    width: '190px',
                    height: '27px',
                    textAlign: 'right',
                  }}
                >
                  или найти похожее на:
                </button>
              </div>

              {/* CTA Section */}
              <div className="mt-8 flex items-center gap-3 text-base text-black">
                {lastTlMap ? (
                  <>
                    <span className="font-medium font-geometria">или продолжите работать с</span>
                    <Link
                      href={`/map-canvas?id=${lastTlMap.id}`}
                      className="inline-flex items-center px-4 py-2.5 bg-white text-black font-semibold border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all hover:shadow-md font-geometria text-sm"
                    >
                      {lastTlMap.name}
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="font-medium font-geometria">либо начните с</span>
                    <Link 
                      href="/maps" 
                      className="inline-flex items-center px-4 py-2.5 bg-white text-black font-semibold border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all hover:shadow-md font-geometria text-sm"
                    >
                      создания новой доски <span className="ml-1.5 text-base leading-none">+</span>
                    </Link>
                  </>
                )}
              </div>

              {hasRailsContent && (
                <div className="mt-6 space-y-6">
                  {downloadRailItems.length > 0 && (
                    <BookRail
                      title="Недавно скачанные"
                      items={downloadRailItems}
                      loading={isPersonalFeedLoading && !downloadRailItems.length}
                      emptyMessage={
                        personalFeedError || 'Скачайте книгу, чтобы она появилась в вашем списке.'
                      }
                      onItemSearch={(item) => {
                        void handleSearch(item.title);
                        setIsResultsVisible(true);
                      }}
                    />
                  )}
                  {recommendationRailItems.length > 0 && (
                    <BookRail
                      title="Рекомендовано"
                      actionSlot={
                        <button
                          type="button"
                          onClick={handleRecommendationsRefresh}
                          disabled={isPersonalFeedLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-black border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          {isPersonalFeedLoading ? (
                            <span className="inline-flex h-3.5 w-3.5 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
                          ) : (
                            <span className="text-base leading-none">↻</span>
                          )}
                        </button>
                      }
                      items={recommendationRailItems}
                      loading={Boolean(
                        isPersonalFeedLoading &&
                          !recommendationRailItems.length &&
                          trackedDownloads.length
                      )}
                      emptyMessage={
                        personalFeedError ||
                        (trackedDownloads.length
                          ? 'Собираем рекомендации... Попробуйте позже.'
                          : 'Скачайте несколько книг, чтобы получить персональные рекомендации.')
                      }
                      onItemSearch={(item) => {
                        void handleSearch(item.title);
                        setIsResultsVisible(true);
                      }}
                    />
                  )}
                </div>
              )}

            </div>
          </div>

          {!trackedDownloads.length && (
            <div className="flex justify-center mt-1 mb-0 px-4">
              <div className="text-center max-w-xl">
                <p className="text-sm md:text-base text-gray-700 font-geometria italic leading-snug">
                  “The only thing that you absolutely have to know, is the location of the library.”
                </p>
                <p className="text-xs text-gray-500 font-geometria mt-2">— Albert Einstein</p>
              </div>
            </div>
          )}

          <div className="flex justify-center pb-2 px-4">
            <button
              onClick={scrollToForum}
              className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black transition-colors font-geometria"
            >
              <span className="font-geometria">сегодня на alphy</span>
              <span className="text-lg leading-none font-geometria">›</span>
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .placeholder-wrapper {
          position: absolute;
          left: 1rem;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          perspective: 800px;
          perspective-origin: center;
          color: #9ca3af;
          font-size: 0.9rem;
        }

        .placeholder-text {
          display: block;
          transform: rotateX(0deg);
          opacity: 1;
          transform-origin: center;
          transform-style: preserve-3d;
        }

        .placeholder-text.flip-static {
          transform: rotateX(0deg);
          opacity: 1;
        }

        .placeholder-text.flip-out {
          animation: flipOut 0.6s forwards;
          transform-origin: center;
        }

        .placeholder-text.flip-in {
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: center;
          transform-style: preserve-3d;
          animation: flipIn 0.6s forwards;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .rail-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        :global(.rail-scroll::-webkit-scrollbar) {
          display: none;
          width: 0;
          height: 0;
          background: transparent;
        }

        @keyframes flipOut {
          0% {
            transform: rotateX(0deg);
            opacity: 1;
          }
          100% {
            transform: rotateX(90deg);
            opacity: 0;
          }
        }

        @keyframes flipIn {
          0% {
            transform: rotateX(-90deg);
            opacity: 0;
          }
          100% {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};
