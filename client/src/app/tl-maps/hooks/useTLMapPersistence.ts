'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Editor, getSnapshot, loadSnapshot } from 'tldraw';
import { toast } from 'react-hot-toast';
import { getApiBaseUrl } from '@/utils/api';

// Ensure legacy snapshots have serializable meta
const deepClone = (value: any) => {
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(value));
};

const sanitizeSnapshot = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;

  let safe = deepClone(snapshot);

  // Normalize flat store -> { records } shape if needed
  const wrapStore = (storeObj: any) => {
    if (storeObj && typeof storeObj === 'object') {
      if ('records' in storeObj) return storeObj;
      return { records: storeObj };
    }
    return storeObj;
  };

  if (safe.store) safe.store = wrapStore(safe.store);
  if (safe.document?.store) safe.document.store = wrapStore(safe.document.store);

  // Ensure top-level document.meta is present
  if (safe.document) {
    if (!('meta' in safe.document) || safe.document.meta === undefined || safe.document.meta === null) {
      safe.document.meta = {};
    }
  }

  const patchRecords = (records: any) => {
    if (!records || typeof records !== 'object') return 0;
    const entries = records instanceof Map ? Array.from(records.entries()) : Object.entries(records);
    let patched = 0;

    entries.forEach(([id, record]) => {
      if (record && typeof record === 'object') {
        const rec: any = record;
        if (rec.typeName === undefined) {
          if (id.startsWith('document:')) rec.typeName = 'document';
          else if (id.startsWith('page:')) rec.typeName = 'page';
          else if (id.startsWith('shape:')) rec.typeName = 'shape';
          else if (id.startsWith('asset:')) rec.typeName = 'asset';
          else if (id.startsWith('instance:')) rec.typeName = 'instance';
          else if (id.startsWith('instance_page_state:')) rec.typeName = 'instance_page_state';
          else if (id.startsWith('pointer:')) rec.typeName = 'pointer';
          else if (id.startsWith('camera:')) rec.typeName = 'camera';
          else if (id.startsWith('binding:')) rec.typeName = 'binding';
        }
        if (!('meta' in rec) || rec.meta === undefined || rec.meta === null) {
          rec.meta = {};
          patched += 1;
        }
        if (records instanceof Map) {
          records.set(id, rec);
        } else {
          records[id] = rec;
        }
      }
    });

    return patched;
  };

  // tldraw snapshots can be shaped as {store: {records}} or {store: <records>}
  const patchedFromStore = patchRecords(safe.store?.records ?? safe.store);
  const patchedFromDocumentStore = patchRecords(safe.document?.store?.records ?? safe.document?.store);

  const totalPatched = patchedFromStore + patchedFromDocumentStore;

  if (totalPatched > 0) {
    console.info(`[TLDraw] sanitized meta on ${totalPatched} record(s)`);
  }

  return safe;
};

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
        const response = await fetch(`${getApiBaseUrl()}/tl-maps/${id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load map');
        }

        const data = await response.json();

        if (data.snapshot) {
        const sanitized = sanitizeSnapshot(data.snapshot);
        console.info('[TLDraw] loading snapshot (hook)', {
          hasDocument: !!sanitized?.document,
          hasDocMeta: !!sanitized?.document?.meta,
          recordCount: sanitized?.store ? Object.keys(sanitized.store.records || {}).length : 0,
        });
        loadSnapshot(editor.store, sanitized);
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
        ? `${getApiBaseUrl()}/tl-maps/${savedMapId}`
        : `${getApiBaseUrl()}/tl-maps`;

      const response = await fetch(endpoint, {
        method: savedMapId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: mapName,
          snapshot: sanitizeSnapshot(snapshot),
          isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save map');
      }

      const data = await response.json();

      if (!savedMapId && data._id) {
        setSavedMapId(data._id);
        window.history.pushState({}, '', `/map-canvas?id=${data._id}`);
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
      const response = await fetch(`${getApiBaseUrl()}/tl-maps/${savedMapId}`, {
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
