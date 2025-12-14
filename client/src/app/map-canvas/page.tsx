'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Editor, getSnapshot, loadSnapshot, TLEditorSnapshot } from 'tldraw';
import { toast } from 'react-hot-toast';
import TLMapCanvas from '../tl-maps/components/TLMapCanvas';
import TLMapToolbar from '../tl-maps/components/TLMapToolbar';
import { getApiBaseUrl } from '@/utils/api';
import { getCurrentUser } from '@/services/auth';

/**
 * IMPORTANT: tldraw's getSnapshot returns { document, session } where:
 * - document: { store: { [id]: record }, schema: {...} }
 * - session: { store: { [id]: record }, schema: {...} }
 * 
 * The store is a FLAT object mapping record IDs to records.
 * DO NOT wrap it in a { records: ... } object - that breaks loading!
 * 
 * Each record must have:
 * - id: string (e.g., "shape:abc123")
 * - typeName: string (e.g., "shape", "page", "asset")
 * - meta: object (can be empty {})
 */

// Map of ID prefixes to their typeName values
const ID_PREFIX_TO_TYPE: Record<string, string> = {
  'document': 'document',
  'page': 'page',
  'shape': 'shape',
  'asset': 'asset',
  'instance': 'instance',
  'instance_page_state': 'instance_page_state',
  'pointer': 'pointer',
  'camera': 'camera',
  'binding': 'binding',
};

// Get typeName from record ID
const getTypeNameFromId = (id: string): string | null => {
  // Handle compound prefixes like "instance_page_state:xxx"
  for (const prefix of Object.keys(ID_PREFIX_TO_TYPE)) {
    if (id.startsWith(prefix + ':')) {
      return ID_PREFIX_TO_TYPE[prefix];
    }
  }
  return null;
};

// Ensure records have required meta and typeName properties
const ensureRecordMeta = (store: Record<string, any> | undefined): void => {
  if (!store || typeof store !== 'object') return;
  
  for (const [id, record] of Object.entries(store)) {
    if (record && typeof record === 'object') {
      // Ensure meta exists (tldraw requires this on all records)
      if (record.meta === undefined || record.meta === null) {
        record.meta = {};
      }
      
      // Ensure typeName exists
      if (record.typeName === undefined || record.typeName === null) {
        const inferredType = getTypeNameFromId(id);
        if (inferredType) {
          record.typeName = inferredType;
        } else {
          // Log unknown record types for debugging
          console.warn('[TLDraw] Unknown record type for ID:', id);
        }
      }
    }
  }
};

