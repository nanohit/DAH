'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api';
import { MapElement } from '../types';

type BookmarkUser = { _id: string } | string;
interface BookmarkRecord {
  user: BookmarkUser;
  timestamp: string;
}

const ensureBookmarkRecord = (record: Partial<BookmarkRecord>): BookmarkRecord => ({
  user: record.user ?? '',
  timestamp: record.timestamp ?? new Date().toISOString(),
});

const extractUserId = (user: BookmarkUser): string => (typeof user === 'string' ? user : user._id);

interface UseAuthOperationsArgs {
  bookDetailsModal: MapElement | null;
  setBookDetailsModal: (element: MapElement | null) => void;
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
}

export const useAuthOperations = ({
  bookDetailsModal,
  setBookDetailsModal,
  setElements,
}: UseAuthOperationsArgs) => {
  const { user } = useAuth();
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isTokenExpiring, setIsTokenExpiring] = useState(false);

  const handleBookmarkToggle = useCallback(async () => {
    if (!user) {
      toast.error('You must be logged in to bookmark.');
      return;
    }

    const bookmarkUser = user._id || user.email;
    const record: BookmarkRecord = ensureBookmarkRecord({ user: bookmarkUser });

    try {
      const response = await axios.post(`${API_BASE_URL}/api/bookmarks/toggle`, {
        elementId: bookDetailsModal?.id,
        userId: bookmarkUser,
      });

      if (response.data.success) {
        setIsBookmarked(response.data.bookmarked);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to toggle bookmark.');
      console.error(error);
    }
  }, [bookDetailsModal, user]);

  const bookmarkBook = useCallback(async () => {
    if (!user) {
      toast.error('You must be logged in to bookmark.');
      return;
    }

    const bookmarkUser = user._id || user.email;
    const record: BookmarkRecord = ensureBookmarkRecord({ user: bookmarkUser });

    try {
      const response = await axios.post(`${API_BASE_URL}/api/bookmarks/add`, {
        elementId: bookDetailsModal?.id,
        userId: bookmarkUser,
      });

      if (response.data.success) {
        setIsBookmarked(true);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to bookmark book.');
      console.error(error);
    }
  }, [bookDetailsModal, user]);

  const refreshToken = useCallback(async () => {
    if (!user) {
      toast.error('You must be logged in to refresh token.');
      return;
    }

    setIsRefreshingToken(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
        userId: user._id || user.email,
      });

      if (response.data.success) {
        setIsTokenExpiring(false);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to refresh token.');
      console.error(error);
    } finally {
      setIsRefreshingToken(false);
    }
  }, [user]);

  useEffect(() => {
    if (bookDetailsModal?.bookData?._id && user) {
      const isMarked = bookDetailsModal.bookData.bookmarks?.some((bookmark: BookmarkRecord) => {
        const bookmarkUserId = extractUserId(bookmark.user);
        const currentUserId = extractUserId(user._id as BookmarkUser);
        return bookmarkUserId === currentUserId;
      });
      setIsBookmarked(Boolean(isMarked));
    }
  }, [bookDetailsModal, user]);

  useEffect(() => {
    const checkTokenExpiration = async () => {
      if (!user) {
        setIsTokenExpiring(false);
        return;
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/check-token-expiry`, {
          userId: user._id || user.email,
        });

        if (response.data.success) {
          setIsTokenExpiring(response.data.isExpiring);
        } else {
          setIsTokenExpiring(false);
        }
      } catch (error) {
        setIsTokenExpiring(false);
        console.error(error);
      }
    };

    const interval = setInterval(checkTokenExpiration, 1000); // Check every second
    return () => clearInterval(interval);
  }, [user]);

  return {
    isRefreshingToken,
    isBookmarked,
    setIsBookmarked,
    handleBookmarkToggle,
    bookmarkBook,
    refreshToken,
    isTokenExpiring,
  };
};