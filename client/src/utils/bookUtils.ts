import api from '@/services/api';
import { toast } from 'react-hot-toast';

// Book interface matching the Book model
export interface BookData {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  publishedYear?: number;
  bookmarks?: BookmarkData[];
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

// Bookmark data interface
interface BookmarkData {
  user: string;
  timestamp: string;
}

// Bookmark a book
export const bookmarkBook = async (bookId: string): Promise<{success: boolean, isBookmarked: boolean}> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('You must be logged in to bookmark books');
      return { success: false, isBookmarked: false };
    }

    // The router is mounted at /api/books in index.js so the full path needs to include /api
    const endpoint = `/api/books/${bookId}/bookmark`;
    console.log(`Attempting to bookmark book with ID: ${bookId}`);
    console.log(`Full endpoint: ${endpoint}`);
    
    const response = await api.post(endpoint, { action: 'toggle' });
    console.log('Server response:', response.data);
    
    if (response.data.success) {
      // Return whether the book is now bookmarked
      return { 
        success: true, 
        isBookmarked: response.data.isBookmarked 
      };
    } else {
      throw new Error('Bookmark operation failed');
    }
  } catch (error: any) {
    console.error('Error bookmarking book:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      // More specific error message based on status
      if (error.response.status === 404) {
        toast.error('Book not found. Please refresh the page and try again.');
      } else if (error.response.status === 401) {
        toast.error('Please log in to bookmark books');
      } else {
        toast.error('Failed to bookmark book: ' + (error.response.data.message || 'Unknown error'));
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
      toast.error('No response from server. Please check your connection.');
    } else {
      console.error('Error message:', error.message);
      toast.error('Failed to bookmark book');
    }
    return { success: false, isBookmarked: false };
  }
};

// Get bookmarked books
export const getBookmarkedBooks = async (): Promise<BookData[]> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('You must be logged in to view bookmarked books');
      return [];
    }

    // The router is mounted at /api/books in index.js
    const endpoint = '/api/books/bookmarked';
    console.log(`Fetching bookmarked books from: ${endpoint}`);
    
    const response = await api.get(endpoint);
    console.log('Bookmarked books response:', response.data);
    return response.data.books;
  } catch (error: any) {
    console.error('Error fetching bookmarked books:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      toast.error('Failed to fetch bookmarks: ' + (error.response.data.message || 'Unknown error'));
    } else {
      toast.error('Failed to fetch bookmarked books');
    }
    return [];
  }
};

// Check if a book is bookmarked by the current user
export const isBookBookmarked = (book: BookData, userId: string): boolean => {
  if (!userId || !book.bookmarks) return false;
  return book.bookmarks.some(bookmark => bookmark.user === userId);
}; 