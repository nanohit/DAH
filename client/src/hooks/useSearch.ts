import { useState } from 'react';
import { BookSearchResult } from '@/types';
import { UseSearchReturn } from '@/types/hooks';
import api from '@/services/api';

interface SearchResults {
  books: BookSearchResult[];
  total: number;
}

export function useSearch(): UseSearchReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [activeApi, setActiveApi] = useState<'openlib' | 'google' | 'alphy'>('openlib');
  const [error, setError] = useState<string | null>(null);
  const [displayAll, setDisplayAll] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const resultsPerPage = 10;

  const searchCache = new Map<string, { timestamp: number; results: any }>();
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedResults = (cacheKey: string) => {
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.results;
    }
    return null;
  };

  const setCachedResults = (cacheKey: string, results: any) => {
    searchCache.set(cacheKey, {
      timestamp: Date.now(),
      results
    });
  };

  const handleOpenLibSearch = async (page = 1) => {
    const offset = (page - 1) * resultsPerPage;
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}&offset=${offset}&limit=${resultsPerPage}`
      );
      if (!response.ok) throw new Error('Failed to fetch from Open Library');
      const data = await response.json();
      return {
        books: data.docs.map((doc: any) => ({
          key: doc.key,
          title: doc.title,
          author_name: doc.author_name,
          first_publish_year: doc.first_publish_year,
          thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : undefined,
          highResThumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
          source: 'openlib' as const
        })),
        total: data.numFound
      };
    } catch (error) {
      throw new Error('Error fetching from Open Library. Please try again.');
    }
  };

  const handleGoogleSearch = async (page = 1) => {
    const startIndex = (page - 1) * resultsPerPage;
    const GOOGLE_BOOKS_API_KEY = 'AIzaSyB2DtSUPFGE0aV_ehA6M9Img7XqO8sr8-Y';
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&startIndex=${startIndex}&maxResults=${resultsPerPage}&key=${GOOGLE_BOOKS_API_KEY}`
      );
      if (!response.ok) throw new Error('Failed to fetch from Google Books');
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Error fetching from Google Books');
      }

      return {
        books: data.items?.map((item: any) => {
          const baseImageUrl = item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:')?.split('&zoom=')[0];
          
          return {
            key: item.id,
            title: item.volumeInfo.title,
            author_name: item.volumeInfo.authors,
            first_publish_year: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate) : undefined,
            thumbnail: baseImageUrl ? `${baseImageUrl}&zoom=1` : undefined,
            highResThumbnail: baseImageUrl ? `${baseImageUrl}&zoom=2` : undefined,
            source: 'google' as const
          };
        }) || [],
        total: data.totalItems || 0
      };
    } catch (error) {
      throw new Error('Error fetching from Google Books. Please try again.');
    }
  };

  const handleAlphySearch = async (page = 1) => {
    try {
      const endpoint = displayAll 
        ? `/api/books?page=${page}&limit=${resultsPerPage}` 
        : `/api/books?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${resultsPerPage}`;

      const response = await api.get(endpoint);
      const data = response.data;
      
      const books = data.books.map((book: any) => ({
        key: book._id,
        _id: book._id,
        title: book.title,
        author_name: [book.author],
        thumbnail: book.coverImage,
        description: book.description,
        source: 'alphy' as const,
        publishedYear: book.publishedYear
      }));

      return {
        books,
        total: data.pagination.total
      };
    } catch (error) {
      throw new Error('Error fetching from Alphy database');
    }
  };

  const searchDatabase = async (searchTerm: string) => {
    try {
      const response = await api.get(`/api/books?search=${encodeURIComponent(searchTerm)}&limit=5`);
      const data = response.data;
      
      return data.books.map((book: any) => ({
        key: book._id,
        _id: book._id,
        title: book.title,
        author_name: [book.author],
        thumbnail: book.coverImage,
        description: book.description,
        source: 'alphy' as const,
        publishedYear: book.publishedYear,
        inDatabase: true
      }));
    } catch (error) {
      console.error('Error searching database:', error);
      return [];
    }
  };

  const handleSearch = async (page = 1) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setCurrentPage(1);
    setHasSearched(true);

    try {
      if (activeApi === 'alphy') {
        if (!searchTerm.trim() && !displayAll) {
          setSearchResults([]);
          setTotalResults(0);
          return;
        }
        const result = await handleAlphySearch(page);
        setSearchResults(result.books);
        setTotalResults(result.total);
      } else if (searchTerm.trim()) {
        const cacheKey = `${activeApi}-${searchTerm}-${page}`;
        const cachedResults = getCachedResults(cacheKey);

        if (cachedResults) {
          setSearchResults(cachedResults.combinedResults);
          setTotalResults(cachedResults.total);
        } else {
          const [databaseResults, externalResults] = await Promise.all([
            searchDatabase(searchTerm),
            (activeApi === 'openlib' ? handleOpenLibSearch : handleGoogleSearch)(page)
          ]);

          const filteredExternalResults = externalResults.books.filter((externalBook: BookSearchResult) => {
            const externalAuthor = Array.isArray(externalBook.author_name) 
              ? externalBook.author_name[0] 
              : externalBook.author_name;
              
            return !databaseResults.some((dbBook: BookSearchResult) => 
              dbBook.title.toLowerCase() === externalBook.title.toLowerCase() &&
              dbBook.author_name?.[0]?.toLowerCase() === externalAuthor?.toLowerCase()
            );
          });

          const combinedResults = [...databaseResults, ...filteredExternalResults];
          
          setCachedResults(cacheKey, {
            combinedResults,
            total: externalResults.total
          });

          setSearchResults(combinedResults);
          setTotalResults(externalResults.total);
        }
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    currentPage,
    totalResults,
    activeApi,
    setActiveApi,
    error,
    displayAll,
    setDisplayAll,
    hasSearched,
    setHasSearched,
    handleSearch,
    resultsPerPage
  };
} 