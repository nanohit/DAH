'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

enum PanButton {
  MAIN = 0,
}

type CameraState = {
  x: number;
  y: number;
  scale: number;
};

type CameraUpdater = CameraState | ((prev: CameraState) => CameraState);

type PanGesture = {
  kind: 'mouse' | 'touch';
  identifier?: number;
  last: { x: number; y: number };
};

type PinchGesture = {
  lastDistance: number;
  lastCenter: { x: number; y: number };
};

type GestureState =
  | { mode: 'idle' }
  | { mode: 'pan'; pan: PanGesture }
  | { mode: 'pinch'; pinch: PinchGesture };

type TouchLike = {
  identifier: number;
  clientX: number;
  clientY: number;
};

interface UsePanAndZoomArgs {
  initialScale?: number;
  initialCanvasPosition?: { x: number; y: number };
  isModalOpen?: () => boolean;
  onZoomChange?: (scale: number) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const CANVAS_DIMENSIONS = { width: 2700, height: 2700 };
const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const ZOOM_SENSITIVITY = 0.002;
const KEYBOARD_DELTA = 240;
const TRACKPAD_PIXEL_STEP_THRESHOLD = 80;
const TRACKPAD_SESSION_TIMEOUT_MS = 180;

const clampScale = (scale: number) => Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);

const distanceBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const touchListToArray = (touches: { length: number; item: (index: number) => any }): TouchLike[] => {
  const result: TouchLike[] = [];
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch) {
      result.push({
        identifier: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
    }
  }
  return result;
};

const screenToWorld = (point: { x: number; y: number }, camera: CameraState) => ({
  x: (point.x - camera.x) / camera.scale,
  y: (point.y - camera.y) / camera.scale,
});

