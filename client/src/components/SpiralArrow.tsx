'use client';

import { useEffect, useRef, useState } from 'react';

interface SpiralArrowProps {
  isVisible: boolean;
  startRef: React.RefObject<HTMLElement | null>;
  endRef: React.RefObject<HTMLElement | null>;
}

export const SpiralArrow = ({ isVisible, startRef, endRef }: SpiralArrowProps) => {
  const [pathData, setPathData] = useState('');
  const [pathLength, setPathLength] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute path based on current element positions
  const updatePath = () => {
      if (!startRef.current || !endRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const startRect = startRef.current.getBoundingClientRect();
      const endRect = endRef.current.getBoundingClientRect();

      // Start point: right side of "Мощный инструмент" button
      const startX = startRect.right - containerRect.left + 5;
      const startY = startRect.top - containerRect.top + startRect.height / 2;

      // End point: left side of "доске +" button
      const endX = endRect.left - containerRect.left - 8;
      const endY = endRect.top - containerRect.top + endRect.height / 2;

      // Calculate spiral and curve path
      // First spiral loop around the button
      const loopRadius1 = 25;
      const loopRadius2 = 35;
      
      // Center of button for spiral
      const buttonCenterX = startRect.left - containerRect.left + startRect.width / 2;
      const buttonCenterY = startRect.top - containerRect.top + startRect.height / 2;

      // Create a path that:
      // 1. Starts from right of button
      // 2. Curves up and around (first small loop)
      // 3. Curves around again (second larger loop)
      // 4. Bends down toward the doske button
      // 5. Approaches from the left

      const path = `
        M ${startX} ${startY}
        C ${startX + 30} ${startY - 40},
          ${buttonCenterX + loopRadius1 + 20} ${buttonCenterY - loopRadius1 - 30},
          ${buttonCenterX} ${buttonCenterY - loopRadius1 - 15}
        C ${buttonCenterX - loopRadius1 - 25} ${buttonCenterY - loopRadius1 - 25},
          ${buttonCenterX - loopRadius2 - 15} ${buttonCenterY - 10},
          ${buttonCenterX - loopRadius2} ${buttonCenterY + 20}
        C ${buttonCenterX - loopRadius2 + 10} ${buttonCenterY + loopRadius2 + 30},
          ${buttonCenterX + 20} ${buttonCenterY + loopRadius2 + 20},
          ${buttonCenterX + loopRadius2 + 30} ${buttonCenterY + 30}
        C ${buttonCenterX + loopRadius2 + 60} ${buttonCenterY + 50},
          ${endX + 150} ${startY + 40},
          ${endX + 100} ${endY - 30}
        C ${endX + 60} ${endY - 10},
          ${endX + 30} ${endY},
          ${endX} ${endY}
      `.replace(/\s+/g, ' ').trim();

    setPathData(path);
  };

  useEffect(() => {
    updatePath();

    // Re-run when window resizes
    window.addEventListener('resize', updatePath);

    // Small delay to ensure refs are ready after mount/DOM paint
    const timer = setTimeout(updatePath, 120);

    // Observe size/position changes of start/end
    const observers: ResizeObserver[] = [];
    const maybeObserve = (el: Element | null) => {
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => updatePath());
      ro.observe(el);
      observers.push(ro);
    };
    maybeObserve(startRef.current);
    maybeObserve(endRef.current);
    maybeObserve(containerRef.current);

    return () => {
      window.removeEventListener('resize', updatePath);
      clearTimeout(timer);
      observers.forEach((o) => o.disconnect());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute when visibility toggles (hover in/out) to catch late refs/layout
  useEffect(() => {
    updatePath();
  }, [isVisible]);

  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      setPathLength(length);
    }
  }, [pathData]);

  if (!pathData) return null;

  return (
    <div 
      ref={containerRef}
      className="spiral-arrow-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#38bdf8"
              className={`arrow-head ${isVisible ? 'visible' : ''}`}
            />
          </marker>
        </defs>
        
        {/* Main animated path */}
        <path
          ref={pathRef}
          d={pathData}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd="url(#arrowhead)"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: isVisible ? 0 : pathLength,
            transition: isVisible 
              ? 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
              : 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: pathLength > 0 ? 1 : 0,
          }}
        />
      </svg>

      <style jsx>{`
        .arrow-head {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .arrow-head.visible {
          opacity: 1;
          transition: opacity 0.2s ease 0.6s;
        }
      `}</style>
    </div>
  );
};

export default SpiralArrow;
