import { useSearch } from '@/hooks/useSearch';
import { useBookDetails } from '@/hooks/useBookDetails';
import { BookSearchResult, User } from '@/types';
import { useMemo, useState, useEffect, useRef } from 'react';
import api from '@/services/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ApiSource } from '@/types/enums';
import { BsBookmark, BsBookmarkFill } from 'react-icons/bs';
import { bookmarkBook } from '@/utils/bookUtils';
import { useAuth } from '@/context/AuthContext';

interface SearchModalProps {
  onClose: () => void;
  onBookSubmit: (bookData: BookSearchResult) => void;
  error?: string | null;
  shouldSaveToDb?: boolean;
  initialBook?: BookSearchResult;
  isBookmarksPage?: boolean;
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

export const SearchModal = ({ onClose, onBookSubmit, error: externalError, shouldSaveToDb = true, initialBook, isBookmarksPage }: SearchModalProps) => {
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
  } = useSearch() as {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    searchResults: BookSearchResult[];
    isLoading: boolean;
    currentPage: number;
    totalResults: number;
    activeApi: ApiSource;
    setActiveApi: (api: ApiSource) => void;
    error: string | null;
    displayAll: boolean;
    setDisplayAll: (value: boolean) => void;
    hasSearched: boolean;
    setHasSearched: (value: boolean) => void;
    handleSearch: (page?: number) => void;
    clearSearchResults: () => void;
    resultsPerPage: number;
  };

  const {
    selectedBook,
    confirmedBook,
    setConfirmedBook,
    isLoadingDetails,
    isEditingDescription,
    setIsEditingDescription,
    showFullDescription,
    setShowFullDescription,
    handleBookClick: originalHandleBookClick,
    handleBackToSearch,
    handleSubmit
  } = useBookDetails() as {
    selectedBook: BookSearchResult | null;
    confirmedBook: BookSearchResult | null;
    setConfirmedBook: (book: BookSearchResult | null) => void;
    isLoadingDetails: boolean;
    isEditingDescription: boolean;
    setIsEditingDescription: (value: boolean) => void;
    showFullDescription: boolean;
    setShowFullDescription: (value: boolean) => void;
    handleBookClick: (book: BookSearchResult) => void;
    handleBackToSearch: () => void;
    handleSubmit: () => Promise<BookSearchResult | null>;
  };

  const { user } = useAuth();

