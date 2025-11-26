'use client';

import { useMemo } from 'react';
import Xarrow from 'react-xarrows';

interface ScaledXarrowProps {
  start: string;
  end: string;
  startAnchor: 'top' | 'right' | 'bottom' | 'left' | 'middle';
  endAnchor: 'top' | 'right' | 'bottom' | 'left' | 'middle';
  color: string;
  strokeWidth: number;
  path: 'straight' | 'smooth' | 'grid';
  headSize: number;
  curveness: number;
  scale: number;
}

export const ScaledXarrow = ({
  start,
  end,
  startAnchor,
  endAnchor,
  color,
  strokeWidth,
  path,
  headSize,
  curveness,
  scale,
}: ScaledXarrowProps) => {
  const containerId = useMemo(() => `arrow-container-${Math.random().toString(36).slice(2)}`, []);

  const adjustedStartAnchor = useMemo(() => {
    const startElement = document.getElementById(start);
    if (startElement && startElement.getAttribute('data-type') === 'book' && startAnchor === 'bottom') {
      return 'bottom';
    }
    return startAnchor;
  }, [start, startAnchor]);

  const adjustedEndAnchor = useMemo(() => {
    const endElement = document.getElementById(end);
    if (endElement && endElement.getAttribute('data-type') === 'book' && endAnchor === 'bottom') {
      return 'bottom';
    }
    return endAnchor;
  }, [end, endAnchor]);

  const normalizedScale = scale || 1;

  return (
    <div
      id={containerId}
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${1 / normalizedScale})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <Xarrow
        start={start}
        end={end}
        startAnchor={adjustedStartAnchor}
        endAnchor={adjustedEndAnchor}
        color={color}
        strokeWidth={strokeWidth * normalizedScale}
        path={path}
        headSize={headSize * normalizedScale}
        curveness={curveness}
        zIndex={5}
      />
    </div>
  );
};

export default ScaledXarrow;

