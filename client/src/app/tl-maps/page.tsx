'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Editor, getSnapshot, loadSnapshot } from 'tldraw';
import { toast } from 'react-hot-toast';
import TLMapCanvas from './components/TLMapCanvas';
import TLMapToolbar from './components/TLMapToolbar';
import { getApiBaseUrl } from '@/utils/api';

function TLMapsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapId = searchParams.get('id');

  const [editor, setEditor] = useState<Editor | null>(null);
  const [mapName, setMapName] = useState('Untitled TL Map');
  const [savedMapId, setSavedMapId] = useState<string | null>(mapId);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);

  // Handle editor ready
  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
  }, []);

  // Load map from server
  useEffect(() => {
    if (!mapId || !editor) return;

    const loadMap = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/api/tl-maps/${mapId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            toast.error('Map not found');
            router.push('/saved-maps');
            return;
          }
          throw new Error('Failed to load map');
        }

        const data = await response.json();

        if (data.snapshot) {
          loadSnapshot(editor.store, data.snapshot);
        }

        setMapName(data.name || 'Untitled TL Map');
        setIsPrivate(data.isPrivate || false);
        setSavedMapId(data._id);
      } catch (error) {
        console.error('Error loading map:', error);
        toast.error('Failed to load map');
      } finally {
        setIsLoading(false);
      }
    };

    loadMap();
  }, [mapId, editor, router]);

  // Save map
  const saveMap = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login to save maps');
        return;
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
    } catch (error) {
      console.error('Error saving map:', error);
      toast.error('Failed to save map');
    } finally {
      setIsSaving(false);
    }
  }, [editor, savedMapId, mapName, isPrivate]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    await saveMap();
    router.push('/saved-maps');
  }, [saveMap, router]);

  // Delete map
  const handleDeleteMap = useCallback(async () => {
    if (!savedMapId) return;

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
      router.push('/saved-maps');
    } catch (error) {
      console.error('Error deleting map:', error);
      toast.error('Failed to delete map');
    }
  }, [savedMapId, router]);

  // Copy share link
  const handleCopyShareLink = useCallback(() => {
    const shareUrl = window.location.href;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Failed to copy link'));
  }, []);

  // Autosave effect
  useEffect(() => {
    if (!isAutosaveEnabled || !savedMapId) return;

    const interval = setInterval(() => {
      saveMap();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAutosaveEnabled, savedMapId, saveMap]);

  // Set page title
  useEffect(() => {
    if (savedMapId) {
      document.title = mapName ? `${mapName} - Alphy` : 'Alphy';
    }
  }, [mapName, savedMapId]);

  // Add maps-page class to body
  useEffect(() => {
    document.body.classList.add('maps-page');
    return () => {
      document.body.classList.remove('maps-page');
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="tlmaps-shell fixed inset-0 top-[60px]">
      <TLMapToolbar
        mapName={mapName}
        onChangeMapName={setMapName}
        onSave={saveMap}
        onSaveAndExit={handleSaveAndExit}
        isSaving={isSaving}
        isAutosaveEnabled={isAutosaveEnabled}
        onToggleAutosave={() => setIsAutosaveEnabled((prev) => !prev)}
        isPrivate={isPrivate}
        onSetPrivacy={setIsPrivate}
        onCopyShareLink={handleCopyShareLink}
        onDelete={handleDeleteMap}
        canDelete={Boolean(savedMapId)}
      />
      <TLMapCanvas
        onEditorReady={handleEditorReady}
      />
      <style jsx global>{`
        /* Make tldraw canvas transparent so our dotted background shows */
        .tlmaps-shell .tlmaps-canvas,
        .tlmaps-shell .tl-theme,
        .tlmaps-shell .tl-background,
        .tlmaps-shell .tl-editor,
        .tlmaps-shell .tl-canvas {
          background: transparent !important;
        }
        /* Hide the tldraw production license badge / link aggressively */
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

export default function TLMapsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <TLMapsContent />
    </Suspense>
  );
}
