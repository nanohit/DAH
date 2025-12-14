'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { saveMap, loadMap, deleteMap } from '@/utils/mapUtils';
import { MapElement, Connection } from '../types';

interface MapData {
  name: string;
  elements: MapElement[];
  connections: Connection[];
  canvasPosition: { x: number; y: number };
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  isPrivate: boolean;
}

interface UseMapOperationsArgs {
  elements: MapElement[];
  connections: Connection[];
  canvasPosition: { x: number; y: number };
  scale: number;
  containerRef: React.RefObject<HTMLDivElement>;
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setCanvasPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setScale: React.Dispatch<React.SetStateAction<number>>;
}

export const useMapOperations = ({
  elements,
  connections,
  canvasPosition,
  scale,
  containerRef,
  setElements,
  setConnections,
  setCanvasPosition,
  setScale,
}: UseMapOperationsArgs) => {
  const router = useRouter();

  // Map state
  const [mapName, setMapName] = useState('Untitled Map');
  const [savedMapId, setSavedMapId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Refs for cross-hook communication
  const performSaveRef = useRef<() => Promise<boolean>>(async () => false);

  const performSave = useCallback(async (overrideIsPrivate?: boolean): Promise<boolean> => {
    try {
      if (!mapName.trim()) {
        // This will be handled by the modal state hook
        return false;
      }

      const mapData: MapData = {
        name: mapName,
        elements,
        connections,
        canvasPosition,
        scale,
        canvasWidth: containerRef.current?.clientWidth || 1000,
        canvasHeight: containerRef.current?.clientHeight || 800,
        isPrivate: typeof overrideIsPrivate === 'boolean' ? overrideIsPrivate : isPrivate,
      };

      const savedMap = await saveMap(mapData, savedMapId ?? undefined);

      if (savedMap) {
        if ('isPrivate' in savedMap) {
          setIsPrivate(Boolean(savedMap.isPrivate));
        }

        if (!savedMapId) {
          setSavedMapId(savedMap._id);
          window.history.pushState({}, '', `/maps?id=${savedMap._id}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving map:', error);
      toast.error('Failed to save map');
      return false;
    }
  }, [canvasPosition, connections, elements, isPrivate, mapName, savedMapId, scale]);

  performSaveRef.current = performSave;

  const toggleAutosave = useCallback(() => {
    setIsAutosaveEnabled((prev) => !prev);
  }, []);

  const handleSaveMap = useCallback(async (): Promise<boolean> => {
    if (!isAutosaveEnabled) {
      setIsAutoSaving(true);
    }
    const result = await performSave();
    setIsAutoSaving(false);
    return result;
  }, [performSave, isAutosaveEnabled]);

  const handleSaveAndExit = useCallback(async (): Promise<void> => {
    await handleSaveMap();
    router.push('/');
  }, [handleSaveMap, router]);

  const loadMapData = useCallback(async (mapId: string): Promise<void> => {
    try {
      const mapData = await loadMap(mapId);

      if (mapData) {
        setElements(mapData.elements ?? []);
        setConnections(mapData.connections ?? []);
        setCanvasPosition(mapData.canvasPosition ?? { x: 0, y: 0 });
        setScale(typeof mapData.scale === 'number' ? mapData.scale : 1);
        setMapName(mapData.name ?? 'Untitled Map');
        setSavedMapId(mapData._id ?? null);
        setIsPrivate(Boolean(mapData.isPrivate));
      }
    } catch (error) {
      console.error('Error loading map:', error);
      toast.error('Error loading map');
    }
  }, [setCanvasPosition, setConnections, setElements, setScale]);

  const handleDeleteMap = useCallback(async (): Promise<void> => {
    if (savedMapId) {
      const success = await deleteMap(savedMapId);
      if (success) {
        toast.success('Map deleted successfully');
        router.push('/saved-maps');
      }
    }
  }, [savedMapId, router]);

  const handleCopyShareLink = useCallback((): void => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  }, []);

  const updateMapFromLoadedData = useCallback((
    loadedData: {
      elements: MapElement[];
      connections: Connection[];
      canvasPosition: { x: number; y: number };
      scale: number;
      name: string;
      isPrivate: boolean;
      _id: string;
    }
  ) => {
    // Update all the state based on loaded data
    setMapName(loadedData.name);
    setSavedMapId(loadedData._id);
    setIsPrivate(loadedData.isPrivate);

    // Return the data for the parent component to use in its state setters
    return loadedData;
  }, []);

  return {
    // State
    mapName,
    setMapName,
    savedMapId,
    setSavedMapId,
    isPrivate,
    setIsPrivate,

    // Refs
    performSaveRef,

    // Actions
    performSave,
    handleSaveMap,
    handleSaveAndExit,
    loadMapData,
    handleDeleteMap,
    handleCopyShareLink,
    updateMapFromLoadedData,
    isAutosaveEnabled,
    toggleAutosave,
    isAutoSaving,
    setIsAutoSaving,
  };
};