export const usePanAndZoom = ({
  initialScale = 1,
  initialCanvasPosition,
  isModalOpen,
  onZoomChange,
  containerRef,
}: UsePanAndZoomArgs = {}) => {
  const computeInitialCamera = useCallback((): CameraState => {
    const scale = clampScale(initialScale);
    if (initialCanvasPosition) {
      return { x: initialCanvasPosition.x, y: initialCanvasPosition.y, scale };
    }

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    return {
      x: (viewportWidth - CANVAS_DIMENSIONS.width * scale) / 2,
      y: (viewportHeight - CANVAS_DIMENSIONS.height * scale) / 2,
      scale,
    };
  }, [initialCanvasPosition, initialScale]);

  const [camera, setCameraState] = useState<CameraState>(() => computeInitialCamera());
  const cameraRef = useRef<CameraState>(camera);
  const rafRef = useRef<number | null>(null);
  const pendingCameraRef = useRef<CameraState | null>(null);
  const gestureRef = useRef<GestureState>({ mode: 'idle' });
  const wheelSourceRef = useRef<'mouse' | 'trackpad'>('mouse');
  const trackpadSessionTimeoutRef = useRef<number | null>(null);
  const isTrackpadSessionActiveRef = useRef(false);

  const [isPanning, setIsPanning] = useState(false);

  const applyCamera = useCallback(
    (updater: CameraUpdater, options: { throttle?: boolean } = {}) => {
      const previous = cameraRef.current;
      const nextCandidate =
        typeof updater === 'function' ? (updater as (prev: CameraState) => CameraState)(previous) : updater;

      const clamped: CameraState = {
        x: nextCandidate.x,
        y: nextCandidate.y,
        scale: clampScale(nextCandidate.scale),
      };

      if (
        clamped.x === previous.x &&
        clamped.y === previous.y &&
        clamped.scale === previous.scale
      ) {
        return previous;
      }

      cameraRef.current = clamped;

      if (options.throttle) {
        pendingCameraRef.current = clamped;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingCameraRef.current) {
              setCameraState(pendingCameraRef.current);
              pendingCameraRef.current = null;
            }
          });
        }
      } else {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        pendingCameraRef.current = null;
        setCameraState(clamped);
      }

      return clamped;
    },
    [],
  );

  const zoomAroundPoint = useCallback(
    (
      screenPoint: { x: number; y: number },
      scaleUpdater: (prev: number) => number,
      options: { throttle?: boolean } = {},
    ) => {
      applyCamera(
        (prev) => {
          const nextScale = clampScale(scaleUpdater(prev.scale));
          if (nextScale === prev.scale) {
            return prev;
          }

          const worldPoint = screenToWorld(screenPoint, prev);
          return {
            x: screenPoint.x - worldPoint.x * nextScale,
            y: screenPoint.y - worldPoint.y * nextScale,
            scale: nextScale,
          };
        },
        options,
      );
    },
    [applyCamera],
  );

  const applyPanDelta = useCallback(
    (clientX: number, clientY: number) => {
      const gesture = gestureRef.current;
      if (gesture.mode !== 'pan') return;

      const { last } = gesture.pan;
      const deltaX = clientX - last.x;
      const deltaY = clientY - last.y;
      if (!deltaX && !deltaY) return;

      gesture.pan.last = { x: clientX, y: clientY };

      applyCamera(
        (prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
          scale: prev.scale,
        }),
        { throttle: true },
      );
    },
    [applyCamera],
  );

  const handlePinchMove = useCallback(
    (touches: { length: number; item: (index: number) => any }) => {
      const gesture = gestureRef.current;
      if (gesture.mode !== 'pinch') return;
      if (touches.length < 2) return;

      const [first, second] = touchListToArray(touches);
      if (!first || !second) return;

      const centroid = {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      };

      const currentDistance = distanceBetween(
        { x: first.clientX, y: first.clientY },
        { x: second.clientX, y: second.clientY },
      );

      if (!currentDistance || !gesture.pinch.lastDistance) {
        gesture.pinch = {
          lastDistance: currentDistance,
          lastCenter: centroid,
        };
        return;
      }

      const deltaCenter = {
        x: centroid.x - gesture.pinch.lastCenter.x,
        y: centroid.y - gesture.pinch.lastCenter.y,
      };

      applyCamera(
        (prev) => {
          const translatedX = prev.x + deltaCenter.x;
          const translatedY = prev.y + deltaCenter.y;
          const scaleRatio = currentDistance / gesture.pinch.lastDistance;
          const nextScale = clampScale(prev.scale * scaleRatio);

          const worldPoint = {
            x: (centroid.x - translatedX) / prev.scale,
            y: (centroid.y - translatedY) / prev.scale,
          };

          return {
            x: centroid.x - worldPoint.x * nextScale,
            y: centroid.y - worldPoint.y * nextScale,
            scale: nextScale,
          };
        },
        { throttle: true },
      );

      gesture.pinch.lastDistance = currentDistance;
      gesture.pinch.lastCenter = centroid;
    },
    [applyCamera],
  );

  const classifyWheelSource = useCallback((event: WheelEvent) => {
    let nextSource: 'mouse' | 'trackpad' = wheelSourceRef.current;
    const isDeltaPixelMode =
      typeof WheelEvent !== 'undefined' ? event.deltaMode === WheelEvent.DOM_DELTA_PIXEL : true;

    if (typeof WheelEvent !== 'undefined') {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE || event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        nextSource = 'mouse';
      }
    }

    if (isDeltaPixelMode) {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      const dominantDelta = Math.max(absX, absY);
      const hasDiagonalScroll = absX > 0 && absY > 0;
      const hasFractionalDelta = !Number.isInteger(absX) || !Number.isInteger(absY);

      if (dominantDelta === 0) {
        nextSource = wheelSourceRef.current;
      } else if (hasFractionalDelta || hasDiagonalScroll || dominantDelta <= TRACKPAD_PIXEL_STEP_THRESHOLD) {
        nextSource = 'trackpad';
      } else if (dominantDelta >= TRACKPAD_PIXEL_STEP_THRESHOLD * 1.2) {
        nextSource = 'mouse';
      }
    }

    wheelSourceRef.current = nextSource;
    return nextSource;
  }, []);

  const applyWheelPan = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!deltaX && !deltaY) {
        return;
      }

      applyCamera(
        (prev) => ({
          x: prev.x - deltaX,
          y: prev.y - deltaY,
          scale: prev.scale,
        }),
        { throttle: true },
      );
    },
    [applyCamera],
  );

  const startTrackpadSession = useCallback(() => {
    if (trackpadSessionTimeoutRef.current !== null) {
      clearTimeout(trackpadSessionTimeoutRef.current);
    }
    isTrackpadSessionActiveRef.current = true;
    trackpadSessionTimeoutRef.current = window.setTimeout(() => {
      isTrackpadSessionActiveRef.current = false;
      trackpadSessionTimeoutRef.current = null;
    }, TRACKPAD_SESSION_TIMEOUT_MS);
  }, []);

  const endTrackpadSession = useCallback(() => {
    if (trackpadSessionTimeoutRef.current !== null) {
      clearTimeout(trackpadSessionTimeoutRef.current);
      trackpadSessionTimeoutRef.current = null;
    }
    isTrackpadSessionActiveRef.current = false;
  }, []);

  const handlePanStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (isModalOpen?.()) return;

      if ('touches' in event) {
        if (event.touches.length === 0) return;
        if (event.touches.length === 1) {
          const touch = event.touches[0];
          gestureRef.current = {
            mode: 'pan',
            pan: {
              kind: 'touch',
              identifier: touch.identifier,
              last: { x: touch.clientX, y: touch.clientY },
            },
          };
        } else {
          const [first, second] = touchListToArray(event.touches);
          if (!first || !second) return;
          const centroid = {
            x: (first.clientX + second.clientX) / 2,
            y: (first.clientY + second.clientY) / 2,
          };
          gestureRef.current = {
            mode: 'pinch',
            pinch: {
              lastDistance: distanceBetween(
                { x: first.clientX, y: first.clientY },
                { x: second.clientX, y: second.clientY },
              ),
              lastCenter: centroid,
            },
          };
        }
        event.preventDefault();
        setIsPanning(true);
        return;
      }

      if (event.button !== PanButton.MAIN) return;
      event.preventDefault();
      gestureRef.current = {
        mode: 'pan',
        pan: {
          kind: 'mouse',
          last: { x: event.clientX, y: event.clientY },
        },
      };
      setIsPanning(true);
    },
    [isModalOpen],
  );

  const handlePanMove = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      const gesture = gestureRef.current;
      if (gesture.mode === 'idle') return;

      if ('touches' in event) {
        if (!event.touches.length) return;
        event.preventDefault();

        if (gesture.mode === 'pinch') {
          handlePinchMove(event.touches);
          return;
        }

        if (gesture.mode === 'pan' && gesture.pan.kind === 'touch') {
          const touches = touchListToArray(event.touches);
          const activeTouch = touches.find((touch) => touch.identifier === gesture.pan.identifier) || touches[0];
          if (!activeTouch) return;
          applyPanDelta(activeTouch.clientX, activeTouch.clientY);
        }
        return;
      }

      event.preventDefault();
      applyPanDelta(event.clientX, event.clientY);
    },
    [applyPanDelta, handlePinchMove],
  );

  const endPan = useCallback(() => {
    gestureRef.current = { mode: 'idle' };
    setIsPanning(false);
  }, []);

  const handlePanEnd = useCallback(
    (event?: React.TouchEvent | React.MouseEvent) => {
      if (event && 'touches' in event) {
        const remainingTouches = touchListToArray(event.touches);
        if (remainingTouches.length === 0) {
          endPan();
          return;
        }

        if (remainingTouches.length === 1) {
          const touch = remainingTouches[0];
          gestureRef.current = {
            mode: 'pan',
            pan: {
              kind: 'touch',
              identifier: touch.identifier,
              last: { x: touch.clientX, y: touch.clientY },
            },
          };
          return;
        }

        const [first, second] = remainingTouches;
        const centroid = {
          x: (first.clientX + second.clientX) / 2,
          y: (first.clientY + second.clientY) / 2,
        };

        gestureRef.current = {
          mode: 'pinch',
          pinch: {
            lastDistance: distanceBetween(
              { x: first.clientX, y: first.clientY },
              { x: second.clientX, y: second.clientY },
            ),
            lastCenter: centroid,
          },
        };
        setIsPanning(true);
        return;
      }

      endPan();
    },
    [endPan],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (trackpadSessionTimeoutRef.current !== null) {
        clearTimeout(trackpadSessionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const gesture = gestureRef.current;
    if (gesture.mode !== 'pan' || gesture.pan.kind !== 'mouse') return;

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      applyPanDelta(event.clientX, event.clientY);
    };

    const handleMouseUp = () => {
      endPan();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [applyPanDelta, endPan, isPanning]);

  useEffect(() => {
    const element = containerRef?.current ?? null;
    if (!element) return;

    const isEventOverContainer = (event: WheelEvent): boolean => {
      const target = event.target as Node | null;
      if (!target || !element) return false;
      return element.contains(target);
    };

    const handleWheel = (event: WheelEvent) => {
      if (isModalOpen?.()) return;

      const source = classifyWheelSource(event);
      const isModifierZoom = event.metaKey || event.altKey || event.ctrlKey;
      const overContainer = isEventOverContainer(event);
      const sessionActive = isTrackpadSessionActiveRef.current;

      // Determine if we should handle this event
      const shouldHandle = overContainer || (sessionActive && source === 'trackpad');

      if (!shouldHandle) {
        // If it's a mouse wheel outside container, end any trackpad session
        if (source === 'mouse') {
          endTrackpadSession();
        }
        return;
      }

      event.preventDefault();

      // Handle trackpad pan (without modifiers)
      if (!isModifierZoom && source === 'trackpad') {
        startTrackpadSession();
        applyWheelPan(event.deltaX, event.deltaY);
        return;
      }

      // Handle zoom (mouse wheel or trackpad with modifiers)
      if (source === 'trackpad' && isModifierZoom) {
        startTrackpadSession();
      } else {
        endTrackpadSession();
      }

      const deltaY = event.deltaY;
      if (!deltaY && !event.deltaX) return;

      const point = { x: event.clientX, y: event.clientY };
      zoomAroundPoint(
        point,
        (prevScale) => prevScale * Math.exp(-deltaY * ZOOM_SENSITIVITY),
        { throttle: true },
      );
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      endTrackpadSession();
    };
  }, [applyWheelPan, classifyWheelSource, containerRef, endTrackpadSession, isModalOpen, startTrackpadSession, zoomAroundPoint]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || isModalOpen?.()) return;

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        zoomAroundPoint(
          center,
          (prevScale) => prevScale * Math.exp(KEYBOARD_DELTA * ZOOM_SENSITIVITY * -1),
        );
      } else if (event.key === '-') {
        event.preventDefault();
        const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        zoomAroundPoint(
          center,
          (prevScale) => prevScale * Math.exp(KEYBOARD_DELTA * ZOOM_SENSITIVITY),
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, zoomAroundPoint]);

  useEffect(() => {
    onZoomChange?.(camera.scale);
  }, [camera.scale, onZoomChange]);

  const setCamera = useCallback(
    (updater: CameraUpdater) => {
      applyCamera(updater);
    },
    [applyCamera],
  );

  const setScale = useCallback(
    (value: number | ((prev: number) => number)) => {
      applyCamera((prev) => {
        const nextScale = clampScale(typeof value === 'function' ? value(prev.scale) : value);
        if (nextScale === prev.scale) {
          return prev;
        }
        return { ...prev, scale: nextScale };
      });
    },
    [applyCamera],
  );

  const setCanvasPosition = useCallback(
    (
      next:
        | { x: number; y: number }
        | ((prev: { x: number; y: number }) => { x: number; y: number }),
    ) => {
      applyCamera((prev) => {
        const resolved = typeof next === 'function' ? next({ x: prev.x, y: prev.y }) : next;
        if (resolved.x === prev.x && resolved.y === prev.y) {
          return prev;
        }
        return { ...prev, x: resolved.x, y: resolved.y };
      });
    },
    [applyCamera],
  );

  const memoizedCanvasPosition = useMemo(() => ({ x: camera.x, y: camera.y }), [camera.x, camera.y]);

  return {
    camera,
    scale: camera.scale,
    canvasPosition: memoizedCanvasPosition,
    setCamera,
    setScale,
    setCanvasPosition,
    isPanning,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
  };
};

export type UsePanAndZoomReturn = ReturnType<typeof usePanAndZoom>;

