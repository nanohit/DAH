'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AUTOSAVE_INTERVAL_MS } from '../constants';
import { MapElement, Connection } from '../types';

interface UseAutosaveArgs {
  elements: MapElement[];
  connections: Connection[];
  canvasPosition: { x: number; y: number };
  scale: number;
  mapName: string;
  savedMapId: string | null;
  isAutosaveEnabled: boolean;
  isPrivate: boolean;
  container: HTMLDivElement | null;
  performSaveRef: React.MutableRefObject<() => Promise<boolean>>;
  isAutoSaving: boolean;
  setIsAutoSaving: (value: boolean) => void;
}

export const useAutosave = ({
  elements,
  connections,
  canvasPosition,
  scale,
  mapName,
  savedMapId,
  isAutosaveEnabled,
  isPrivate,
  container,
  performSaveRef,
  isAutoSaving,
  setIsAutoSaving,
}: UseAutosaveArgs) => {
  const lastDataRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSave = useCallback(async () => {
    if (!mapName) return false;
    setIsAutoSaving(true);
    try {
      const result = await performSaveRef.current();
      if (result) {
        lastDataRef.current = JSON.stringify({ elements, connections });
      }
      return result;
    } finally {
      setIsAutoSaving(false);
    }
  }, [mapName, performSaveRef, elements, connections, setIsAutoSaving]);

  useEffect(() => {
    if (!isAutosaveEnabled || !savedMapId) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const schedule = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(async () => {
        const currentData = JSON.stringify({ elements, connections });
        if (currentData !== lastDataRef.current && !isAutoSaving) {
          await triggerSave();
        }
        schedule();
      }, AUTOSAVE_INTERVAL_MS);
    };

    schedule();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [elements, connections, isAutosaveEnabled, savedMapId, triggerSave, isAutoSaving]);

  useEffect(() => {
    lastDataRef.current = JSON.stringify({ elements, connections });
  }, [elements, connections]);
};

