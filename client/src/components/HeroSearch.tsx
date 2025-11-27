import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { BookResult, SearchError, BookFormat } from '@/components/Search/FlibustaSearch';

const PLACEHOLDERS = [
  'Евгений Онегин...',
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

export const HeroSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(PLACEHOLDERS[0]);
  const [nextPlaceholder, setNextPlaceholder] = useState(
    PLACEHOLDERS[1] ?? PLACEHOLDERS[0]
  );
  const [isFlipping, setIsFlipping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    api.get('/api/books/zlibrary/warmup').catch(() => {});
  }, []);

  const mapFlibustaResults = (results: BookResult[] = []) =>
    results.map((book) => ({
      ...book,
      source: 'flibusta' as const,
      formats: book.formats.map((format) => ({
        ...format,
        source: 'flibusta' as const,
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

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const encodedQuery = encodeURIComponent(searchTerm);
      let flibustaError: unknown = null;
      let zlibraryError: unknown = null;

      const flibustaPromise = api
        .get(`/api/books/flibusta/search?query=${encodedQuery}`)
        .then((res) => mapFlibustaResults(res.data?.data || []))
        .catch((err) => {
          flibustaError = err;
          console.warn('Flibusta search failed:', err);
          return [];
        });

      const zlibraryPromise = api
        .get(`/api/books/zlibrary/search?query=${encodedQuery}`)
        .then((res) =>
          (res.data?.data || []).map((book: BookResult) => ({
            ...book,
            source: 'zlibrary' as const,
            formats: book.formats.map((format) => ({
              ...format,
              source: 'zlibrary' as const,
            })),
          }))
        )
        .catch((err) => {
          zlibraryError = err;
          console.warn('Z-Library search failed:', err);
          return [];
        });

      const flibustaResults = await flibustaPromise;
      setSearchResults(flibustaResults);
      setIsLoading(false);

      const zlibraryResults = await zlibraryPromise;

      if (zlibraryResults.length) {
        setSearchResults((prev) => mergeResults(prev, zlibraryResults));
      }

      if (!flibustaResults.length && !zlibraryResults.length) {
        const fallbackError = flibustaError || zlibraryError;
        setError({
          message:
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Не удалось найти книги. Попробуйте другой запрос.',
          code: 'SEARCH_ERROR',
        });
      }
    } catch (err) {
      console.error('Error searching books:', err);
      setError({
        message: err instanceof Error ? err.message : 'Failed to search',
        code: 'SEARCH_ERROR',
      });
      setSearchResults([]);
      setIsLoading(false);
    }
  };

  const handleDownload = async (bookId: string, format: BookFormat) => {
    try {
      if (format.source === 'zlibrary' && format.token) {
        const response = await api.get(`/api/books/zlibrary/download/${bookId}/${format.token}`);
        const downloadUrl: string | undefined = response.data?.data?.downloadUrl;
        if (!downloadUrl) {
          throw new Error('Download link is not available');
        }
        window.location.href = downloadUrl;
        return;
      }

      const proxyUrl =
        process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL || 'https://flibusta-proxy.alphy-flibusta.workers.dev';
      window.location.href = `${proxyUrl}/${bookId}/${format.format.toLowerCase()}`;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  return (
    <>
      <div className="w-full relative overflow-hidden">
      <div className="max-w-5xl mx-auto mb-24 mt-12 px-4 relative z-10">
        {/* Title Section - Left aligned, Black text, Geometria font - MOVED LOWER */}
        <div className="text-left mb-6">
          <h1 className="text-3xl md:text-4xl font-medium text-black mb-2 leading-tight font-geometria">
            Бесплатный доступ к любой литературе.
            <br />
            Мощный инструмент работы с ней.
          </h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start max-w-4xl">
          {/* Input Group */}
          <div className="flex-1 w-full relative group">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                setIsInputFocused(true);
                setIsFlipping(false);
              }}
              onBlur={() => setIsInputFocused(false)}
              placeholder=""
              aria-label="Search books"
              className="w-full h-14 px-4 bg-white text-black border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 transition-all duration-200 text-lg font-geometria"
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
            
            {/* Results Dropdown */}
            {(searchResults.length > 0 || error || (hasSearched && !isLoading && searchResults.length === 0)) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto border border-gray-200">
                {error && (
                  <div className="p-4 text-red-600 bg-red-50 border-b border-red-100">
                    {error.message}
                  </div>
                )}
                
                {searchResults.map((book) => (
                  <div key={book.id} className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 font-geometria">{book.title}</h3>
                        <p className="text-sm text-gray-600 font-geometria">{book.author}</p>
                        {book.source && (
                          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-gray-500 border border-gray-200 rounded px-2 py-0.5">
                            {book.source === 'zlibrary' ? 'Z-Library' : 'Flibusta'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end shrink-0">
                        {book.formats
                          .filter((format) => format.format !== 'mobi')
                          .map((format) => (
                          <button
                            key={format.id}
                              onClick={() => handleDownload(book.id, format)}
                              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors font-medium uppercase tracking-wide flex items-center gap-2"
                          >
                              <span>{format.format}</span>
                              {format.size && (
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                                  {format.size}
                                </span>
                              )}
                              {format.source === 'zlibrary' && (
                                <span className="text-[9px] font-semibold text-purple-600">Z</span>
                              )}
                          </button>
                        ))}
                        {book.source !== 'zlibrary' && (
                        <a
                          href={`https://flibusta.is/b/${book.id}/read`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors font-medium uppercase tracking-wide"
                          onClick={(e) => e.stopPropagation()}
                        >
                          READ
                        </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!isLoading && hasSearched && searchResults.length === 0 && !error && (
                  <div className="p-8 text-center text-gray-500 font-geometria">
                    Ничего не найдено. Попробуйте другой запрос.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button - Separate button */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-white text-gray-500 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-black transition-colors disabled:opacity-50"
          >
            {isLoading ? (
               <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <polyline points="9 18 15 12 9 6"></polyline>
               </svg>
            )}
          </button>
        </div>

        {/* CTA Section - SAME GAP AS TITLE TO INPUT */}
        <div className="mt-6 flex items-center gap-4 text-xl text-black">
          <span className="font-medium font-geometria">либо начните с</span>
          <Link 
            href="/maps" 
            className="inline-flex items-center px-5 py-3 bg-white text-black font-bold border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all hover:shadow-md font-geometria"
          >
            создания новой доски <span className="ml-2">+</span>
          </Link>
        </div>

        {/* Feature description - SMALLER */}
        <div className="flex items-start gap-4 mt-12 max-w-2xl">
          <div className="mt-2.5 w-2 h-2 bg-black flex-shrink-0 transform rotate-45"></div>
          <p className="text-lg md:text-xl leading-relaxed font-medium text-black font-geometria">
            Альфи позволяет бесплатно скачивать книги и визуально работать с их идеями
          </p>
        </div>
      </div>
    </div>

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
