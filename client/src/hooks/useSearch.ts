import { useState, useCallback } from 'react';
import api from '@/services/api';
import { BookSearchResult } from '@/types';
import { ApiSource } from '@/types/enums';

interface SearchResults {
  books: BookSearchResult[];
  total: number;
}

// Create the hook implementation
function useSearch() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [activeApi, setActiveApi] = useState<ApiSource>(ApiSource.OpenLibrary);
  const [error, setError] = useState<string | null>(null);
  const [displayAll, setDisplayAll] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
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
      const token = localStorage.getItem('token');
      const endpoint = displayAll 
        ? `/api/books?page=${page}&limit=${resultsPerPage}` 
        : `/api/books?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${resultsPerPage}`;

      console.log('Alphy search request:', { 
        endpoint, 
        displayAll, 
        searchTerm, 
        page 
      });

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) throw new Error('Failed to fetch from Alphy database');
      const data = await response.json();
      
      console.log('Alphy search results:', {
        count: data.books.length,
        total: data.pagination.total
      });

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
      console.error('Error in handleAlphySearch:', error);
      throw new Error('Error fetching from Alphy database');
    }
  };

  const searchDatabase = async (searchTerm: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/books?search=${encodeURIComponent(searchTerm)}&limit=5`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) throw new Error('Failed to fetch from database');
      const data = await response.json();
      
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
    // Don't block if we're just changing pages, only block repeated searches of the same term/page
    const isNewSearch = page === 1;
    
    if (isLoading && !isNewSearch) return;
    
    setIsLoading(true);
    setError(null);
    
    // Only reset results if this is a new search (page 1)
    if (isNewSearch) {
      setSearchResults([]);
      setCurrentPage(1);
    } else {
      // For pagination, update the current page
      setCurrentPage(page);
    }
    
    setHasSearched(true);

    try {
      console.log('Search started:', { activeApi, searchTerm, displayAll, page });
      
      if (activeApi === 'alphy') {
        // For Alphy, we either need searchTerm or displayAll to be true
        if (!searchTerm.trim() && !displayAll) {
          console.log('No search term and displayAll is false, aborting Alphy search');
          setSearchResults([]);
          setTotalResults(0);
          setIsLoading(false);
          return;
        }
        
        console.log('Performing Alphy search with:', { searchTerm, displayAll, page });
        const result = await handleAlphySearch(page);
        console.log('Alphy search completed with', result.books.length, 'results');
        
        // If loading more pages, append results, otherwise replace
        if (page > 1) {
          setSearchResults(prevResults => [...prevResults, ...result.books]);
        } else {
          setSearchResults(result.books);
        }
        
        setTotalResults(result.total);
      } else if (searchTerm.trim()) {
        // For other APIs, we need a search term
        console.log('Performing external API search with:', { activeApi, searchTerm, page });
        
        const cacheKey = `${activeApi}-${searchTerm}-${page}`;
        const cachedResults = getCachedResults(cacheKey);

        if (cachedResults) {
          if (page > 1) {
            setSearchResults(prevResults => [...prevResults, ...cachedResults.combinedResults]);
          } else {
            setSearchResults(cachedResults.combinedResults);
          }
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

          if (page > 1) {
            setSearchResults(prevResults => [...prevResults, ...combinedResults]);
          } else {
            setSearchResults(combinedResults);
          }
          
          setTotalResults(externalResults.total);
        }
      } else {
        // No search term for non-Alphy APIs
        console.log('No search term provided for non-Alphy API, clearing results');
        setSearchResults([]);
        setTotalResults(0);
      }
    } catch (error) {
      console.error('Error in handleSearch:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      if (isNewSearch) {
        setSearchResults([]);
        setTotalResults(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Simple function to clear search results without making API calls
  const clearSearchResults = () => {
    setSearchResults([]);
    setTotalResults(0);
  };

  const handlePagination = (page: number) => {
    handleSearch(page);
  };

  const handleApiChange = (api: ApiSource) => {
    setActiveApi(api);
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
    clearSearchResults,
    handlePagination,
    handleApiChange,
    resultsPerPage
  };
}

// Use CommonJS style export to avoid conflicts with declaration file
module.exports = { useSearch }; 