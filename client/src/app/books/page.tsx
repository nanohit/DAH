'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SearchModal } from '@/components/Search/SearchModal';
import { BookSearchResult } from '@/types';

interface BookData {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  publishedYear?: number;
}

interface PaginationData {
  total: number;
  page: number;
  pages: number;
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

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/books', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch books');
        }
        const data: BooksResponse = await response.json();
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

  const handleBookSubmit = async (bookData: BookSearchResult) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to add books');
      }

      // Save book to database
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: bookData.title,
          author: Array.isArray(bookData.author_name) 
            ? bookData.author_name.join(', ') 
            : bookData.author_name || 'Unknown',
          description: bookData.description || '',
          coverImage: bookData.thumbnail || '',
          publishedYear: bookData.first_publish_year
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save book');
      }

      // Refresh the books list
      const booksResponse = await fetch('/api/books', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!booksResponse.ok) {
        throw new Error('Failed to fetch updated books');
      }
      const data: BooksResponse = await booksResponse.json();
      setBooks(data.books);
      setPagination(data.pagination);

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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to delete books');
      }

      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete book');
      }

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

  return (
    <div className="h-[calc(100vh-4rem)] bg-white">
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex gap-4">
          <Link href="/maps" className="text-2xl font-bold text-gray-400 hover:text-gray-600">
            Maps
          </Link>
          <h1 className="text-2xl font-bold">BooksDB</h1>
        </div>
        <div>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Add Book
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="grid grid-cols-6 gap-6">
            {books.map((book) => (
              <div
                key={book._id}
                className="cursor-pointer group"
                onClick={() => setSelectedBook(book)}
              >
                <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      style={{ borderRadius: 0 }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No cover
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 text-white transform translate-y-full group-hover:translate-y-0 transition-transform">
                    <div className="text-sm font-semibold truncate">{book.title}</div>
                    <div className="text-xs truncate">{book.author}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSearchModalOpen && (
        <SearchModal 
          onClose={() => setIsSearchModalOpen(false)} 
          onBookSubmit={handleBookSubmit}
        />
      )}

      {selectedBook && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={() => setSelectedBook(null)}></div>
          <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Back to library
                </button>
              </div>

              <div className="flex gap-8">
                {/* Book cover */}
                <div className="w-64 flex-shrink-0">
                  {selectedBook.coverImage ? (
                    <img 
                      src={selectedBook.coverImage} 
                      alt={selectedBook.title}
                      className="w-full h-auto object-cover bg-gray-100"
                      style={{ borderRadius: 0 }}
                    />
                  ) : (
                    <div className="w-full h-80 bg-gray-200 flex items-center justify-center" style={{ borderRadius: 0 }}>
                      <span className="text-gray-400">No cover</span>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
                        handleDeleteBook(selectedBook._id);
                      }
                    }}
                    disabled={isDeleting}
                    className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Book'}
                  </button>
                </div>

                {/* Book details */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedBook.title}</h2>
                  <p className="text-lg text-gray-700 mb-4">{selectedBook.author}</p>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mt-4 mb-6">
                    <div className="flex">
                      {[1,2,3,4,5].map((star) => (
                        <span key={star} className="text-gray-300">★</span>
                      ))}
                    </div>
                    <span className="text-gray-500">n/a</span>
                  </div>

                  {/* Description */}
                  <div className="mt-6">
                    {selectedBook.description ? (
                      <div>
                        <p className="text-gray-700 text-sm">
                          {showFullDescription 
                            ? selectedBook.description
                            : selectedBook.description.slice(0, 420)}
                        </p>
                        {selectedBook.description.length > 420 && (
                          <button
                            onClick={() => setShowFullDescription(!showFullDescription)}
                            className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                          >
                            {showFullDescription ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No description available</span>
                    )}
                  </div>

                  {/* Download links button */}
                  <button
                    className="mt-8 px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Request download links
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 