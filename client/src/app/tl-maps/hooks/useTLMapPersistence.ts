'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Editor, getSnapshot, loadSnapshot } from 'tldraw';
import { toast } from 'react-hot-toast';
import { getApiBaseUrl } from '@/utils/api';

interface UseTLMapPersistenceArgs {
  editor: Editor | null;
  mapId: string | null;
  mapName: string;
  isPrivate: boolean;
}

export const useTLMapPersistence = ({
  editor,
  mapId,
  mapName,
  isPrivate,
}: UseTLMapPersistenceArgs) => {
  const [savedMapId, setSavedMapId] = useState<string | null>(mapId);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load map from server
  const loadMap = useCallback(
    async (id: string) => {
      if (!editor) return null;

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/api/tl-maps/${id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load map');
        }

        const data = await response.json();

        if (data.snapshot) {
          loadSnapshot(editor.store, data.snapshot);
        }

        return data;
      } catch (error) {
        console.error('Error loading map:', error);
        toast.error('Failed to load map');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [editor]
  );

  // Save map to server
  const saveMap = useCallback(async () => {
    if (!editor) return null;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login to save maps');
        return null;
      }

      const snapshot = getSnapshot(editor.store);
      const endpoint = savedMapId
        ? `${getApiBaseUrl()}/api/tl-maps/${savedMapId}`
        : `${getApiBaseUrl()}/api/tl-maps`;

      const response = await fetch(endpoint, {
        method: savedMapId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: mapName,
          snapshot,
          isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save map');
      }

      const data = await response.json();

      if (!savedMapId && data._id) {
        setSavedMapId(data._id);
        window.history.pushState({}, '', `/tl-maps?id=${data._id}`);
      }

      toast.success('Map saved!');
      return data;
    } catch (error) {
      console.error('Error saving map:', error);
      toast.error('Failed to save map');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [editor, savedMapId, mapName, isPrivate]);

  // Delete map
  const deleteMap = useCallback(async () => {
    if (!savedMapId) return false;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/tl-maps/${savedMapId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete map');
      }

      toast.success('Map deleted');
      return true;
    } catch (error) {
      console.error('Error deleting map:', error);
      toast.error('Failed to delete map');
      return false;
    }
  }, [savedMapId]);

  // Autosave effect
  useEffect(() => {
    if (isAutosaveEnabled && savedMapId) {
      autosaveIntervalRef.current = setInterval(() => {
        saveMap();
      }, 30000); // Save every 30 seconds
    }

    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, [isAutosaveEnabled, savedMapId, saveMap]);

  return {
    savedMapId,
    isLoading,
    isSaving,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    loadMap,
    saveMap,
    deleteMap,
  };
};
