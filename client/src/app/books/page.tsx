'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SearchModal } from '@/components/Search/SearchModal';
import { BookSearchResult } from '@/types';
import api from '@/services/api';
import { FlibustaSearch } from '@/components/Search/FlibustaSearch';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import GlobeWebBackground from '@/components/GlobeWebBackground';
import { BsBookmark, BsBookmarkFill } from 'react-icons/bs';
import { bookmarkBook, isBookBookmarked } from '@/utils/bookUtils';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
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

interface BookData {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  publishedYear?: number;
  flibustaStatus: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
  flibustaLastChecked?: Date;
  flibustaVariants?: Array<{
    title: string;
    author: string;
    sourceId: string;
    formats: Array<{
      format: string;
      url: string;
    }>;
  }>;
  bookmarks?: Array<{
    user: string;
  }>;
}

interface BooksResponse {
  books: BookData[];
  pagination: PaginationData;
}

export default function BooksPage() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Flibusta integration state variables
  const [flibustaResults, setFlibustaResults] = useState<FlibustaResult[]>([]);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<FlibustaResult | null>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);
  const [showFlibustaSearchModal, setShowFlibustaSearchModal] = useState(false);
  const [triggerFlibustaSearch, setTriggerFlibustaSearch] = useState<(() => void) | undefined>();

  const bookCoverRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const { isAuthenticated, isAdmin, user } = useAuth();

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await api.get('/api/books?limit=0');
        const data = response.data;
        setBooks(data.books);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching books:', error);
        setError('Failed to load books');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []);

  useEffect(() => {
    console.log('isAdmin:', isAdmin);
  }, [isAdmin]);

  // Update bookmark state when a book is selected
  useEffect(() => {
    if (selectedBook && user) {
      // Check if the book is bookmarked by the current user
      const isMarked = selectedBook.bookmarks?.some(bookmark => 
        bookmark.user === user._id || bookmark.user === (user._id as any).toString()
      );
      setIsBookmarked(!!isMarked);
    } else {
      setIsBookmarked(false);
    }
  }, [selectedBook, user]);

  const handleBookSubmit = async (bookData: BookSearchResult) => {
    try {
      // If the book already has an _id, it means it was already saved in SearchModal
      if (bookData._id) {
        // Just refresh the books list
        const booksResponse = await api.get('/api/books?limit=0');
        setBooks(booksResponse.data.books);
        setPagination(booksResponse.data.pagination);
        setIsSearchModalOpen(false);
        
        // Find the book in the refreshed list and open it
        const addedBook = booksResponse.data.books.find((book: BookData) => book._id === bookData._id);
        if (addedBook) {
          setSelectedBook(addedBook);
        }
        
        return;
      }

      // Save book to database
      const response = await api.post('/api/books', {
        title: bookData.title,
        author: Array.isArray(bookData.author_name) 
          ? bookData.author_name.join(', ') 
          : bookData.author_name || 'Unknown',
        description: bookData.description || '',
        coverImage: bookData.thumbnail || 'https://via.placeholder.com/300x400?text=No+Cover',
        publishedYear: bookData.first_publish_year
      });

      // Refresh the books list
      const booksResponse = await api.get('/api/books?limit=0');
      setBooks(booksResponse.data.books);
      setPagination(booksResponse.data.pagination);

      // Open the newly added book
      setSelectedBook(response.data);
      
      // Close the modal
      setIsSearchModalOpen(false);
    } catch (error) {
      console.error('Error saving book:', error);
      setError(error instanceof Error ? error.message : 'Failed to save book');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/books/${bookId}`);

      // Remove the book from the local state
      setBooks(books.filter(book => book._id !== bookId));
      setSelectedBook(null);
    } catch (error) {
      console.error('Error deleting book:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete book');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestDownloadLinks = async () => {
    if (!selectedBook) return;
    
    setIsFlibustaSearching(true);
    setFlibustaError(null);
    setShowFlibustaResults(true);

    try {
      const response = await api.get(`/api/books/flibusta/search?query=${encodeURIComponent(selectedBook.title)}`);
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
    console.log('Selected variant:', variant);
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map(format => ({
        format: format.format,
        url: `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${variant.id}/${format.format}`
      }))
    };
    console.log('Processed variant:', originalVariant);

    setSelectedVariant(originalVariant);
    setShowFlibustaResults(false);
  };

  const handleCloseBookWindow = () => {
    setSelectedBook(null);
    setShowFullDescription(false);
    setFlibustaResults([]);
    setFlibustaError(null);
    setSelectedVariant(null);
    setShowFlibustaResults(false);
  };

  const handleClearDownloadLinks = async () => {
    if (!selectedBook) return;
    
    if (window.confirm('Are you sure you want to clear download links?')) {
      try {
        const response = await api.post(`/api/books/${selectedBook._id}/clear-flibusta`);
        const updatedBook = response.data;
        
        setBooks(prevBooks => 
          prevBooks.map(book => book._id === updatedBook._id ? updatedBook : book)
        );
        setSelectedBook(updatedBook);
        setSelectedVariant(null);
        toast.success('Download links cleared successfully');
      } catch (error) {
        console.error('Error clearing download links:', error);
        toast.error('Failed to clear download links');
      }
    }
  };

  const handleManualSearch = () => {
    handleCloseBookWindow();
    setTriggerFlibustaSearch(() => Date.now);
  };

  const handleSaveDownloadLinks = async () => {
    try {
      if (!selectedBook || !selectedVariant) {
        console.error('No book or variant selected');
        toast.error('Please select a book and variant first');
        return;
      }

      console.log('Saving download links for book:', selectedBook._id);
      console.log('Selected variant data:', selectedVariant);

      const response = await api.post(`/api/books/${selectedBook._id}/save-flibusta`, {
        variant: {
          title: selectedVariant.title,
          author: selectedVariant.author,
          sourceId: selectedVariant.id,
          formats: [
            ...selectedVariant.formats.map(format => ({
              format: format.format,
              url: `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${selectedVariant.id}/${format.format}`
            })),
            {
              format: 'read',
              url: `https://flibusta.is/b/${selectedVariant.id}/read`
            }
          ]
        }
      });

      console.log('Server response:', response.data);
      const updatedBook = response.data;
      
      // Update both the books list and selected book
      setBooks(prevBooks => 
        prevBooks.map(book => book._id === updatedBook._id ? updatedBook : book)
      );
      setSelectedBook(updatedBook);
      setSelectedVariant(null);
      setShowFlibustaResults(false);

      toast.success('Download links saved successfully');
    } catch (error) {
      console.error('Error saving download links:', error);
      toast.error('Failed to save download links');
    }
  };

  const handleBookClick = (bookId: string) => {
    if (expandedBookId === bookId) {
      // If clicking on already expanded book, open the full book window
      const book = books.find(b => b._id === bookId);
      if (book) {
        setSelectedBook(book);
      }
    } else {
      // Toggle expanded book
      setExpandedBookId(expandedBookId === bookId ? null : bookId);
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        
        // Sanitize the search term to prevent special characters from causing issues
        const sanitizedSearchTerm = searchTerm.trim()
          .replace(/\\/g, '') // Remove backslashes
          .replace(/[^\p{L}\p{N}\p{Z}\p{P}]/gu, ''); // Keep only letters, numbers, spaces, and punctuation
        
        // Only proceed with search if we have something to search for after sanitization
        if (sanitizedSearchTerm) {
          const response = await api.get(`/api/books?search=${encodeURIComponent(sanitizedSearchTerm)}&limit=0`);
          setBooks(response.data.books);
          setPagination(response.data.pagination);
        } else {
          // If sanitization removed all characters, show empty results
          setBooks([]);
          setPagination({ page: 1, limit: 0, total: 0 });
        }
      } catch (error) {
        console.error('Error searching books:', error);
        setError('Failed to search books');
        // Set empty results on error so UI doesn't remain in previous state
        setBooks([]);
        setPagination({ page: 1, limit: 0, total: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  };

  const handleShowAll = async () => {
    try {
      setIsLoading(true);
      setSearchTerm('');
      const response = await api.get('/api/books?limit=0');
      setBooks(response.data.books);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching all books:', error);
      setError('Failed to load books');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = () => {
    // Implementation of handleFinalSubmit function
  };

  // Handle 3D tilt effect for book cover
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

  // Handle bookmarking/unbookmarking a book
  const handleBookmarkToggle = async () => {
    if (!selectedBook || !user) {
      toast.error('You must be logged in to bookmark books');
      return;
    }

    try {
      const result = await bookmarkBook(selectedBook._id);
      
      if (result.success) {
        // Set the isBookmarked state based on the server response
        setIsBookmarked(result.isBookmarked);
        
        // If the book is in the books array, update it with the new bookmark status
        setBooks(prevBooks => prevBooks.map(book => {
          if (book._id === selectedBook._id) {
            // Create a new book with updated bookmarks
            const updatedBook = {...book};
            
            // Initialize bookmarks array if it doesn't exist
            if (!updatedBook.bookmarks) {
              updatedBook.bookmarks = [];
            }
            
            if (result.isBookmarked) {
              // Add user to bookmarks if not already there
              if (!updatedBook.bookmarks.some(bookmark => bookmark.user === user._id)) {
                updatedBook.bookmarks.push({ user: user._id });
              }
            } else {
              // Remove user from bookmarks
              updatedBook.bookmarks = updatedBook.bookmarks.filter(
                bookmark => bookmark.user !== user._id
              );
            }
            
            return updatedBook;
          }
          return book;
        }));
        
        // Also update the selectedBook
        setSelectedBook(prevBook => {
          if (!prevBook) return null;
          
          const updatedBook = {...prevBook};
          
          // Initialize bookmarks array if it doesn't exist
          if (!updatedBook.bookmarks) {
            updatedBook.bookmarks = [];
          }
          
          if (result.isBookmarked) {
            // Add user to bookmarks if not already there
            if (!updatedBook.bookmarks.some(bookmark => bookmark.user === user._id)) {
              updatedBook.bookmarks.push({ user: user._id });
            }
          } else {
            // Remove user from bookmarks
            updatedBook.bookmarks = updatedBook.bookmarks.filter(
              bookmark => bookmark.user !== user._id
            );
          }
          
          return updatedBook;
        });
        
        toast.success(result.isBookmarked ? 'Book bookmarked successfully' : 'Book removed from bookmarks');
      }
    } catch (error) {
      console.error('Error bookmarking book:', error);
      toast.error('Failed to update bookmark status');
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-black text-white relative">
      {/* Globe web background */}
      <GlobeWebBackground />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="flex flex-col items-center justify-center mt-28">
          <div className="flex flex-col items-center justify-center mb-12">
            <p className="text-2xl font-bold font-ibm-plex-mono">alphy</p>
            <p className="text-2xl font-ibm-plex-mono mt-1">digital library</p>
          </div>
        </div>
        
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-6 w-full max-w-3xl">
            <div className="bg-[#080808] border border-gray-800 hover:border-gray-700 text-gray-400 px-8 py-3 rounded-xl text-lg flex-shrink-0 cursor-pointer text-base transition-all duration-300 hover:bg-[#111]"
                 onClick={() => setIsSearchModalOpen(true)}>
              Add Book
            </div>
            
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search books..."
                className="w-full px-6 py-3 bg-[#080808] text-gray-400 rounded-xl pr-12 border border-gray-800 placeholder-gray-600 focus:border-gray-700 focus:outline-none"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer"
                   onClick={handleSearch}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center mb-16">
          <p className="text-sm text-center text-gray-600 max-w-2xl font-ibm-plex-mono">
            By adding books to your maps or this page, you store them on Alphy.<br />
            Browse or view all stored books below.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-start items-center mb-8">
            <button 
              className="text-white hover:underline"
              onClick={handleShowAll}
            >
              Show all
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center">{error}</div>
          ) : books.length === 0 ? (
            <div className="text-gray-400 text-center">nothing found in Alphy database. Add new book.</div>
          ) : (
            <div className="overflow-hidden">
              <div className="flex flex-wrap gap-3">
                {books.slice(0, 20).map((book, index) => (
                  <div
                    key={book._id}
                    className={`transition-all duration-300 cursor-pointer flex-shrink-0 ${
                      expandedBookId === book._id ? 'z-30' : 'z-10'
                    }`}
                    style={{ 
                      position: 'relative',
                      height: expandedBookId === book._id ? 'var(--expanded-book-height, 280px)' : 'var(--book-height, 280px)',
                      width: expandedBookId === book._id ? 'var(--expanded-book-width, 600px)' : 'var(--book-width, 50px)',
                      background: expandedBookId === book._id ? '#0A0A0A' : 'black',
                      borderRadius: expandedBookId === book._id ? '0.5rem' : '0.25rem',
                      border: expandedBookId === book._id ? '1px solid rgb(55 65 81)' : '1px solid rgb(31 41 55)',
                      ...(expandedBookId === book._id && index >= 10 ? { 
                        marginLeft: 'var(--expanded-book-margin, -550px)'  // Make the shifted margin responsive
                      } : {})
                    }}
                    onClick={() => handleBookClick(book._id)}
                  >
                    {expandedBookId === book._id ? (
                      <div className="flex h-full w-full relative">
                        <div className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer z-10"
                             onClick={(e) => {
                               e.stopPropagation();
                               setExpandedBookId(null);
                             }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <div className="expanded-book-cover flex-shrink-0">
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-700">
                              No cover
                            </div>
                          )}
                        </div>
                        <div className="flex-1 expanded-book-content overflow-hidden">
                          <h3 className="expanded-book-title font-semibold mb-1">{book.title}</h3>
                          <p className="expanded-book-author text-gray-400 mb-4">{book.author}</p>
                          <p className="expanded-book-description text-gray-300 line-clamp-6 leading-relaxed">
                            {book.description || "No description available."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="vertical-text overflow-hidden" style={{ maxHeight: 'calc(var(--book-height, 260px) - 20px)' }}>
                          {book.title.length > 50 
                            ? book.title.substring(0, 50) + '...' 
                            : book.title}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isSearchModalOpen && (
        <SearchModal 
          onClose={() => setIsSearchModalOpen(false)} 
          onBookSubmit={handleBookSubmit}
        />
      )}

      {selectedBook && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={handleCloseBookWindow}></div>
          <div 
            className="border border-gray-800 rounded-xl modal-container relative flex flex-col overflow-hidden modal-bg"
          >
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar modal-content">
              <div className="flex justify-between items-start mb-8">
                <button
                  onClick={handleCloseBookWindow}
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
                  <span>Back to library</span>
                </button>
                
                {/* Bookmark button in top right */}
                {user && (
                  <button 
                    onClick={handleBookmarkToggle}
                    onMouseEnter={() => setIsBookmarkHovered(true)}
                    onMouseLeave={() => setIsBookmarkHovered(false)}
                    className="text-white"
                  >
                    {isBookmarked || isBookmarkHovered ? (
                      <BsBookmarkFill size={24} />
                    ) : (
                      <BsBookmark size={24} />
                    )}
                  </button>
                )}
              </div>

              <div className="book-details flex flex-col md:flex-row gap-12">
                {/* Book cover with 3D tilt effect */}
                <div className="book-cover-container w-full md:w-64 flex-shrink-0">
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
                      {selectedBook.coverImage ? (
                        <img 
                          src={selectedBook.coverImage} 
                          alt={selectedBook.title}
                          className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: isHovering 
                              ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                              : '0 4px 20px rgba(0, 0, 0, 0.3)',
                            transition: 'box-shadow 0.2s ease-out'
                          }}
                        />
                      ) : (
                        <div 
                          className="w-full book-cover-placeholder flex items-center justify-center shadow-lg" 
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

                  {/* Delete button - visible only to admins */}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
                          handleDeleteBook(selectedBook._id);
                        }
                      }}
                      disabled={isDeleting}
                      className="w-full mt-6 px-4 py-3 bg-opacity-80 bg-red-900 hover:bg-red-800 text-red-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 border border-red-800"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Book'}
                    </button>
                  )}
                </div>

                {/* Book details */}
                <div className="book-info flex-1 mt-4 md:mt-0">
                  <h2 className="book-title mb-3">{selectedBook.title}</h2>
                  <p className="book-author mb-6 font-light">{selectedBook.author}</p>

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
                    <h3 className="book-section-title mb-3">About this book</h3>
                    {selectedBook.description ? (
                      <div>
                        <p className={`book-description leading-relaxed ${!showFullDescription ? 'line-clamp' : ''}`}>
                          {showFullDescription 
                            ? selectedBook.description
                            : selectedBook.description.slice(0, 280)}
                        </p>
                        {selectedBook.description.length > 280 && (
                          <button
                            onClick={() => setShowFullDescription(!showFullDescription)}
                            className="text-sm text-gray-500 hover:text-gray-300 mt-2 transition-colors focus:outline-none"
                          >
                            {showFullDescription ? 'Show less' : 'Show more'}
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
                    {selectedBook?.flibustaStatus === 'uploaded' && selectedBook.flibustaVariants?.[0] ? (
                      <div>
                        {/* Saved download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {selectedBook.flibustaVariants[0].formats
                            .filter(format => format.format !== 'mobi')
                            .map((format) => (
                            <button
                              key={format.format}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (format.format === 'read') {
                                    window.open(format.url, '_blank');
                                    return;
                                  }
                                  
                                  // Direct access to Cloudflare worker URL
                                  window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${selectedBook.flibustaVariants![0].sourceId}/${format.format}`;
                                } catch (err) {
                                  console.error('Error getting download link:', err);
                                  toast.error('Failed to get download link. Please try again.');
                                }
                              }}
                              className={`px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 ${
                                format.format === 'read'
                                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-700'
                              }`}
                            >
                              {format.format === 'read' ? 'Read online (VPN)' : `.${format.format}`}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleClearDownloadLinks}
                          className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear download links
                        </button>
                      </div>
                    ) : selectedVariant ? (
                      <div>
                        {/* Preview download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {[
                            ...selectedVariant.formats.filter(format => format.format !== 'mobi'),
                            { format: 'read', url: `https://flibusta.is/b/${selectedVariant.id}/read` }
                          ].map((format) => (
                            <button
                              key={format.format}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (format.format === 'read') {
                                    window.open(format.url, '_blank');
                                    return;
                                  }

                                  // Direct access to Cloudflare worker URL
                                  window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${selectedVariant.id}/${format.format}`;
                                } catch (err) {
                                  console.error('Error getting download link:', err);
                                  toast.error('Failed to get download link. Please try again.');
                                }
                              }}
                              className={`px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 ${
                                format.format === 'read'
                                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-700'
                              }`}
                            >
                              {format.format === 'read' ? 'Read online (VPN)' : `.${format.format}`}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleSaveDownloadLinks}
                          className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                        >
                          Everything is correct - submit
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
                        <div className="flex flex-wrap gap-4">
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
                              'Request download links'
                            }
                          </button>
                          
                          <button
                            onClick={() => {
                              // Just close the book window to return to the books list
                              handleCloseBookWindow();
                            }}
                            className="px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                          >
                            Save Book Without Links
                          </button>
                        </div>
                        
                        {!isFlibustaSearching && showFlibustaResults && flibustaResults.length === 0 && (
                          <div className="mt-4 text-gray-400">
                            Not found. Use{' '}
                            <button
                              onClick={handleManualSearch}
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              manual search
                            </button>
                          </div>
                        )}
                      </div>
                    )}

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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add responsive CSS variables */}
      <style jsx global>{`
        :root {
          --book-height: 280px;
          --book-width: 50px;
          --expanded-book-height: 280px;
          --expanded-book-width: 600px;
          --expanded-book-margin: -550px;
        }
        
        @media (max-width: 768px) {
          :root {
            --book-height: 200px;
            --book-width: 30px;
            --expanded-book-height: 200px;
            --expanded-book-width: 400px;
            --expanded-book-margin: -370px;
          }
        }
        
        @media (max-width: 480px) {
          :root {
            --book-height: 160px;
            --book-width: 25px;
            --expanded-book-height: 160px;
            --expanded-book-width: 280px;
            --expanded-book-margin: -250px;
          }
        }
        
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          white-space: nowrap;
          font-size: 0.8rem;
          padding: 10px 4px;
          color: #aaa;
        }
        
        @media (max-width: 768px) {
          .vertical-text {
            font-size: 0.7rem;
            padding: 8px 2px;
          }
        }
        
        @media (max-width: 480px) {
          .vertical-text {
            font-size: 0.6rem;
            padding: 6px 1px;
          }
        }
        
        /* Expanded book cover */
        .expanded-book-cover {
          width: 200px;
          height: 100%;
        }
        
        /* Expanded book content */
        .expanded-book-content {
          padding: 1.5rem;
        }
        
        .expanded-book-title {
          font-size: 1.25rem;
        }
        
        .expanded-book-author {
          font-size: 0.875rem;
        }
        
        .expanded-book-description {
          font-size: 0.875rem;
        }
        
        /* Modal specific styles */
        .modal-container {
          width: 800px;
          height: 80vh;
          box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
        }
        
        .modal-bg {
          background: linear-gradient(135deg, 
            rgba(18, 18, 20, 1) 0%, 
            rgba(12, 12, 14, 1) 40%, 
            rgba(8, 8, 10, 1) 60%, 
            rgba(5, 5, 7, 1) 80%, 
            rgba(3, 3, 5, 1) 100%);
          position: relative;
        }
        
        .modal-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at top left,
            rgba(40, 40, 50, 0.2),
            transparent 60%
          );
          z-index: 0;
        }
        
        .modal-content {
          padding: 1.5rem;
          position: relative;
          z-index: 1;
        }
        
        .book-cover-container {
          width: 240px;
        }
        
        .book-cover-placeholder {
          height: 350px;
        }
        
        .book-title {
          font-size: 1.75rem;
          font-weight: bold;
          color: white;
          margin-bottom: 0.5rem;
        }
        
        .book-author {
          font-size: 1.125rem;
          color: #d1d5db;
          margin-bottom: 1rem;
        }
        
        .book-section-title {
          color: #e5e7eb;
          font-size: 1.125rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }
        
        .book-description {
          color: #9ca3af;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        
        .line-clamp {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
          overflow: hidden;
        }
        
        .flex.items-center.gap-2.mb-6 {
          margin-bottom: 1rem;
        }
        
        .mb-8 {
          margin-bottom: 1.5rem;
        }
        
        .mt-8 {
          margin-top: 1.5rem;
        }
        
        .text-gray-200.text-lg.font-medium.mb-4 {
          margin-bottom: 0.75rem;
        }
        
        @media (max-width: 768px) {
          .expanded-book-cover {
            width: 120px;
          }
          
          .expanded-book-content {
            padding: 1rem;
          }
          
          .expanded-book-title {
            font-size: 1rem;
          }
          
          .expanded-book-author {
            font-size: 0.75rem;
          }
          
          .expanded-book-description {
            font-size: 0.75rem;
            -webkit-line-clamp: 5;
          }
          
          /* Modal tablet styles */
          .modal-container {
            width: 90vw;
            height: 75vh;
          }
          
          .modal-content {
            padding: 1.25rem;
          }
          
          .book-details {
            gap: 1.5rem;
          }
          
          .book-cover-container {
            width: 180px;
          }
          
          .book-cover-placeholder {
            height: 270px;
          }
          
          .book-title {
            font-size: 1.4rem;
          }
          
          .book-author {
            font-size: 1rem;
          }
          
          .book-section-title {
            font-size: 1rem;
          }
          
          .book-description {
            font-size: 0.85rem;
            line-height: 1.35;
          }
          
          .line-clamp {
            -webkit-line-clamp: 4;
          }
        }
        
        @media (max-width: 480px) {
          .expanded-book-cover {
            width: 80px;
          }
          
          .expanded-book-content {
            padding: 0.75rem;
          }
          
          .expanded-book-title {
            font-size: 0.875rem;
          }
          
          .expanded-book-author {
            font-size: 0.7rem;
            margin-bottom: 0.5rem;
          }
          
          .expanded-book-description {
            font-size: 0.7rem;
            -webkit-line-clamp: 4;
          }
          
          /* Modal mobile styles */
          .modal-container {
            width: 95vw;
            height: 80vh;
            max-height: 540px;
          }
          
          .modal-content {
            padding: 1rem 0.75rem;
          }
          
          .book-details {
            flex-direction: column;
            gap: 1rem;
          }
          
          .book-cover-container {
            width: 120px;
            margin: 0 auto;
          }
          
          .book-cover-placeholder {
            height: 180px;
          }
          
          .book-title {
            font-size: 1.2rem;
          }
          
          .book-author {
            font-size: 0.875rem;
            margin-bottom: 0.75rem;
          }
          
          .book-section-title {
            font-size: 0.875rem;
            margin-bottom: 0.375rem;
          }
          
          .book-description {
            font-size: 0.775rem;
            line-height: 1.3;
          }
          
          .line-clamp {
            -webkit-line-clamp: 3;
          }
        }
      `}</style>
    </div>
  );
} 