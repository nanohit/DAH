'use client';

import { useCallback, useState } from 'react';
import type React from 'react';
import { MapElement } from '../types';

interface UseConnectionsArgs {
  elements: MapElement[];
  scale: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface TempConnectionState {
  x: number;
  y: number;
  targetElementId: string | null;
  targetAnchor: 'top' | 'right' | 'bottom' | 'left' | null;
}

export const getElementDimensions = (element: MapElement) => {
  const defaultWidth = element.type === 'book' ? 140 : element.orientation === 'horizontal' ? 160 : 140;
  const defaultHeight = element.type === 'book' ? 220 : element.orientation === 'horizontal' ? 128 : 200;
  return {
    width: element.width || defaultWidth,
    height: element.height || defaultHeight,
  };
};

const computeAnchorPosition = (element: MapElement, anchor: 'top' | 'right' | 'bottom' | 'left') => {
  const { width, height } = getElementDimensions(element);
  switch (anchor) {
    case 'top':
      return { x: element.left + width / 2, y: element.top };
    case 'right':
      return { x: element.left + width, y: element.top + height / 2 };
    case 'bottom':
      return { x: element.left + width / 2, y: element.top + height };
    case 'left':
    default:
      return { x: element.left, y: element.top + height / 2 };
  }
};

const projectPointToAnchor = (
  element: MapElement,
  anchor: 'top' | 'right' | 'bottom' | 'left',
  x: number,
  y: number,
) => {
  const { width, height } = getElementDimensions(element);
  const left = element.left;
  const right = element.left + width;
  const top = element.top;
  const bottom = element.top + height;

  const clampedX = Math.min(Math.max(x, left), right);
  const clampedY = Math.min(Math.max(y, top), bottom);

  const surfaceOffset = Math.max(6, Math.min(Math.max(width, height) * 0.08, 18));

  switch (anchor) {
    case 'left':
      return { x: left - surfaceOffset, y: clampedY };
    case 'right':
      return { x: right + surfaceOffset, y: clampedY };
    case 'top':
      return { x: clampedX, y: top - surfaceOffset };
    case 'bottom':
    default:
      return { x: clampedX, y: bottom + surfaceOffset };
  }
};

const resolveClosestAnchor = (
  element: MapElement,
  x: number,
  y: number,
  previousAnchor?: 'top' | 'right' | 'bottom' | 'left' | null,
): 'top' | 'right' | 'bottom' | 'left' => {
  const { width, height } = getElementDimensions(element);

  const left = element.left;
  const right = element.left + width;
  const top = element.top;
  const bottom = element.top + height;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  const outside = x < left || x > right || y < top || y > bottom;

  let candidate: 'top' | 'right' | 'bottom' | 'left';
  let candidateScore: number;

  if (outside) {
    const distances: Record<'top' | 'right' | 'bottom' | 'left', number> = {
      left: Math.abs(x - left),
      right: Math.abs(right - x),
      top: Math.abs(y - top),
      bottom: Math.abs(bottom - y),
    };

    const sorted = (Object.entries(distances) as Array<[
      'top' | 'right' | 'bottom' | 'left',
      number,
    ]>).sort((a, b) => a[1] - b[1]);

    [candidate, candidateScore] = sorted[0];
  } else {
    const dx = x - cx;
    const dy = y - cy;

    if (Math.abs(dx) >= Math.abs(dy)) {
      candidate = dx < 0 ? 'left' : 'right';
      candidateScore = Math.abs(dx);
    } else {
      candidate = dy < 0 ? 'top' : 'bottom';
      candidateScore = Math.abs(dy);
    }
  }

  if (previousAnchor) {
    if (candidate === previousAnchor) {
      return candidate;
    }

    const scoreFor = (side: 'top' | 'right' | 'bottom' | 'left') => {
      if (outside) {
        switch (side) {
          case 'left':
            return Math.abs(x - left);
          case 'right':
            return Math.abs(right - x);
          case 'top':
            return Math.abs(y - top);
          case 'bottom':
          default:
            return Math.abs(bottom - y);
        }
      }

      const dx = x - cx;
      const dy = y - cy;
      switch (side) {
        case 'left':
        case 'right':
          return Math.abs(dx);
        case 'top':
        case 'bottom':
        default:
          return Math.abs(dy);
      }
    };

    const prevScore = scoreFor(previousAnchor);
    const hysteresis = Math.max(12, Math.min(width, height) * 0.15);

    if (prevScore - candidateScore < hysteresis) {
      return previousAnchor;
    }
  }

  return candidate;
};

const buildAnchorId = (elementId: string, anchor: 'top' | 'right' | 'bottom' | 'left') => `${elementId}-${anchor}-anchor`;

export const useConnections = ({ elements, scale, containerRef }: UseConnectionsArgs) => {
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; point: 'top' | 'right' | 'bottom' | 'left' } | null>(null);
  const [tempConnection, setTempConnection] = useState<TempConnectionState | null>(null);

  const clearTempConnection = useCallback(() => {
    setConnectingFrom(null);
    setTempConnection(null);
  }, []);

  const handleStartConnection = useCallback(
    (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', event: React.MouseEvent | React.TouchEvent) => {
      event.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const canvasX = 'touches' in event && event.touches.length
        ? (event.touches[0].clientX - rect.left) / scale
        : ((event as React.MouseEvent).clientX - rect.left) / scale;
      const canvasY = 'touches' in event && event.touches.length
        ? (event.touches[0].clientY - rect.top) / scale
        : ((event as React.MouseEvent).clientY - rect.top) / scale;

      setConnectingFrom({ elementId, point });
      setTempConnection({ x: canvasX, y: canvasY, targetElementId: null, targetAnchor: null });
    },
    [containerRef, scale],
  );

  const resolveClosestAnchorForElement = useCallback(
    (
      elementId: string,
      x: number,
      y: number,
      previousAnchor?: 'top' | 'right' | 'bottom' | 'left' | 'none' | null,
    ): 'top' | 'right' | 'bottom' | 'left' | null => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return null;
      return resolveClosestAnchor(element, x, y, previousAnchor ?? undefined);
    },
    [elements],
  );

  const projectAnchorPositionForElement = useCallback(
    (
      elementId: string,
      anchor: 'top' | 'right' | 'bottom' | 'left',
      x: number,
      y: number,
      previousAnchor?: 'top' | 'right' | 'bottom' | 'left' | null,
    ) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return null;
      return projectPointToAnchor(element, anchor, x, y, previousAnchor ?? undefined);
    },
    [elements],
  );

  const getAnchorPositionForElement = useCallback(
    (elementId: string, anchor: 'top' | 'right' | 'bottom' | 'left') => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return null;
      return computeAnchorPosition(element, anchor);
    },
    [elements],
  );

  return {
    connectingFrom,
    tempConnection,
    setConnectingFrom,
    setTempConnection,
    handleStartConnection,
    clearTempConnection,
    resolveClosestAnchorForElement,
    projectAnchorPositionForElement,
    getAnchorPositionForElement,
  };
};
