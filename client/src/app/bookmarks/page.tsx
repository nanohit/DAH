'use client';

import { useState, useEffect } from 'react';
import PostList from '@/components/PostList';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getBookmarkedMaps, SavedMap, bookmarkMap } from '@/utils/mapUtils';
import { getBookmarkedBooks, BookData, bookmarkBook } from '@/utils/bookUtils';
import Link from 'next/link';
import MapCommentSection from '@/components/MapCommentSection';
import { toast } from 'react-hot-toast';
import { SearchModal } from '@/components/Search/SearchModal';

interface BookmarkData {
  user: string | { _id: string };
  timestamp: string;
}

// BookCard component with its own state
const BookCard = ({ book, onBookmarkToggle, onOpen }: { 
  book: BookData; 
  onBookmarkToggle: (bookId: string) => void; 
  onOpen: (book: BookData) => void; 
}) => {
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  return (
    <div 
      key={book._id} 
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col"
    >
      <div 
        className="cursor-pointer flex-grow" 
        onClick={() => onOpen(book)}
      >
        <div className="relative h-64 overflow-hidden">
          <img 
            src={book.coverImage} 
            alt={book.title}
            className="w-full h-full object-cover"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle(book._id);
            }}
            onMouseEnter={() => setIsBookmarkHovered(true)}
            onMouseLeave={() => setIsBookmarkHovered(false)}
            className="absolute top-2 right-2 text-white hover:text-red-500 transition-colors"
            title="Remove from bookmarks"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          <h3 className="font-medium text-gray-900 truncate hover:underline">{book.title}</h3>
          <p className="text-gray-500 text-sm">{book.author}</p>
        </div>
      </div>
    </div>
  );
};

