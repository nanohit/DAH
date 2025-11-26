'use client';

import { useCallback, useEffect, useState, memo } from 'react';
import { MapElement } from '../types';

interface ConnectionLineProps {
  element: MapElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
  containerRef: React.RefObject<HTMLDivElement>;
  scale: number;
}

const ConnectionLineComponent = ({
  element,
  isSelected,
  onSelect,
  setElements,
  containerRef,
  scale,
}: ConnectionLineProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialPosition, setInitialPosition] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.altKey) {
        setIsAltKeyPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltKeyPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const calculateAngle = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  }, []);

  const snapAngle = useCallback((angle: number) => {
    const commonAngles = [0, 45, 90, 135, 180, -135, -90, -45];
    const threshold = 10;
    let closestAngle = commonAngles[0];
    let minDiff = Math.abs(angle - commonAngles[0]);
    for (const commonAngle of commonAngles) {
      const diff = Math.abs(angle - commonAngle);
      if (diff < minDiff) {
        minDiff = diff;
        closestAngle = commonAngle;
      }
    }
    return minDiff <= threshold ? closestAngle : angle;
  }, []);

  const calculateEndpoint = useCallback((startX: number, startY: number, angle: number, distance: number) => {
    const angleRad = (angle * Math.PI) / 180;
    return {
      x: startX + distance * Math.cos(angleRad),
      y: startY + distance * Math.sin(angleRad),
    };
  }, []);

  if (!element.lineData) return null;
  const { startX, startY, endX, endY } = element.lineData;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(element.id);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition({ startX, startY, endX, endY });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStart || !initialPosition) return;
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;
      const updatedElement = {
        ...element,
        lineData: {
          ...element.lineData,
          startX: initialPosition.startX + dx,
          startY: initialPosition.startY + dy,
          endX: initialPosition.endX + dx,
          endY: initialPosition.endY + dy,
        },
      };
      setElements((prev) => prev.map((el) => (el.id === element.id ? updatedElement : el)));
    },
    [element, isDragging, dragStart, initialPosition, setElements, scale],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setInitialPosition(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleLineHandleMouseDown = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      if (!target.classList.contains('line-handle')) return;
      const elementId = target.getAttribute('data-element-id');
      const handle = target.getAttribute('data-handle');
      if (!elementId || !handle || elementId !== element.id) return;
      e.stopPropagation();
      e.preventDefault();

      const handleMove = (event: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale;
        const y = (event.clientY - rect.top) / scale;
        const [fixedX, fixedY] = handle === 'start' ? [endX, endY] : [startX, startY];
        let angle = calculateAngle(fixedX, fixedY, x, y);
        const distance = Math.sqrt((x - fixedX) ** 2 + (y - fixedY) ** 2);
        const snappedAngle = snapAngle(angle);
        const newPoint = calculateEndpoint(fixedX, fixedY, snappedAngle, distance);

        setElements((prev) =>
          prev.map((el) =>
            el.id === element.id && el.lineData
              ? {
                  ...el,
                  lineData:
                    handle === 'start'
                      ? { ...el.lineData, startX: newPoint.x, startY: newPoint.y }
                      : { ...el.lineData, endX: newPoint.x, endY: newPoint.y },
                }
              : el,
          ),
        );
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousedown', handleLineHandleMouseDown);
    return () => document.removeEventListener('mousedown', handleLineHandleMouseDown);
  }, [element.id, startX, startY, endX, endY, containerRef, scale, calculateAngle, snapAngle, calculateEndpoint, setElements]);

  return (
    <g>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="transparent"
        strokeWidth="20"
        style={{ cursor: isSelected ? 'move' : 'pointer' }}
        onMouseDown={handleMouseDown}
        data-element-id={element.id}
        data-element-type="line"
      />
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={isSelected ? '#3B82F6' : '#8B8B8B'}
        strokeWidth={isSelected ? '2' : '1.5'}
        style={{ pointerEvents: 'none' }}
      />
      {isSelected && (
        <>
          <circle cx={startX} cy={startY} r={8} fill="#3B82F6" className="line-handle start-handle" data-element-id={element.id} data-handle="start" />
          <circle cx={endX} cy={endY} r={8} fill="#3B82F6" className="line-handle end-handle" data-element-id={element.id} data-handle="end" />
        </>
      )}
    </g>
  );
};

export const ConnectionLine = ConnectionLineComponent;

export default memo(ConnectionLineComponent);

