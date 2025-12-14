'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateAlignmentGuides, getDefaultDimensions, snapToGrid } from '../utils';
import { AlignmentGuide, Connection, MapElement, SnapToGridArgs } from '../types';

interface UseCanvasStateArgs {
  initialElements?: MapElement[];
  initialConnections?: Connection[];
}

export const useCanvasState = ({
  initialElements = [],
  initialConnections = [],
}: UseCanvasStateArgs = {}) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const transformsRef = useRef<Record<string, { x: number; y: number } | null>>({});

  const updateElement = useCallback(
    (id: string, updater: (prev: MapElement) => MapElement) => {
      setElements((prev) => prev.map((element) => (element.id === id ? updater(element) : element)));
    },
  [],
  );

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((element) => element.id !== id));
    setConnections((prev) => prev.filter((connection) => connection.start !== id && connection.end !== id));
  }, []);

  const registerTransform = useCallback((id: string, transform: { x: number; y: number } | null) => {
    transformsRef.current[id] = transform;
  }, []);

  const getElementDimensions = useCallback((element: MapElement) => {
    const defaults = getDefaultDimensions(element);
    return {
      width: element.width || defaults.width,
      height: element.height || defaults.height,
    };
  }, []);

  const getAlignmentGuides = useCallback(
    (id: string, left: number, top: number) => calculateAlignmentGuides(elements, id, left, top),
    [elements],
  );

  const getSnapTransform = useCallback((args: SnapToGridArgs) => snapToGrid(args), []);

  const applyTransformUpdates = useCallback(() => {
    setElements((prevElements) =>
      prevElements.map((element) => {
        const transform = transformsRef.current[element.id];
        if (transform && (transform.x !== 0 || transform.y !== 0)) {
          const updated = {
            ...element,
            left: element.left + transform.x,
            top: element.top + transform.y,
          };
          transformsRef.current[element.id] = null;
          return updated;
        }
        return element;
      }),
    );
  }, []);

  useEffect(() => {
    const handleElementResized = (event: Event) => {
      const custom = event as CustomEvent<{
        id: string;
        left: number;
        top: number;
        width: number;
        height: number;
        resetTransform?: boolean;
      }>;
      const { id, left, top, width, height } = custom.detail;
      setElements((prev) =>
        prev.map((element) =>
          element.id === id
            ? {
                ...element,
                left,
                top,
                width,
                height,
              }
            : element,
        ),
      );
      transformsRef.current[id] = null;
    };

    const handleElementResizeProgress = (event: Event) => {
      const custom = event as CustomEvent<{
        id: string;
        left: number;
        top: number;
        width: number;
        height: number;
      }>;
      const { id, left, top, width, height } = custom.detail;
      setElements((prev) =>
        prev.map((element) =>
          element.id === id
            ? {
                ...element,
                left,
                top,
                width,
                height,
              }
            : element,
        ),
      );
    };

    const handleDragFinished = () => {
      applyTransformUpdates();
    };

    document.addEventListener('element-resized', handleElementResized);
    document.addEventListener('element-resize-progress', handleElementResizeProgress);
    document.addEventListener('element-drag-finished', handleDragFinished);

    return () => {
      document.removeEventListener('element-resized', handleElementResized);
      document.removeEventListener('element-resize-progress', handleElementResizeProgress);
      document.removeEventListener('element-drag-finished', handleDragFinished);
    };
  }, [applyTransformUpdates]);

  return useMemo(
    () => ({
      elements,
      setElements,
      connections,
      setConnections,
      selectedElement,
      setSelectedElement,
      alignmentGuides,
      setAlignmentGuides,
      updateElement,
      removeElement,
      registerTransform,
      transformsRef,
      getElementDimensions,
      getAlignmentGuides,
      getSnapTransform,
    }),
    [
      elements,
      connections,
      selectedElement,
      alignmentGuides,
      updateElement,
      removeElement,
      registerTransform,
      transformsRef,
      getElementDimensions,
      getAlignmentGuides,
      getSnapTransform,
    ],
  );
};

export type UseCanvasStateReturn = ReturnType<typeof useCanvasState>;

