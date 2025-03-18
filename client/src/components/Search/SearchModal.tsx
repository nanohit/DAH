import { useSearch } from '@/hooks/useSearch';
import { useBookDetails } from '@/hooks/useBookDetails';
import { BookSearchResult } from '@/types';
import { useMemo, useState, useEffect } from 'react';
import api from '@/services/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface SearchModalProps {
  onClose: () => void;
  onBookSubmit: (bookData: BookSearchResult) => void;
  error?: string | null;
  shouldSaveToDb?: boolean;
}

interface FilteredResult {
  book: BookSearchResult;
  isFirstExternalResult: boolean;
  hasDbResults: boolean;
}

interface FlibustaFormat {
  format: string;
  url: string;
}

interface FlibustaResult {
  id: string;
  title: string;
  author: string;
  formats: FlibustaFormat[];
}

export const SearchModal = ({ onClose, onBookSubmit, error: externalError, shouldSaveToDb = true }: SearchModalProps) => {
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    currentPage,
    totalResults,
    activeApi,
    setActiveApi,
    error: searchError,
    displayAll,
    setDisplayAll,
    hasSearched,
    setHasSearched,
    handleSearch,
    clearSearchResults,
    resultsPerPage
  } = useSearch();

  const {
    selectedBook,
    confirmedBook,
    setConfirmedBook,
    isLoadingDetails,
    isEditingDescription,
    setIsEditingDescription,
    showFullDescription,
    setShowFullDescription,
    handleBookClick,
    handleBackToSearch,
    handleSubmit
  } = useBookDetails();

  // Flibusta integration states
  const [isFlibustaStage, setIsFlibustaStage] = useState(false);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaResults, setFlibustaResults] = useState<FlibustaResult[]>([]);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<FlibustaResult | null>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);

  const router = useRouter();

  // Memoize book filtering logic
  const filteredResults = useMemo<FilteredResult[]>(() => {
    return searchResults.map((book: BookSearchResult, index: number) => {
      const isFirstExternalResult = index > 0 && 
        searchResults[index - 1].source === 'alphy' && 
        book.source !== 'alphy' &&
        activeApi !== 'alphy';

      return {
        book,
        isFirstExternalResult,
        hasDbResults: searchResults.some((b: BookSearchResult) => b.source === 'alphy')
      };
    });
  }, [searchResults, activeApi]);

  // Effect that triggers search when activeApi or displayAll changes
  useEffect(() => {
    console.log('API or displayAll changed:', { activeApi, displayAll });
    
    // Unconditionally trigger search - this matches how it works in Maps page
    handleParallelSearch(1);
  }, [activeApi, displayAll]);

  const handleParallelSearch = (page = 1) => {
    console.log('handleParallelSearch called with:', {
      activeApi,
      isLoading,
      searchTerm,
      displayAll,
      page
    });
    
    // Don't allow search when already loading
    if (isLoading) {
      console.log('Search blocked due to isLoading');
      return;
    }
    
    handleSearch(page);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleParallelSearch(1);
    }
  };

  const handleRequestDownloadLinks = async () => {
    if (!confirmedBook) return;
    
    setIsFlibustaSearching(true);
    setFlibustaError(null);
    setShowFlibustaResults(true);

    try {
      const response = await api.get(`/api/books/flibusta/search?query=${encodeURIComponent(confirmedBook.title)}`);
      const data = response.data;

      if (!response.data) {
        throw new Error('Failed to search on Flibusta');
      }

      setFlibustaResults(data.data || []);
    } catch (err) {
      setFlibustaError(err instanceof Error ? err.message : 'Failed to search on Flibusta');
    } finally {
      setIsFlibustaSearching(false);
    }
  };

  const handleVariantSelect = (variant: FlibustaResult) => {
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map(format => ({
        format: format.format,
        url: `/api/books/flibusta/download/${variant.id}/${format.format}`
      }))
    };

    setSelectedVariant(originalVariant);
    setShowFlibustaResults(false);
  };

  const handleFinalSubmit = async () => {
    if (confirmedBook) {
      try {
        // If the book already exists in the Alphy database, just pass it to the parent component
        if (confirmedBook.source === 'alphy' && confirmedBook._id) {
          onBookSubmit(confirmedBook);
          onClose();
          return;
        }

        if (shouldSaveToDb) {
          const token = localStorage.getItem('token');
          if (!token) {
            throw new Error('You must be logged in to add books');
          }

          // Ensure required fields have valid values
          const bookData = {
            title: confirmedBook.title.trim(),
            author: Array.isArray(confirmedBook.author_name) 
              ? confirmedBook.author_name.join(', ').trim()
              : (confirmedBook.author_name || 'Unknown').trim(),
            description: confirmedBook.description?.trim() || 'No description available.',
            coverImage: confirmedBook.source === 'openlib'
              ? confirmedBook.thumbnail?.replace('-S.jpg', '-L.jpg') // Use large resolution for database
              : confirmedBook.highResThumbnail || confirmedBook.thumbnail || 'https://via.placeholder.com/300x400?text=No+Cover',
            publishedYear: confirmedBook.first_publish_year,
            key: confirmedBook.key,
          };

          // Validate required fields
          if (!bookData.title) {
            throw new Error('Book title is required');
          }
          if (!bookData.author) {
            throw new Error('Author is required');
          }

          // Save book to database
          const response = await api.post('/api/books', bookData);
          
          // If there's a selected variant from Flibusta, add the download links
          if (selectedVariant && response.data && response.data._id) {
            try {
              const variantResponse = await api.post(`/api/books/${response.data._id}/save-flibusta`, {
                variant: {
                  title: selectedVariant.title,
                  author: selectedVariant.author,
                  sourceId: selectedVariant.id,
                  formats: [
                    ...selectedVariant.formats.map(format => ({
                      format: format.format,
                      url: `/api/books/flibusta/download/${selectedVariant.id}/${format.format}`
                    })),
                    {
                      format: 'read',
                      url: `https://flibusta.is/b/${selectedVariant.id}/read`
                    }
                  ]
                }
              });
              
              // Use the updated book with download links
              if (variantResponse.data) {
                onBookSubmit({
                  ...confirmedBook,
                  _id: variantResponse.data._id,
                  // Use type assertion to include the flibustaVariants property
                } as BookSearchResult & { flibustaVariants: any });
                onClose();
                router.refresh();
                return;
              }
            } catch (variantError) {
              console.error('Error saving download links:', variantError);
              // Continue with normal book submission if variant saving fails
            }
          }

          if (response.data) {
            // Pass the book with its new _id to prevent duplicate saving
            onBookSubmit({
              ...confirmedBook,
              _id: response.data._id
            });
            onClose();
            router.refresh();
          }
        }
      } catch (error) {
        console.error('Error in handleFinalSubmit:', error);
        throw error;
      }
    }
  };

  const moveToFlibustaStage = () => {
    setIsFlibustaStage(true);
    handleRequestDownloadLinks();
  };

  const skipFlibustaAndSave = () => {
    handleFinalSubmit();
  };

  if (isFlibustaStage && confirmedBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" onWheel={(e) => e.stopPropagation()}>
        <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="bg-black border border-gray-800 rounded-xl w-[800px] h-[85vh] relative flex flex-col overflow-hidden"
          style={{
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
            background: 'linear-gradient(to bottom right, #0a0a0a, #000000)',
          }}>
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <button
                onClick={() => setIsFlibustaStage(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 group"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to book details</span>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-12">
              {/* Book cover */}
              <div className="w-full md:w-64 flex-shrink-0">
                <div className="relative group">
                  {confirmedBook.thumbnail ? (
                    <img 
                      src={confirmedBook.source === 'openlib'
                        ? confirmedBook.thumbnail?.replace('-S.jpg', '-L.jpg')
                        : confirmedBook.highResThumbnail || confirmedBook.thumbnail}
                      alt={confirmedBook.title}
                      className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                    />
                  ) : (
                    <div 
                      className="w-full h-96 bg-gray-900 flex items-center justify-center shadow-lg" 
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <span className="text-gray-600">No cover</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                </div>
              </div>
              
              {/* Book details and Flibusta search */}
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-3">{confirmedBook.title}</h2>
                <p className="text-lg text-gray-300 mb-6 font-light">
                  {Array.isArray(confirmedBook.author_name) 
                    ? confirmedBook.author_name.join(', ') 
                    : confirmedBook.author_name || 'Unknown'}
                </p>
                
                {/* Download section */}
                <div className="mt-8">
                  <h3 className="text-gray-200 text-lg font-medium mb-4">Download options</h3>
                  {selectedVariant ? (
                    <div>
                      {/* Preview download buttons */}
                      <div className="flex flex-wrap gap-3 pt-3">
                        {[
                          ...selectedVariant.formats.filter(format => format.format !== 'mobi'),
                          { format: 'read', url: `https://flibusta.is/b/${selectedVariant.id}/read` }
                        ].map((format) => (
                          <button
                            key={format.format}
                            className={`px-6 py-2 rounded-md transition-colors ${
                              format.format === 'read'
                                ? 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-700'
                                : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                            }`}
                          >
                            {format.format === 'read' ? 'Read online (VPN)' : `.${format.format}`}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleFinalSubmit}
                        className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        Save book with download links
                      </button>
                      <button
                        onClick={() => setSelectedVariant(null)}
                        className="mt-4 ml-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Clear selection
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={handleRequestDownloadLinks}
                        className="px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all duration-300 border border-gray-700 hover:scale-105"
                      >
                        {isFlibustaSearching ? 
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Searching...
                          </span> : 
                          "Find download links"
                        }
                      </button>
                      <button
                        onClick={skipFlibustaAndSave}
                        className="mt-4 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        Skip and save book
                      </button>
                      
                      {/* Flibusta search results dropdown */}
                      {showFlibustaResults && flibustaResults.length > 0 && (
                        <div className="mt-4 border border-gray-800 rounded-md shadow-lg bg-gray-900 max-h-60 overflow-y-auto custom-scrollbar">
                          <div className="p-3 bg-gray-800 border-b border-gray-700">
                            <h4 className="text-sm font-medium text-white">Select a book variant:</h4>
                          </div>
                          {flibustaResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleVariantSelect(result)}
                              className="w-full p-3 text-left hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors"
                            >
                              <div className="font-medium text-sm text-white">{result.title}</div>
                              <div className="text-xs text-gray-400">{result.author}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Available formats: {result.formats.map(f => f.format.toUpperCase()).join(', ')}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Error message */}
                      {flibustaError && (
                        <div className="mt-3 text-sm text-red-400">
                          {flibustaError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (confirmedBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={onClose}></div>
        
        <div 
          className="bg-black border border-gray-800 rounded-xl w-[800px] h-[85vh] relative flex flex-col overflow-hidden"
          style={{
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
            background: 'linear-gradient(to bottom right, #0a0a0a, #000000)',
          }}
        >
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <button
                onClick={handleBackToSearch}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 group"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to search</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-12">
              {/* Book cover */}
              <div className="w-full md:w-64 flex-shrink-0">
                <div className="relative group">
                  {confirmedBook.thumbnail ? (
                    <img 
                      src={confirmedBook.highResThumbnail || confirmedBook.thumbnail} 
                      alt={confirmedBook.title}
                      className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                      onError={(e) => {
                        if (e.currentTarget.src !== confirmedBook.thumbnail) {
                          e.currentTarget.src = confirmedBook.thumbnail || '';
                        }
                      }}
                    />
                  ) : (
                    <div 
                      className="w-full h-96 bg-gray-900 flex items-center justify-center shadow-lg" 
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <span className="text-gray-600">No cover</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                </div>
              </div>

              {/* Book details */}
              <div className="flex-1 mt-4 md:mt-0">
                <h2 className="text-3xl font-bold text-white mb-3">{confirmedBook.title}</h2>
                {confirmedBook.author_name && (
                  <p className="text-lg text-gray-300 mb-6 font-light">
                    {Array.isArray(confirmedBook.author_name) 
                      ? confirmedBook.author_name.join(', ') 
                      : confirmedBook.author_name}
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className="text-gray-700">★</span>
                    ))}
                  </div>
                  <span className="text-gray-600">n/a</span>
                </div>

                {/* Description */}
                <div className="mb-8">
                  <h3 className="text-gray-200 text-lg font-medium mb-3">About this book</h3>
                  {isEditingDescription ? (
                    <div>
                      <textarea
                        value={confirmedBook.description || ''}
                        onChange={(e) => {
                          setConfirmedBook({
                            ...confirmedBook,
                            description: e.target.value
                          });
                        }}
                        className="w-full h-32 p-2 border border-gray-700 rounded bg-gray-900 text-white text-sm"
                        placeholder="Enter book description..."
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => setIsEditingDescription(false)}
                          className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : confirmedBook.description ? (
                    <div>
                      <p className="text-gray-400 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                        {showFullDescription 
                          ? confirmedBook.description
                          : confirmedBook.description.slice(0, 420)}
                      </p>
                      {confirmedBook.description.length > 420 && (
                        <button
                          onClick={() => setShowFullDescription(!showFullDescription)}
                          className="text-sm text-gray-500 hover:text-gray-300 mt-3 transition-colors focus:outline-none"
                        >
                          {showFullDescription ? 'Show less' : 'Show more...'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">No description available</span>
                  )}
                </div>

                {/* Download section */}
                <div className="mt-8">
                  <h3 className="text-gray-200 text-lg font-medium mb-4">Download options</h3>
                  <button
                    onClick={moveToFlibustaStage}
                    className="px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all duration-300 border border-gray-700 hover:scale-105"
                  >
                    Find download links
                  </button>
                  <button
                    onClick={skipFlibustaAndSave}
                    className="mt-4 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                  >
                    Skip and save book
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div 
        className="bg-black rounded-lg w-[800px] h-[800px] relative flex flex-col border border-gray-800 overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #0a0a0a, #000000)',
        }}
      >
        <div className="p-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value === '') {
                  clearSearchResults();
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="Search for books..."
              className="flex-1 px-4 py-2 rounded-md bg-[#080808] border border-gray-800 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={() => handleParallelSearch(1)}
              className="px-6 py-2 rounded-md bg-[#080808] text-white text-base font-medium hover:bg-gray-900 border border-gray-800"
            >
              Search
            </button>
          </div>
          
          {/* API Toggle */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setActiveApi('openlib');
                setDisplayAll(false);
                clearSearchResults();
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'openlib'
                  ? 'bg-white text-black'
                  : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
              }`}
            >
              Openlibrary
            </button>
            <button
              onClick={() => {
                setActiveApi('google');
                setDisplayAll(false);
                clearSearchResults();
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'google'
                  ? 'bg-white text-black'
                  : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
              }`}
            >
              Google Books
            </button>
            
            {/* Combined Alphy button with Display all */}
            <div className="flex items-stretch">
              <button
                onClick={() => {
                  setActiveApi('alphy');
                  setDisplayAll(false);
                  clearSearchResults();
                  setHasSearched(false);
                }}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  activeApi === 'alphy'
                    ? 'bg-white text-black'
                    : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
                } ${activeApi === 'alphy' ? 'rounded-l-md border-r-0' : 'rounded-md'}`}
              >
                Alphy
              </button>
              {activeApi === 'alphy' && (
                <button
                  onClick={() => {
                    const newDisplayAll = !displayAll;
                    setDisplayAll(newDisplayAll);
                    setSearchTerm('');
                    clearSearchResults();
                  }}
                  className={`px-3 py-1 text-sm font-medium transition-colors rounded-r-md ${
                    displayAll
                      ? 'bg-white text-black border border-white'
                      : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
                  }`}
                >
                  All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content area with class for scroll position management */}
        <div className="flex-1 px-6 overflow-y-auto search-results-container custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : searchError || externalError ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-center">{searchError || externalError}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map(({ book, isFirstExternalResult, hasDbResults }) => (
                <div key={book.key}>
                  {isFirstExternalResult && hasDbResults && (
                    <div className="border-t border-gray-800 my-4 pt-2" />
                  )}
                  <div
                    className={`p-3 hover:bg-gray-900 cursor-pointer border-b border-gray-800 flex gap-3 ${
                      selectedBook?.key === book.key ? 'bg-gray-900' : ''
                    }`}
                    onClick={() => handleBookClick(book)}
                  >
                    {book.thumbnail ? (
                      <img 
                        src={book.thumbnail} 
                        alt={book.title}
                        className="w-12 h-auto object-cover"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-gray-800 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No cover</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {book.title}
                        {book.source === 'alphy' && (
                          <span className="ml-2 text-xs text-green-500 font-normal">
                            In database
                          </span>
                        )}
                      </h3>
                      {book.author_name && (
                        <p className="text-sm text-gray-400">
                          by {Array.isArray(book.author_name) ? book.author_name.join(', ') : book.author_name}
                          {book.first_publish_year && ` (${book.first_publish_year})`}
                        </p>
                      )}
                      {selectedBook?.key === book.key && (
                        <p className="text-sm text-blue-400 mt-1">Click again to confirm selection</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Suggestions for different APIs */}
              {searchTerm.trim() && hasSearched && searchResults.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-600">
                  {(activeApi === 'openlib' || activeApi === 'alphy') && (
                    "Haven't found what you were looking for? Switch to Google Books."
                  )}
                </div>
              )}

              {/* Pagination */}
              {searchResults.length > 0 && currentPage * resultsPerPage < totalResults && (
                <div className="flex justify-center py-3">
                  <button
                    onClick={() => handleParallelSearch(currentPage + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm bg-gray-800 text-gray-400 hover:text-gray-200 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        Load more results
                        <svg 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 9l-7 7-7-7" 
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        `}</style>

        {/* Bottom buttons */}
        <div className="flex mt-auto">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-base font-medium bg-gray-200 hover:bg-gray-300 transition-colors text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 