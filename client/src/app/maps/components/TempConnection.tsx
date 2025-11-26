'use client';

import { useMemo } from 'react';
import ScaledXarrow from './ScaledXarrow';

interface TempConnectionProps {
  start: string;
  startPoint: 'top' | 'right' | 'bottom' | 'left';
  end: { x: number; y: number; targetElementId: string | null; targetAnchor: 'top' | 'right' | 'bottom' | 'left' | null };
  scale: number;
}

export const TempConnection = ({ start, startPoint, end, scale }: TempConnectionProps) => {
  const ghostEndId = useMemo(() => `temp-end-${Math.random().toString(36).substr(2, 9)}`, []);

  const hasTargetAnchor = Boolean(end.targetElementId && end.targetAnchor);
  const startAnchor = startPoint;
  const endAnchor = hasTargetAnchor ? end.targetAnchor! : 'middle';
  const endId = hasTargetAnchor ? end.targetElementId! : ghostEndId;

  return (
    <>
      {!hasTargetAnchor && (
        <div
          id={ghostEndId}
          style={{
            position: 'absolute',
            left: `${end.x}px`,
            top: `${end.y}px`,
            width: '1px',
            height: '1px',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
          }}
        />
      )}
      <ScaledXarrow
        start={start}
        end={endId}
        startAnchor={startAnchor}
        endAnchor={endAnchor}
        color="#8B8B8B"
        strokeWidth={1.5}
        path="smooth"
        headSize={6}
        curveness={0.8}
        scale={scale}
      />
    </>
  );
};

export default TempConnection;

