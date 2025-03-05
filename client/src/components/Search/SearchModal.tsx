import { useSearch } from '@/hooks/useSearch';
import { useBookDetails } from '@/hooks/useBookDetails';
import { BookSearchResult } from '@/types';
import { useMemo, useState, useEffect } from 'react';
import api from '@/services/api';

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(1);
    }
  };

  const handleFinalSubmit = async () => {
    if (confirmedBook) {
      try {
        if (shouldSaveToDb) {
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
            publishedYear: confirmedBook.first_publish_year
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
          
          if (!response.data) {
            throw new Error('Failed to save book');
          }
        }

        onBookSubmit(confirmedBook);
        onClose();
      } catch (error) {
        console.error('Error in handleFinalSubmit:', error);
        throw error;
      }
    }
  };

  const handleAlphySearch = async (page = 1) => {
    try {
      const response = await api.get(`/api/books?search=${encodeURIComponent(searchTerm)}&limit=5`);
      return response.data;
    } catch (error) {
      console.error('Error searching Alphy books:', error);
      throw error;
    }
  };

  if (confirmedBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={onClose}></div>
        
        <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
          {externalError && (
            <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-3 text-center">
              {externalError}
            </div>
          )}
          
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <button
                onClick={handleBackToSearch}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to search
              </button>
            </div>

            <div className="flex gap-8">
              {/* Book cover */}
              <div className="w-64 flex-shrink-0">
                {confirmedBook.thumbnail ? (
                  <img 
                    src={confirmedBook.source === 'openlib' 
                      ? confirmedBook.thumbnail.replace('-S.jpg', '-M.jpg') // Use medium resolution for details
                      : confirmedBook.highResThumbnail || confirmedBook.thumbnail} 
                    alt={confirmedBook.title}
                    className="w-full h-auto object-cover bg-gray-100"
                    style={{ borderRadius: 0 }}
                  />
                ) : (
                  <div className="w-full h-80 bg-gray-200 flex items-center justify-center" style={{ borderRadius: 0 }}>
                    <span className="text-gray-400">No cover</span>
                  </div>
                )}
              </div>

              {/* Book details */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-bold text-gray-900 rounded-sm">{confirmedBook.title}</h2>
                  <button className="text-sm text-blue-500 hover:text-blue-700">edit</button>
                </div>
                
                {confirmedBook.author_name && (
                  <p className="text-lg text-gray-700 mt-1">
                    {Array.isArray(confirmedBook.author_name) 
                      ? confirmedBook.author_name.join(', ') 
                      : confirmedBook.author_name}
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className="text-gray-300">★</span>
                    ))}
                  </div>
                  <span className="text-gray-500">n/a</span>
                </div>

                {/* Description */}
                <div className="mt-6">
                  <div className="flex justify-between items-start mb-2">
                    <button 
                      onClick={() => setIsEditingDescription(true)}
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      edit
                    </button>
                  </div>
                  {isLoadingDetails ? (
                    <div className="text-gray-500">Loading description...</div>
                  ) : isEditingDescription ? (
                    <div className="space-y-2">
                      <textarea
                        value={confirmedBook.description || ''}
                        onChange={(e) => {
                          setConfirmedBook({
                            ...confirmedBook,
                            description: e.target.value
                          });
                        }}
                        className="w-full h-32 p-2 border rounded-md text-gray-700 text-sm"
                        placeholder="Enter book description..."
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditingDescription(false)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : confirmedBook.description ? (
                    <div>
                      <p className="text-gray-700 text-sm">
                        {showFullDescription 
                          ? confirmedBook.description
                          : confirmedBook.description.slice(0, 420)}
                      </p>
                      {confirmedBook.description.length > 420 && (
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

          {/* Bottom buttons */}
          <div className="flex mt-auto">
            <button
              onClick={handleFinalSubmit}
              className="flex-1 py-4 text-base font-medium bg-gray-300 hover:bg-gray-400 rounded-br-lg text-gray-900"
            >
              Everything is correct - submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={onClose}></div>
      
      <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
        {(externalError || searchError) && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-3 text-center">
            {externalError || searchError}
          </div>
        )}
        
        <div className="p-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDisplayAll(false);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter book name...."
              className="flex-1 px-4 py-2 rounded-md bg-gray-100 border-0 text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={() => handleSearch(1)}
              className="px-6 py-2 rounded-md bg-gray-200 text-gray-900 text-base font-medium hover:bg-gray-300"
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
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'openlib'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Openlibrary
            </button>
            <button
              onClick={() => {
                setActiveApi('google');
                setDisplayAll(false);
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'google'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Google Books
            </button>
            <button
              onClick={() => {
                setActiveApi('alphy');
                setDisplayAll(false);
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'alphy'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Alphy
            </button>
            {activeApi === 'alphy' && (
              <button
                onClick={() => {
                  const newDisplayAll = !displayAll;
                  setDisplayAll(newDisplayAll);
                  setSearchTerm('');
                  handleSearch(1);
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  displayAll
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Display all from Alphy
              </button>
            )}
          </div>
        </div>

        {/* Content area with class for scroll position management */}
        <div className="flex-1 px-6 overflow-y-auto search-results-container">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map(({ book, isFirstExternalResult, hasDbResults }: FilteredResult) => (
                <div key={book.key}>
                  {isFirstExternalResult && hasDbResults && (
                    <div className="border-t-2 border-gray-300 my-4 pt-2" />
                  )}
                  <div
                    className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex gap-3 ${
                      selectedBook?.key === book.key ? 'bg-blue-50' : ''
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
                      <div className="w-12 h-16 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No cover</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {book.title}
                        {book.source === 'alphy' && (
                          <span className="ml-2 text-xs text-green-600 font-normal">
                            In database
                          </span>
                        )}
                      </h3>
                      {book.author_name && (
                        <p className="text-sm text-gray-600">
                          by {Array.isArray(book.author_name) ? book.author_name.join(', ') : book.author_name}
                          {book.first_publish_year && ` (${book.first_publish_year})`}
                        </p>
                      )}
                      {selectedBook?.key === book.key && (
                        <p className="text-sm text-blue-600 mt-1">Click again to confirm selection</p>
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
                    onClick={() => handleSearch(currentPage + 1)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-gray-900 hover:text-blue-600"
                  >
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
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 