import { BookSearchResult } from './index';

// Define interfaces outside of module declarations
export interface UseSearchReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: BookSearchResult[];
  isLoading: boolean;
  currentPage: number;
  totalResults: number;
  activeApi: 'openlib' | 'google' | 'alphy';
  setActiveApi: (api: 'openlib' | 'google' | 'alphy') => void;
  error: string | null;
  displayAll: boolean;
  setDisplayAll: (display: boolean) => void;
  hasSearched: boolean;
  setHasSearched: (searched: boolean) => void;
  handleSearch: (page: number) => Promise<void>;
  resultsPerPage: number;
}

export interface UseBookDetailsReturn {
  selectedBook: BookSearchResult | null;
  confirmedBook: BookSearchResult | null;
  setConfirmedBook: (book: BookSearchResult | null) => void;
  isLoadingDetails: boolean;
  isEditingDescription: boolean;
  setIsEditingDescription: (editing: boolean) => void;
  showFullDescription: boolean;
  setShowFullDescription: (show: boolean) => void;
  handleBookClick: (book: BookSearchResult) => Promise<void>;
  handleBackToSearch: () => void;
  handleSubmit: () => Promise<any>;
}

// Declare module augmentations
declare module '@/hooks/useSearch' {
  export function useSearch(): UseSearchReturn;
}

declare module '@/hooks/useBookDetails' {
  export function useBookDetails(): UseBookDetailsReturn;
} 