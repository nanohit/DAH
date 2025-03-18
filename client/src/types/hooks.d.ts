import { BookSearchResult } from '@/types';
import { ApiSource } from '@/types/enums';

declare module '@/hooks/useSearch' {
  export interface UseSearchReturn {
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
    setDisplayAll: (display: boolean) => void;
    hasSearched: boolean;
    setHasSearched: (searched: boolean) => void;
    handleSearch: (page?: number) => void;
    clearSearchResults: () => void;
    handlePagination: (page: number) => void;
    handleApiChange: (api: ApiSource) => void;
    resultsPerPage: number;
  }

  export const useSearch: () => UseSearchReturn;
}

declare module '@/hooks/useBookDetails' {
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

  export const useBookDetails: () => UseBookDetailsReturn;
} 