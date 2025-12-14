'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseTouchInteractionsArgs {
  scale: number;
  setScale: (scale: number) => void;
  canvasPosition: { x: number; y: number };
  setCanvasPosition: (position: { x: number; y: number }) => void;
  startPan: (clientX: number, clientY: number) => void;
}

export const useTouchInteractions = ({
  scale,
  setScale,
  canvasPosition,
  setCanvasPosition,
  startPan,
}: UseTouchInteractionsArgs) => {
  const [touchPoints, setTouchPoints] = useState<Record<number, { x: number; y: number }>>({});
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(scale);

  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((touches: TouchList) => {
    const newPoints: Record<number, { x: number; y: number }> = {};
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      newPoints[touch.identifier] = { x: touch.clientX, y: touch.clientY };
    }
    setTouchPoints(newPoints);

    if (touches.length === 2) {
      const distance = getDistance(newPoints[touches[0].identifier], newPoints[touches[1].identifier]);
      setInitialPinchDistance(distance);
      setInitialScale(scale);
    }

    if (touches.length === 1) {
      startPan(touches[0].clientX, touches[0].clientY);
    }
  }, [scale, startPan]);

  const handleTouchMove = useCallback((touches: TouchList) => {
    if (touches.length === 2 && initialPinchDistance) {
      const point1 = { x: touches[0].clientX, y: touches[0].clientY };
      const point2 = { x: touches[1].clientX, y: touches[1].clientY };
      const distance = getDistance(point1, point2);
      const newScale = initialScale * (distance / initialPinchDistance);
      setScale(Math.min(Math.max(newScale, 0.2), 2));
      return;
    }

    if (touches.length === 1) {
      const touch = touches[0];
      setCanvasPosition({
        x: touch.clientX - (touchPoints[touch.identifier]?.x ?? 0),
        y: touch.clientY - (touchPoints[touch.identifier]?.y ?? 0),
      });
    }
  }, [initialPinchDistance, initialScale, setScale, setCanvasPosition, touchPoints]);

  const handleTouchEnd = useCallback((touches: TouchList) => {
    if (touches.length < 2) {
      setInitialPinchDistance(null);
    }
    if (touches.length === 0) {
      setTouchPoints({});
    }
  }, []);

  useEffect(() => {
    const handleTouchMoveEvent = (e: TouchEvent) => {
      handleTouchMove(e.touches);
      e.preventDefault();
    };
    const handleTouchEndEvent = (e: TouchEvent) => {
      handleTouchEnd(e.touches);
    };
    document.addEventListener('touchmove', handleTouchMoveEvent, { passive: false });
    document.addEventListener('touchend', handleTouchEndEvent);
    return () => {
      document.removeEventListener('touchmove', handleTouchMoveEvent);
      document.removeEventListener('touchend', handleTouchEndEvent);
    };
  }, [handleTouchMove, handleTouchEnd]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};

export type UseTouchInteractionsReturn = ReturnType<typeof useTouchInteractions>;

