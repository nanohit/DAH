import { useState, useEffect } from 'react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

interface BookSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  thumbnail?: string;
  highResThumbnail?: string;
  source: 'openlib' | 'google' | 'alphy';
  description?: string;
  _id?: string; // For Alphy books
  publishedYear?: number;
  inDatabase?: boolean;
  flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
  flibustaVariants?: Array<{
    title: string;
    author: string;
    sourceId: string;
    formats: Array<{
      format: string;
      url: string;
    }>;
  }>;
}

interface SearchModalProps {
  onClose: () => void;
  onBookSubmit: (bookData: BookSearchResult) => void;
}

const SearchModal = ({ onClose, onBookSubmit }: SearchModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isCheckingFlibusta, setIsCheckingFlibusta] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchCache, setSearchCache] = useState<Record<string, any>>({});

  const getCachedResults = (cacheKey: string) => {
    return searchCache[cacheKey];
  };

  const setCachedResults = (cacheKey: string, results: any) => {
    setSearchCache(prev => ({
      ...prev,
      [cacheKey]: results
    }));
  };

  const handleParallelSearch = async (page = 1) => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setCurrentPage(page);
    
    const cacheKey = `${searchTerm}-${page}`;
    const cachedResults = getCachedResults(cacheKey);
    
    if (cachedResults) {
      setSearchResults(prev => page === 1 ? cachedResults : [...prev, ...cachedResults]);
      setIsLoading(false);
      return;
    }

    try {
      const [openLibResults, googleResults, alphyResults] = await Promise.all([
        handleOpenLibSearch(page),
        handleGoogleSearch(page),
        handleAlphySearch(page)
      ]);

      const combinedResults = [
        ...openLibResults,
        ...googleResults,
        ...alphyResults
      ].sort((a, b) => {
        // Prioritize results with thumbnails
        if (a.thumbnail && !b.thumbnail) return -1;
        if (!a.thumbnail && b.thumbnail) return 1;
        return 0;
      });

      setCachedResults(cacheKey, combinedResults);
      setSearchResults(prev => page === 1 ? combinedResults : [...prev, ...combinedResults]);
      setHasMore(combinedResults.length > 0);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for books');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleParallelSearch(1);
    }
  };

  const fetchOpenLibraryDetails = async (key: string) => {
    try {
      const response = await fetch(`https://openlibrary.org${key}.json`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching Open Library details:', error);
      return null;
    }
  };

  const fetchGoogleBooksDetails = async (id: string) => {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching Google Books details:', error);
      return null;
    }
  };

  const handleOpenLibSearch = async (page = 1) => {
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}&page=${page}&limit=10`
      );
      const data = await response.json();
      
      return data.docs.map((book: any) => ({
        key: book.key,
        title: book.title,
        author_name: book.author_name,
        first_publish_year: book.first_publish_year,
        thumbnail: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
        highResThumbnail: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : undefined,
        source: 'openlib' as const,
        description: book.description || book.first_sentence?.[0]
      }));
    } catch (error) {
      console.error('Open Library search error:', error);
      return [];
    }
  };

  const handleGoogleSearch = async (page = 1) => {
    try {
      const startIndex = (page - 1) * 10;
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&startIndex=${startIndex}&maxResults=10`
      );
      const data = await response.json();
      
      return data.items?.map((book: any) => ({
        key: book.id,
        title: book.volumeInfo.title,
        author_name: book.volumeInfo.authors,
        publishedYear: book.volumeInfo.publishedDate?.split('-')[0],
        thumbnail: book.volumeInfo.imageLinks?.thumbnail,
        highResThumbnail: book.volumeInfo.imageLinks?.medium || book.volumeInfo.imageLinks?.large,
        source: 'google' as const,
        description: book.volumeInfo.description
      })) || [];
    } catch (error) {
      console.error('Google Books search error:', error);
      return [];
    }
  };

  const handleAlphySearch = async (page = 1) => {
    try {
      const response = await api.get(`/books/search?q=${encodeURIComponent(searchTerm)}&page=${page}&limit=10`);
      return response.data.map((book: any) => ({
        ...book,
        source: 'alphy' as const,
        inDatabase: true
      }));
    } catch (error) {
      console.error('Alphy search error:', error);
      return [];
    }
  };

  const searchDatabase = async (searchTerm: string) => {
    try {
      const response = await api.get(`/books/search?q=${encodeURIComponent(searchTerm)}`);
      return response.data;
    } catch (error) {
      console.error('Database search error:', error);
      return [];
    }
  };

  const handleBookClick = async (book: BookSearchResult) => {
    setSelectedBook(book);
    setIsCheckingFlibusta(true);

    try {
      if (book.source === 'openlib') {
        const details = await fetchOpenLibraryDetails(book.key);
        if (details) {
          setSelectedBook(prev => ({
            ...prev!,
            description: details.description || book.description
          }));
        }
      } else if (book.source === 'google') {
        const details = await fetchGoogleBooksDetails(book.key);
        if (details) {
          setSelectedBook(prev => ({
            ...prev!,
            description: details.volumeInfo.description || book.description
          }));
        }
      }

      // Check Flibusta status
      const response = await api.get(`/books/flibusta-status/${book.key}`);
      setSelectedBook(prev => ({
        ...prev!,
        flibustaStatus: response.data.status,
        flibustaVariants: response.data.variants
      }));
    } catch (error) {
      console.error('Error fetching book details:', error);
    } finally {
      setIsCheckingFlibusta(false);
    }
  };

  const handleBackToSearch = () => {
    setSelectedBook(null);
    setSelectedVariant(null);
  };

  const handleRequestDownloadLinks = async () => {
    if (!selectedBook) return;

    try {
      setIsCheckingFlibusta(true);
      const response = await api.post(`/books/request-download-links/${selectedBook.key}`);
      setSelectedBook(prev => ({
        ...prev!,
        flibustaStatus: response.data.status,
        flibustaVariants: response.data.variants
      }));
    } catch (error) {
      console.error('Error requesting download links:', error);
      toast.error('Failed to request download links');
    } finally {
      setIsCheckingFlibusta(false);
    }
  };

  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant);
  };

  const handleFinalSubmit = async () => {
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      if (selectedVariant) {
        // Save the selected variant to the database
        await api.post(`/books/save-download-links/${selectedBook.key}`, {
          variant: selectedVariant
        });
      }

      onBookSubmit(selectedBook);
      onClose();
    } catch (error) {
      console.error('Error submitting book:', error);
      toast.error('Failed to submit book');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {!selectedBook ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Search Books</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for books..."
                className="w-full p-2 border rounded"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4">Loading...</div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((book) => (
                  <div
                    key={`${book.source}-${book.key}`}
                    className="flex items-start p-4 border rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleBookClick(book)}
                  >
                    {book.thumbnail && (
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        className="w-16 h-24 object-cover mr-4"
                      />
                    )}
                    <div>
                      <h3 className="font-medium">{book.title}</h3>
                      <p className="text-gray-600">
                        {book.author_name?.join(', ')}
                        {book.first_publish_year && ` (${book.first_publish_year})`}
                      </p>
                      {book.description && (
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                          {book.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={() => handleParallelSearch(currentPage + 1)}
                    className="w-full py-2 text-center text-blue-600 hover:text-blue-800"
                  >
                    Load More
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No results found
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Book Details</h2>
              <button
                onClick={handleBackToSearch}
                className="text-blue-600 hover:text-blue-800"
              >
                ← Back to Search
              </button>
            </div>

            <div className="flex items-start">
              {selectedBook.thumbnail && (
                <img
                  src={selectedBook.thumbnail}
                  alt={selectedBook.title}
                  className="w-32 h-48 object-cover mr-4"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-medium">{selectedBook.title}</h3>
                <p className="text-gray-600">
                  {selectedBook.author_name?.join(', ')}
                  {selectedBook.first_publish_year && ` (${selectedBook.first_publish_year})`}
                </p>
                {selectedBook.description && (
                  <p className="text-gray-500 mt-2">{selectedBook.description}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              {isCheckingFlibusta ? (
                <div className="text-center py-4">Checking availability...</div>
              ) : selectedBook.flibustaStatus === 'not_checked' ? (
                <button
                  onClick={handleRequestDownloadLinks}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Check Availability
                </button>
              ) : selectedBook.flibustaStatus === 'checking' ? (
                <div className="text-center py-4">Checking availability...</div>
              ) : selectedBook.flibustaStatus === 'found' ? (
                <div className="space-y-4">
                  <h4 className="font-medium">Available Formats:</h4>
                  {selectedBook.flibustaVariants?.map((variant, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded cursor-pointer ${
                        selectedVariant === variant ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleVariantSelect(variant)}
                    >
                      <p className="font-medium">{variant.title}</p>
                      <p className="text-gray-600">{variant.author}</p>
                      <div className="mt-2">
                        {variant.formats.map((format, i) => (
                          <span
                            key={i}
                            className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                          >
                            {format.format}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Add Book'}
                  </button>
                </div>
              ) : selectedBook.flibustaStatus === 'not_found' ? (
                <div className="text-center py-4 text-gray-500">
                  No download links available
                </div>
              ) : selectedBook.flibustaStatus === 'uploaded' ? (
                <div className="text-center py-4 text-green-600">
                  Download links already saved
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal; 