'use client';

import { useCallback, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { MapElement, BookSearchResult } from '../types';

interface UseBookDetailsArgs {
  onUpdateElement: (id: string, updater: (element: MapElement) => MapElement) => void;
}

export interface UseBookDetailsReturn {
  bookDetailsModal: MapElement | null;
  setBookDetailsModal: (element: MapElement | null) => void;
  isLoadingDetails: boolean;
  setIsLoadingDetails: (value: boolean) => void;
  isEditingDescription: boolean;
  setIsEditingDescription: (value: boolean) => void;
  showFullDescription: boolean;
  setShowFullDescription: (value: boolean) => void;
  openBookDetails: (element: MapElement) => void;
  closeBookDetails: () => void;
  updateBookElement: (updater: (element: MapElement) => MapElement) => void;
  isFlibustaSearching: boolean;
  setIsFlibustaSearching: (value: boolean) => void;
  flibustaResults: any[];
  setFlibustaResults: (results: any[]) => void;
  selectedVariant: any;
  setSelectedVariant: (variant: any) => void;
  showFlibustaResults: boolean;
  setShowFlibustaResults: (value: boolean) => void;
  flibustaError: string | null;
  setFlibustaError: (value: string | null) => void;
  handleRequestDownloadLinks: () => Promise<void>;
  handleVariantSelect: (variant: any) => void;
  handleSaveDownloadLinks: () => Promise<void>;
}

export const useBookDetails = ({ onUpdateElement }: UseBookDetailsArgs): UseBookDetailsReturn => {
  const [bookDetailsModal, setBookDetailsModal] = useState<MapElement | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaResults, setFlibustaResults] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);

  const openBookDetails = useCallback((element: MapElement) => {
    setBookDetailsModal(element);
    setShowFullDescription(false);
    setIsEditingDescription(false);
  }, []);

  const closeBookDetails = useCallback(() => {
    setBookDetailsModal(null);
    setIsEditingDescription(false);
    setShowFullDescription(false);
    setFlibustaResults([]);
    setSelectedVariant(null);
    setShowFlibustaResults(false);
    setFlibustaError(null);
  }, []);

  const updateBookElement = useCallback(
    (updater: (element: MapElement) => MapElement) => {
      if (!bookDetailsModal) return;
      onUpdateElement(bookDetailsModal.id, updater);
    },
    [bookDetailsModal, onUpdateElement],
  );

  const handleRequestDownloadLinks = useCallback(async () => {
    if (!bookDetailsModal || !bookDetailsModal.bookData) return;
    setIsFlibustaSearching(true);
    setFlibustaError(null);
    setShowFlibustaResults(true);
    try {
      const response = await axios.get(`/api/books/flibusta/search?query=${encodeURIComponent(bookDetailsModal.bookData.title)}`);
      const data = response.data;
      if (!data) {
        throw new Error('Failed to search on Flibusta');
      }
      setFlibustaResults(data.data || []);
    } catch (err) {
      setFlibustaError(err instanceof Error ? err.message : 'Failed to search on Flibusta');
    } finally {
      setIsFlibustaSearching(false);
    }
  }, [bookDetailsModal]);

  const handleVariantSelect = useCallback((variant: any) => {
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map((format: any) => ({
        format: format.format,
        url: `/api/books/flibusta/download/${variant.id}/${format.format}`,
      })),
    };
    setSelectedVariant(originalVariant);
    setShowFlibustaResults(false);
  }, []);

  const handleSaveDownloadLinks = useCallback(async () => {
    if (!bookDetailsModal || !bookDetailsModal.bookData || !selectedVariant) return;
    try {
      const response = await axios.post(`/api/books/${bookDetailsModal.bookData._id}/save-flibusta`, { variant: selectedVariant });
      const updatedBook = response.data;
      updateBookElement((element) => ({
        ...element,
        bookData: {
          ...element.bookData!,
          _id: updatedBook._id,
          flibustaStatus: 'uploaded',
          flibustaVariants: updatedBook.flibustaVariants,
        },
      }));
      toast.success('Download links saved successfully');
    } catch (error) {
      console.error('Error saving download links:', error);
      toast.error('Failed to save download links');
    }
  }, [bookDetailsModal, selectedVariant, updateBookElement]);

  const handleClearDownloadLinks = useCallback(() => {
    setSelectedVariant(null);
    setShowFlibustaResults(false);
  }, []);

  return {
    bookDetailsModal,
    setBookDetailsModal,
    isLoadingDetails,
    setIsLoadingDetails,
    isEditingDescription,
    setIsEditingDescription,
    showFullDescription,
    setShowFullDescription,
    openBookDetails,
    closeBookDetails,
    updateBookElement,
    isFlibustaSearching,
    setIsFlibustaSearching,
    flibustaResults,
    setFlibustaResults,
    selectedVariant,
    setSelectedVariant,
    showFlibustaResults,
    setShowFlibustaResults,
    flibustaError,
    setFlibustaError,
    handleRequestDownloadLinks,
    handleVariantSelect,
    handleSaveDownloadLinks,
  };
};