// Validate that all records have required properties
const validateRecords = (store: Record<string, any> | undefined): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!store || typeof store !== 'object') return { valid: true, errors };
  
  for (const [id, record] of Object.entries(store)) {
    if (record && typeof record === 'object') {
      if (record.typeName === undefined || record.typeName === null) {
        errors.push(`Record ${id} missing typeName`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
};

// Prepare snapshot for saving to MongoDB (deep clone + ensure meta)
const prepareSnapshotForSave = (snapshot: TLEditorSnapshot): any => {
  // Deep clone to avoid mutating the original
  const cloned = JSON.parse(JSON.stringify(snapshot));
  
  // Ensure meta exists on all records in document store
  if (cloned.document?.store) {
    ensureRecordMeta(cloned.document.store);
  }
  
  // Ensure meta exists on all records in session store  
  if (cloned.session?.store) {
    ensureRecordMeta(cloned.session.store);
  }
  
  return cloned;
};

// Fix corrupted store structure (from previous buggy saves that wrapped in { records: ... })
const fixCorruptedStore = (storeData: any): Record<string, any> | null => {
  if (!storeData || typeof storeData !== 'object') return null;
  
  // If store was incorrectly wrapped in { records: ... }, unwrap it
  // Valid records have IDs like "shape:xxx", "page:xxx", etc.
  // If we see a "records" key that contains an object without typical record IDs, it's likely the wrapper
  if (storeData.records && typeof storeData.records === 'object') {
    const recordsObj = storeData.records as Record<string, any>;
    // Check if the records object looks like actual records (has typical ID patterns)
    const keys = Object.keys(recordsObj);
    const looksLikeRecords = keys.some(k => k.includes(':'));
    if (looksLikeRecords) {
      console.warn('[TLDraw] Detected corrupted store with records wrapper, fixing...');
      return recordsObj;
    }
  }
  
  return storeData;
};

// Prepare snapshot for loading from MongoDB
const prepareSnapshotForLoad = (data: any): TLEditorSnapshot | null => {
  if (!data || typeof data !== 'object') return null;
  
  // Deep clone to avoid mutation issues
  const snapshot = JSON.parse(JSON.stringify(data));
  
  // Fix corrupted document store structure
  if (snapshot.document?.store) {
    const fixedStore = fixCorruptedStore(snapshot.document.store);
    if (fixedStore) {
      snapshot.document.store = fixedStore;
    }
  }
  
  // Fix corrupted session store structure
  if (snapshot.session?.store) {
    const fixedStore = fixCorruptedStore(snapshot.session.store);
    if (fixedStore) {
      snapshot.session.store = fixedStore;
    }
  }
  
  // Ensure meta and typeName exist on all records
  if (snapshot.document?.store) {
    ensureRecordMeta(snapshot.document.store);
    
    // Validate records before returning
    const validation = validateRecords(snapshot.document.store);
    if (!validation.valid) {
      console.error('[TLDraw] Invalid records in document store:', validation.errors);
      // Remove invalid records to prevent crash
      for (const [id, record] of Object.entries(snapshot.document.store)) {
        const rec = record as Record<string, any>;
        if (rec && typeof rec === 'object' && !rec.typeName) {
          console.warn('[TLDraw] Removing invalid record:', id);
          delete snapshot.document.store[id];
        }
      }
    }
  }
  
  if (snapshot.session?.store) {
    ensureRecordMeta(snapshot.session.store);
  }
  
  return snapshot as TLEditorSnapshot;
};

function CanvasMapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = searchParams.get('id');

  const [editor, setEditor] = useState<Editor | null>(null);
  const [mapName, setMapName] = useState('Untitled Map');
  const [isPrivate, setIsPrivate] = useState(false);
  const [savedMapId, setSavedMapId] = useState<string | null>(mapId);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);
  const loadAttemptedRef = useRef(false);
  const [isNanoAdmin, setIsNanoAdmin] = useState(false);

  // IMPORTANT: Keep persistenceKey stable during the session.
  // If this changes (e.g., after first save), tldraw will reload from IndexedDB with the new key and clear the canvas.
  const persistenceKeyRef = useRef<string | null>(null);
  if (persistenceKeyRef.current === null) {
    // If opening an existing map, use its id; otherwise create a unique local draft key.
    persistenceKeyRef.current = mapId ? `tlmap-${mapId}` : `tlmap-local-${Date.now()}`;
  }
  const persistenceKey = persistenceKeyRef.current;

  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
  }, []);

  // Clear local IndexedDB storage for a specific persistence key
  const clearLocalStorage = useCallback(async (key: string) => {
    try {
      // Delete from IndexedDB (tldraw uses this for persistence)
      const dbName = `TLDRAW_DOCUMENT_v2_${key}`;
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase(dbName);
        console.info('[TLDraw] Cleared local storage for:', key);
      }
    } catch (e) {
      console.warn('[TLDraw] Failed to clear local storage:', e);
    }
  }, []);

  // Load map from server
  const loadMapFromServer = useCallback(async (id: string) => {
    if (!editor) return;
    
    setIsLoading(true);
    try {
      // Clear any stale local data first to prevent conflicts
      await clearLocalStorage(`tlmap-${id}`);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/api/tl-maps/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Map not found');
          return;
        }
        if (response.status === 403) {
          toast.error('This map is private');
          return;
        }
        throw new Error('Failed to load map');
      }

      const data = await response.json();
      
      // Update name from server
      if (data.name) {
        setMapName(data.name);
      }
      if (typeof data.isPrivate === 'boolean') {
        setIsPrivate(data.isPrivate);
      }

      if (data.snapshot) {
        const prepared = prepareSnapshotForLoad(data.snapshot);
        
        if (!prepared) {
          console.error('[TLDraw] Invalid snapshot data from server');
          toast.error('Invalid map data');
          return;
        }

        console.info('[TLDraw] Loading snapshot from server', {
          hasDocument: !!prepared.document,
          hasSession: !!prepared.session,
          documentStoreKeys: prepared.document?.store ? Object.keys(prepared.document.store).length : 0,
          sampleRecordIds: prepared.document?.store ? Object.keys(prepared.document.store).slice(0, 5) : [],
        });
        
        // Load the snapshot into the editor
        // Only load document, not session (session contains user-specific state like camera position)
        loadSnapshot(editor.store, { document: prepared.document });
        
        setHasLoadedFromServer(true);
        toast.success('Map loaded');
      }
    } catch (error) {
      console.error('Error loading map:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load map');
    } finally {
      setIsLoading(false);
    }
  }, [editor, clearLocalStorage]);

  // Load map when editor is ready and we have an ID
  useEffect(() => {
    if (editor && mapId && !loadAttemptedRef.current) {
      loadAttemptedRef.current = true;
      loadMapFromServer(mapId);
    }
  }, [editor, mapId, loadMapFromServer]);

  // Save map to server
  const handleSave = useCallback(async () => {
    if (!editor) {
      toast.error('Editor not ready');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to save maps');
      return;
    }

    // Capture the current name at save time
    const nameToSave = mapName || 'Untitled Map';

    setIsSaving(true);
    try {
      // Get the current snapshot from the editor (returns { document, session })
      const snapshot = getSnapshot(editor.store);
      
      // Prepare for MongoDB storage
      const prepared = prepareSnapshotForSave(snapshot);

      console.info('[TLDraw] Saving snapshot', {
        name: nameToSave,
        hasDocument: !!prepared.document,
        hasSession: !!prepared.session,
        documentStoreKeys: prepared.document?.store ? Object.keys(prepared.document.store).length : 0,
      });

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
          name: nameToSave,
          snapshot: prepared,
          isPrivate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save map');
      }

      const data = await response.json();

      // If this was a new map, update the URL and state
      if (!savedMapId && data._id) {
        setSavedMapId(data._id);
        window.history.pushState({}, '', `/map-canvas?id=${data._id}`);
      }

      toast.success('Map saved!');
    } catch (error) {
      console.error('Error saving map:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save map');
    } finally {
      setIsSaving(false);
    }
  }, [editor, savedMapId, mapName, isPrivate]);

  // Delete map
  const handleDelete = useCallback(async () => {
    if (!savedMapId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to delete maps');
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/tl-maps/${savedMapId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete map');
      }

      toast.success('Map deleted');
      router.push('/saved-maps');
    } catch (error) {
      console.error('Error deleting map:', error);
      toast.error('Failed to delete map');
    }
  }, [savedMapId, router]);

  const handleCopyShareLink = useCallback(() => {
    if (!savedMapId) {
      toast.error('Save the map first to get a shareable link');
      return;
    }
    const shareUrl = `${window.location.origin}/map-canvas?id=${savedMapId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Link copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  }, [savedMapId]);

  useEffect(() => {
    document.title = mapName ? `${mapName} - Map Canvas` : 'Map Canvas';
  }, [mapName]);

  useEffect(() => {
    document.body.classList.add('maps-page');
    return () => {
      document.body.classList.remove('maps-page');
    };
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    setIsNanoAdmin(user?.username === 'nano');
  }, []);

  return (
    <div className="tlmaps-shell fixed inset-0 top-[60px]">
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 z-[400] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      )}
      <TLMapToolbar
        mapName={mapName}
        onChangeMapName={setMapName}
        onSave={handleSave}
        isSaving={isSaving}
        isPrivate={isPrivate}
        onSetPrivacy={setIsPrivate}
        onCopyShareLink={savedMapId ? handleCopyShareLink : undefined}
        onDelete={handleDelete}
        canDelete={!!savedMapId}
        editor={editor}
      />
      <TLMapCanvas 
        onEditorReady={handleEditorReady} 
        persistenceKey={persistenceKey} 
        canToggleUi={isNanoAdmin}
      />
      <style jsx global>{`
        .tlmaps-shell .tlmaps-canvas,
        .tlmaps-shell .tl-theme,
        .tlmaps-shell .tl-background,
        .tlmaps-shell .tl-editor {
          background: transparent !important;
        }
        
        .tldraw-ui-hidden .tlui-layout,
        .tldraw-ui-hidden .tlui-toolbar,
        .tldraw-ui-hidden .tlui-navigation-zone,
        .tldraw-ui-hidden .tlui-style-panel,
        .tldraw-ui-hidden .tlui-menu-zone,
        .tldraw-ui-hidden .tlui-helper-buttons,
        .tldraw-ui-hidden .tlui-debug-panel,
        .tldraw-ui-hidden .tlui-share-zone,
        .tldraw-ui-hidden .tlui-top-zone,
        .tldraw-ui-hidden .tlui-action-bar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .tldraw-ui-visible .tlui-layout,
        .tldraw-ui-visible .tlui-toolbar,
        .tldraw-ui-visible .tlui-navigation-zone,
        .tldraw-ui-visible .tlui-style-panel,
        .tldraw-ui-visible .tlui-menu-zone,
        .tldraw-ui-visible .tlui-helper-buttons,
        .tldraw-ui-visible .tlui-share-zone,
        .tldraw-ui-visible .tlui-top-zone,
        .tldraw-ui-visible .tlui-action-bar {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        .tlui-license,
        .tlui-license__link,
        .tlui-help-menu__license,
        .tlui-help-menu__row button[title*="license"],
        .tlui-help-menu__row [data-testid*="license"],
        .tlui-menu__license,
        a[href*="tldraw.com/licensing"],
        a[href*="tldraw.com/enterprise"],
        button[title*="license"],
        [data-testid*="license"],
        [data-testid*="License"],
        [class*="license"],
        [class*="License"],
        [aria-label*="license"],
        [aria-label*="License"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
    </div>
  );
}

export default function MapCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <CanvasMapContent />
    </Suspense>
  );
}