export default function BookmarksPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [key, setKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'maps' | 'books'>('posts');
  const [bookmarkedMaps, setBookmarkedMaps] = useState<SavedMap[]>([]);
  const [bookmarkedBooks, setBookmarkedBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchBookmarkedItems = async () => {
      setLoading(true);
      try {
        if (activeTab === 'maps') {
          const maps = await getBookmarkedMaps();
          setBookmarkedMaps(maps);
        } else if (activeTab === 'books') {
          const books = await getBookmarkedBooks();
          // Sort books by bookmark timestamp, newest first
          const sortedBooks = [...books].sort((a, b) => {
            // Find the timestamp for the current user's bookmark
            const timestampA = a.bookmarks?.find(bm => 
              typeof bm.user === 'string' 
                ? bm.user === user?._id 
                : (bm.user as { _id: string })._id === user?._id)?.timestamp || '';
            
            const timestampB = b.bookmarks?.find(bm => 
              typeof bm.user === 'string' 
                ? bm.user === user?._id 
                : (bm.user as { _id: string })._id === user?._id)?.timestamp || '';
            
            // Sort descending (newest first)
            return new Date(timestampB).getTime() - new Date(timestampA).getTime();
          });
          setBookmarkedBooks(sortedBooks);
        }
      } catch (error) {
        console.error(`Error fetching bookmarked ${activeTab}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarkedItems();
  }, [activeTab, user?._id]);

  const handlePostUpdated = () => {
    setKey(prev => prev + 1);
  };

  // Format date in the style of "18:27 Today" or "Jul 23"
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // Check if the date is today
      const isToday = date.getDate() === now.getDate() &&
                     date.getMonth() === now.getMonth() &&
                     date.getFullYear() === now.getFullYear();
      
      if (isToday) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} Today`;
      } else {
        // Return a simple date format for non-today dates
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // User badge component
  const UserBadge = ({ badge }: { badge?: string }) => {
    if (!badge) return null;

    return (
      <span className="text-[12px] text-gray-400 font-normal -mt-[2px] block leading-tight">
        {badge}
      </span>
    );
  };

  // Handle opening a map
  const handleOpenMap = (mapId: string) => {
    router.push(`/maps?id=${mapId}`);
  };

  // Handle bookmarking/unbookmarking a map
  const handleBookmarkMap = async (mapId: string) => {
    if (!user) {
      toast.error('You must be logged in to bookmark maps');
      return;
    }
    
    try {
      console.log(`Toggling bookmark for map with ID: ${mapId}`);
      const success = await bookmarkMap(mapId);
      
      if (success) {
        // Remove the map from the bookmarked maps list
        setBookmarkedMaps(prevMaps => prevMaps.filter(map => map._id !== mapId));
        toast.success('Map removed from bookmarks');
      } else {
        console.error(`Failed to toggle bookmark for map: ${mapId}`);
        toast.error('Failed to update bookmark status');
      }
    } catch (error) {
      console.error('Error bookmarking map:', error);
      toast.error('Failed to update bookmark status');
    }
  };

  // Handle bookmarking/unbookmarking a book
  const handleBookmarkBook = async (bookId: string) => {
    if (!user) {
      toast.error('You must be logged in to bookmark books');
      return;
    }
    
    try {
      const result = await bookmarkBook(bookId);
      
      if (result.success) {
        // If the book was successfully unbookmarked, remove it from the list
        if (!result.isBookmarked) {
          setBookmarkedBooks(prevBooks => prevBooks.filter(book => book._id !== bookId));
          toast.success('Book removed from bookmarks');
        }
      } else {
        toast.error('Failed to update bookmark status');
      }
    } catch (error) {
      console.error('Error bookmarking book:', error);
      toast.error('Failed to update bookmark status');
    }
  };

  // Handle opening book details
  const handleOpenBook = (book: BookData) => {
    // Open book in modal instead of redirecting
    setSelectedBook(book);
  };

  // Handle closing book modal
  const handleCloseBookModal = () => {
    setSelectedBook(null);
  };

  // Handle book submission (if needed)
  const handleBookSubmit = (bookData: any) => {
    handleCloseBookModal();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-black">Bookmarks</h1>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 ${activeTab === 'posts' ? 'border-b-2 border-gray-700 text-gray-900' : 'text-gray-500'}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'maps' ? 'border-b-2 border-gray-700 text-gray-900' : 'text-gray-500'}`}
          onClick={() => setActiveTab('maps')}
        >
          Maps
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'books' ? 'border-b-2 border-gray-700 text-gray-900' : 'text-gray-500'}`}
          onClick={() => setActiveTab('books')}
        >
          Books
        </button>
      </div>
      
      {/* Content based on active tab */}
      {activeTab === 'posts' ? (
        <PostList onPostUpdated={handlePostUpdated} isBookmarksPage={true} />
      ) : activeTab === 'maps' ? (
        <div>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : bookmarkedMaps.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <h2 className="text-xl text-gray-600 mb-4">No bookmarked maps found</h2>
              <p className="text-gray-500 mb-6">Bookmark maps to see them here</p>
              <Link 
                href="/saved-maps" 
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                View Saved Maps
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bookmarkedMaps.map((map) => (
                <div 
                  key={map._id} 
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="p-4">
                    {/* Author and time info */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col -space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-800">
                            {typeof map.user === 'object' && map.user ? (
                              <Link href={`/user/${map.user?.username}`} className="hover:underline">
                                {map.user?.username || 'Unknown'}
                              </Link>
                            ) : (
                              <span>Unknown Author</span>
                            )}
                          </span>
                          <span className="text-gray-500 text-sm whitespace-nowrap">
                            {formatDateTime(map.createdAt)}
                            <span className="mx-1.5 text-gray-300">|</span>
                            {formatDateTime(map.lastSaved || map.updatedAt)}
                          </span>
                        </div>
                        {map.user?.badge && <UserBadge badge={map.user.badge} />}
                      </div>

                      {/* Bookmark button */}
                      <div className="flex items-center space-x-2 text-sm">
                        {user && (
                          <button
                            onClick={() => handleBookmarkMap(map._id)}
                            className="text-gray-600 hover:text-gray-800"
                            title="Remove from bookmarks"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Map title and stats - clickable to open map */}
                    <div 
                      className="cursor-pointer" 
                      onClick={() => handleOpenMap(map._id)}
                    >
                      {map.name && (
                        <h2 className="text-xl font-semibold mb-2 text-black hover:underline">{map.name || 'Untitled Map'}</h2>
                      )}
                      
                      {/* Map stats - styled like post text */}
                      <div className="prose prose-sm max-w-none !text-black mb-4">
                        <p className="text-black">{map.elementCount || 0} elements</p>
                        <p className="text-black">{map.connectionCount || 0} connections</p>
                      </div>
                    </div>
                    
                    {/* Comment section */}
                    <MapCommentSection mapId={map._id} initialComments={map.comments || []} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : bookmarkedBooks.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <h2 className="text-xl text-gray-600 mb-4">No bookmarked books found</h2>
              <p className="text-gray-500 mb-6">Bookmark books to see them here</p>
              <Link 
                href="/books" 
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                View All Books
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {bookmarkedBooks.map((book) => (
                <BookCard 
                  key={book._id}
                  book={book} 
                  onBookmarkToggle={handleBookmarkBook} 
                  onOpen={handleOpenBook} 
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Book Modal */}
      {selectedBook && (
        <SearchModal
          onClose={handleCloseBookModal}
          onBookSubmit={handleBookSubmit}
          initialBook={{
            key: selectedBook._id,
            _id: selectedBook._id,
            title: selectedBook.title,
            author_name: selectedBook.author ? (Array.isArray(selectedBook.author) ? selectedBook.author : [selectedBook.author]) : [],
            description: selectedBook.description,
            thumbnail: selectedBook.coverImage,
            highResThumbnail: selectedBook.coverImage,
            source: 'alphy',
            publishedYear: selectedBook.publishedYear,
            bookmarks: selectedBook.bookmarks,
            flibustaStatus: selectedBook.flibustaStatus,
            flibustaVariants: selectedBook.flibustaVariants
          }}
          error={null}
          shouldSaveToDb={false}
          isBookmarksPage={true}
        />
      )}
    </div>
  );
} 