  // Flibusta integration states
  const [isFlibustaStage, setIsFlibustaStage] = useState(false);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaResults, setFlibustaResults] = useState<any[]>([]);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);

  const router = useRouter();

  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Add states for 3D effect
  const [isHovering, setIsHovering] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const bookCoverRef = useRef<HTMLDivElement>(null);

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

  // Effect to handle initialBook prop
  useEffect(() => {
    if (initialBook && initialBook._id) {
      console.log('Setting initialBook as confirmedBook:', initialBook);
      console.log('Flibusta status:', initialBook.flibustaStatus);
      console.log('Flibusta variants:', initialBook.flibustaVariants);
      setConfirmedBook(initialBook);
    }
  }, [initialBook, setConfirmedBook]);

  const getUserId = (user: string | { _id: string } | User): string => {
    if (typeof user === 'string') return user;
    return user._id;
  };

  useEffect(() => {
    if (confirmedBook && user) {
      const isMarked = confirmedBook.bookmarks?.some((bookmark) => 
        getUserId(bookmark.user) === getUserId(user)
      );
      setIsBookmarked(!!isMarked);
    }
  }, [confirmedBook, user]);

  useEffect(() => {
    if (selectedBook && user) {
      const isMarked = selectedBook.bookmarks?.some((bookmark) => 
        getUserId(bookmark.user) === getUserId(user)
      );
      setIsBookmarked(!!isMarked);
    }
  }, [selectedBook, user]);

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

      if (!data) {
        throw new Error('Failed to search on Flibusta');
      }

      setFlibustaResults(data.data || []);
    } catch (err) {
      setFlibustaError(err instanceof Error ? err.message : 'Failed to search on Flibusta');
      toast.error('Failed to search on Flibusta');
    } finally {
      setIsFlibustaSearching(false);
    }
  };

  const handleVariantSelect = (variant: any) => {
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map((format: any) => ({
        format: format.format,
        url: `/api/books/flibusta/download/${variant.id}/${format.format}`
      }))
    };

    setSelectedVariant(originalVariant);
    setShowFlibustaResults(false);
  };

  // Override handleBookClick to handle books from database
  const handleBookClick = async (book: BookSearchResult) => {
    // If it's an Alphy book or a book from our database, create map element directly
    if (book.source === 'alphy' || book._id) {
      onBookSubmit(book);
      onClose();
      return;
    }

    // Otherwise use the original handler
    originalHandleBookClick(book);
  };

  const handleFinalSubmit = async () => {
    if (confirmedBook) {
      try {
        // If the book already exists in the Alphy database, just pass it to the parent component
        if (confirmedBook.source === 'alphy' || confirmedBook._id) {
          onBookSubmit(confirmedBook);
          onClose();
          return;
        }

        if (shouldSaveToDb) {
          const token = localStorage.getItem('token');
          if (!token) {
            throw new Error('You must be logged in to add books');
          }

          // First check if the book already exists in our database
          try {
            const existingBookResponse = await api.get(`/api/books/by-key/${confirmedBook.key}`);
            if (existingBookResponse.data && existingBookResponse.data._id) {
              // Book already exists, use it directly
              onBookSubmit({
                ...confirmedBook,
                _id: existingBookResponse.data._id,
                flibustaStatus: existingBookResponse.data.flibustaStatus,
                flibustaVariants: existingBookResponse.data.flibustaVariants
              });
              onClose();
              return;
            }
          } catch (error) {
            // Book not found, continue with saving
          }

          // Ensure required fields have valid values
          const bookData = {
            title: confirmedBook.title.trim(),
            author: Array.isArray(confirmedBook.author_name) 
              ? confirmedBook.author_name.join(', ').trim()
              : (confirmedBook.author_name || 'Unknown').trim(),
            description: confirmedBook.description?.trim() || 'No description available.',
            coverImage: confirmedBook.source === 'openlib'
              ? (confirmedBook.thumbnail?.replace('-S.jpg', '-L.jpg') || 'https://via.placeholder.com/300x400?text=No+Cover')
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
              // Ensure we have the token for the request
              const token = localStorage.getItem('token');
              if (!token) {
                throw new Error('You must be logged in to save download links');
              }

              const variantResponse = await api.post(`/api/books/${response.data._id}/save-flibusta`, {
                variant: {
                  title: selectedVariant.title,
                  author: selectedVariant.author,
                  sourceId: selectedVariant.id,
                  formats: [
                    ...selectedVariant.formats.map((format: { format: string; url?: string }) => ({
                      format: format.format,
                      url: `/api/books/flibusta/download/${selectedVariant.id}/${format.format}`
                    })),
                    {
                      format: 'read',
                      url: `https://flibusta.is/b/${selectedVariant.id}/read`
                    }
                  ]
                }
              }, {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              
              // Use the updated book with download links
              if (variantResponse.data) {
                onBookSubmit({
                  ...confirmedBook,
                  _id: variantResponse.data._id,
                  flibustaStatus: 'uploaded',
                  flibustaVariants: variantResponse.data.flibustaVariants
                });
                onClose();
                router.refresh();
                return;
              }
            } catch (variantError) {
              console.error('Error saving download links:', variantError);
              toast.error('Failed to save download links. Please try again later.');
              // Continue with normal book submission if variant saving fails
            }
          }

          if (response.data) {
            // Pass the book with its new _id to prevent duplicate saving
            onBookSubmit({
              ...confirmedBook,
              _id: response.data._id,
              flibustaStatus: response.data.flibustaStatus,
              flibustaVariants: response.data.flibustaVariants
            });
            onClose();
            router.refresh();
          }
        }
      } catch (error) {
        console.error('Error in handleFinalSubmit:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save book');
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

  // Handle book bookmarking
  const handleBookmarkToggle = async () => {
    if (!confirmedBook || !confirmedBook._id) {
      toast.error('Cannot bookmark this book right now');
      return;
    }

    try {
      const result = await bookmarkBook(confirmedBook._id);
      if (result.success) {
        setIsBookmarked(result.isBookmarked);
        toast.success(result.isBookmarked ? 'Book bookmarked successfully' : 'Book removed from bookmarks');
      }
    } catch (error) {
      console.error('Error bookmarking book:', error);
      toast.error('Failed to update bookmark status');
    }
  };

  // Add new functions for 3D tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bookCoverRef.current) return;
    
    const { left, top, width, height } = bookCoverRef.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the element
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    // Convert to percentage (-50 to 50)
    const xPercent = ((x / width) - 0.5) * 100;
    const yPercent = ((y / height) - 0.5) * 100;
    
    // Reverse Y direction for natural tilt feel
    setTilt({ x: -yPercent / 5, y: xPercent / 5 });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
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
              
              {confirmedBook._id && user && (
                <button 
                  onClick={handleBookmarkToggle}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  {isBookmarked || isBookmarkHovered ? (
                    <BsBookmarkFill size={28} />
                  ) : (
                    <BsBookmark size={28} />
                  )}
                </button>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-12">
              {/* Book cover */}
              <div className="w-full md:w-64 flex-shrink-0">
                <div 
                  ref={bookCoverRef}
                  className="relative group perspective-700"
                  onMouseMove={handleMouseMove}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div 
                    className="transform-gpu transition-transform duration-200 ease-out relative"
                    style={{ 
                      transform: isHovering 
                        ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.05, 1.05, 1.05)` 
                        : 'rotateX(0deg) rotateY(0deg)',
                      transformStyle: 'preserve-3d' 
                    }}
                  >
                    {confirmedBook.thumbnail ? (
                      <>
                        <img 
                          src={confirmedBook.source === 'openlib'
                            ? confirmedBook.thumbnail?.replace('-S.jpg', '-L.jpg')
                            : confirmedBook.highResThumbnail || confirmedBook.thumbnail}
                          alt={confirmedBook.title}
                          className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: isHovering 
                              ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                              : '0 4px 20px rgba(0, 0, 0, 0.3)',
                            transition: 'box-shadow 0.2s ease-out'
                          }}
                          onError={(e) => {
                            if (e.currentTarget.src !== confirmedBook.thumbnail) {
                              e.currentTarget.src = confirmedBook.thumbnail || '';
                            }
                          }}
                        />
                      </>
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
                  </div>
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
                  <h3 className="text-gray-200 text-lg font-medium mb-4">Download</h3>
                  {confirmedBook && 
                    ((confirmedBook.flibustaStatus === 'uploaded' && confirmedBook.flibustaVariants && confirmedBook.flibustaVariants.length > 0) || 
                     (confirmedBook.flibustaVariants && confirmedBook.flibustaVariants.length > 0 && confirmedBook.flibustaVariants[0]?.formats)) ? (
                      <div>
                        {/* Saved download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {confirmedBook.flibustaVariants[0].formats
                            .filter(format => format.format !== 'mobi' && format.format !== 'read')
                            .map((format) => (
                              <a
                                key={format.format}
                                href={`${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL || 'https://flibusta-proxy.alphy-flibusta.workers.dev'}/${confirmedBook.flibustaVariants![0].sourceId}/${format.format}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-900 text-white hover:bg-gray-800 border border-gray-700"
                              >
                                {`.${format.format}`}
                              </a>
                            ))}
                          
                          {confirmedBook.flibustaVariants[0]?.formats.length > 0 && (
                            <a
                              href={`https://flibusta.is/b/${confirmedBook.flibustaVariants![0].sourceId}/read`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                            >
                              Read online (VPN)
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={skipFlibustaAndSave}
                          className="w-full px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                        >
                          Save Book
                        </button>
                        <p className="mt-2 text-sm text-gray-400 text-center">
                          You will be able to request download links once you add book to canvas.
                        </p>
                      </>
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
                <span>{isBookmarksPage ? 'Back' : 'Back to search'}</span>
              </button>
              
              {confirmedBook._id && user && (
                <button 
                  onClick={handleBookmarkToggle}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  {isBookmarked || isBookmarkHovered ? (
                    <BsBookmarkFill size={28} />
                  ) : (
                    <BsBookmark size={28} />
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-12">
              {/* Book cover */}
              <div className="w-full md:w-64 flex-shrink-0">
                {isBookmarksPage ? (
                  // 3D tilt effect for bookmarks page
                  <div 
                    ref={bookCoverRef}
                    className="relative group perspective-700"
                    onMouseMove={handleMouseMove}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div 
                      className="transform-gpu transition-transform duration-200 ease-out relative"
                      style={{ 
                        transform: isHovering 
                          ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.05, 1.05, 1.05)` 
                          : 'rotateX(0deg) rotateY(0deg)',
                        transformStyle: 'preserve-3d' 
                      }}
                    >
                      {confirmedBook.thumbnail ? (
                        <>
                          <img 
                            src={confirmedBook.source === 'openlib'
                              ? confirmedBook.thumbnail?.replace('-S.jpg', '-L.jpg')
                              : confirmedBook.highResThumbnail || confirmedBook.thumbnail}
                            alt={confirmedBook.title}
                            className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                            style={{ 
                              borderRadius: '4px',
                              boxShadow: isHovering 
                                ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                                : '0 4px 20px rgba(0, 0, 0, 0.3)',
                              transition: 'box-shadow 0.2s ease-out'
                            }}
                            onError={(e) => {
                              if (e.currentTarget.src !== confirmedBook.thumbnail) {
                                e.currentTarget.src = confirmedBook.thumbnail || '';
                              }
                            }}
                          />
                        </>
                      ) : (
                        <div 
                          className="w-full h-96 bg-gray-900 flex items-center justify-center shadow-lg" 
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: isHovering 
                              ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                              : '0 4px 20px rgba(0, 0, 0, 0.3)',
                            transition: 'box-shadow 0.2s ease-out'
                          }}
                        >
                          <span className="text-gray-600">No cover</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Regular view for non-bookmarks page
                  <div className="relative group">
                    {confirmedBook.thumbnail ? (
                      <>
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
                          onError={(e) => {
                            if (e.currentTarget.src !== confirmedBook.thumbnail) {
                              e.currentTarget.src = confirmedBook.thumbnail || '';
                            }
                          }}
                        />
                      </>
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
                )}
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
                  <h3 className="text-gray-200 text-lg font-medium mb-4">Download</h3>
                  {confirmedBook && 
                    ((confirmedBook.flibustaStatus === 'uploaded' && confirmedBook.flibustaVariants && confirmedBook.flibustaVariants.length > 0) || 
                     (confirmedBook.flibustaVariants && confirmedBook.flibustaVariants.length > 0 && confirmedBook.flibustaVariants[0]?.formats)) ? (
                      <div>
                        {/* Saved download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {confirmedBook.flibustaVariants[0].formats
                            .filter(format => format.format !== 'mobi' && format.format !== 'read')
                            .map((format) => (
                              <a
                                key={format.format}
                                href={`${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL || 'https://flibusta-proxy.alphy-flibusta.workers.dev'}/${confirmedBook.flibustaVariants![0].sourceId}/${format.format}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-900 text-white hover:bg-gray-800 border border-gray-700"
                              >
                                {`.${format.format}`}
                              </a>
                            ))}
                          
                          {confirmedBook.flibustaVariants[0]?.formats.length > 0 && (
                            <a
                              href={`https://flibusta.is/b/${confirmedBook.flibustaVariants![0].sourceId}/read`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                            >
                              Read online (VPN)
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={skipFlibustaAndSave}
                          className="w-full px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                        >
                          Save Book
                        </button>
                        <p className="mt-2 text-sm text-gray-400 text-center">
                          You will be able to request download links once you add book to canvas.
                        </p>
                      </>
                    )}
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
                setActiveApi(ApiSource.OpenLibrary);
                setDisplayAll(false);
                clearSearchResults();
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === ApiSource.OpenLibrary
                  ? 'bg-white text-black'
                  : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
              }`}
            >
              Openlibrary
            </button>
            <button
              onClick={() => {
                setActiveApi(ApiSource.Google);
                setDisplayAll(false);
                clearSearchResults();
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === ApiSource.Google
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
                  setActiveApi(ApiSource.Alphy);
                  setDisplayAll(false);
                  clearSearchResults();
                  setHasSearched(false);
                }}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  activeApi === ApiSource.Alphy
                    ? 'bg-white text-black'
                    : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
                } ${activeApi === ApiSource.Alphy ? 'rounded-l-md border-r-0' : 'rounded-md'}`}
              >
                Alphy
              </button>
              {activeApi === ApiSource.Alphy && (
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
                        {book.source === ApiSource.Alphy && (
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
                  {(activeApi === ApiSource.OpenLibrary || activeApi === ApiSource.Alphy) && (
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
            className="flex-1 py-4 text-base font-medium bg-gray-800 hover:bg-gray-700 transition-colors text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 