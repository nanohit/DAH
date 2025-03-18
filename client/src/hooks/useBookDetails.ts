import { useState } from 'react';
import { BookSearchResult } from '@/types';

// Define useBookDetails implementation without exporting
function useBookDetailsImplementation() {
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [confirmedBook, setConfirmedBook] = useState<BookSearchResult | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const GOOGLE_BOOKS_API_KEY = 'AIzaSyB2DtSUPFGE0aV_ehA6M9Img7XqO8sr8-Y';

  const fetchOpenLibraryDetails = async (key: string) => {
    try {
      const response = await fetch(`https://openlibrary.org${key}.json`);
      if (!response.ok) throw new Error('Failed to fetch book details from Open Library');
      const data = await response.json();
      return data.description?.value || data.description || null;
    } catch (error) {
      console.error('Error fetching Open Library details:', error);
      return null;
    }
  };

  const fetchGoogleBooksDetails = async (id: string) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${id}?key=${GOOGLE_BOOKS_API_KEY}`
      );
      if (!response.ok) throw new Error('Failed to fetch book details from Google Books');
      const data = await response.json();
      return data.volumeInfo?.description || null;
    } catch (error) {
      console.error('Error fetching Google Books details:', error);
      return null;
    }
  };

  const handleBookClick = async (book: BookSearchResult) => {
    if (selectedBook?.key === book.key) {
      if (book.source === 'alphy') {
        setConfirmedBook(book);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const description = await (book.source === 'openlib' 
          ? fetchOpenLibraryDetails(book.key)
          : fetchGoogleBooksDetails(book.key));
        
        setConfirmedBook({
          ...book,
          description
        });
      } catch (error) {
        console.error('Error fetching book details:', error);
        setConfirmedBook(book);
      } finally {
        setIsLoadingDetails(false);
      }
    } else {
      setSelectedBook(book);
    }
  };

  const handleBackToSearch = () => {
    setConfirmedBook(null);
    setSelectedBook(null);
  };

  const handleSubmit = async () => {
    if (!confirmedBook) return null;
    return confirmedBook;
  };

  return {
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
  };
}

// Use default export instead of named export to avoid conflict with declaration
export default useBookDetailsImplementation; 