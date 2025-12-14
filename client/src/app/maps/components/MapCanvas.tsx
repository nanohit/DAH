'use client';

import { type Dispatch, type SetStateAction, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent, type RefObject, type MutableRefObject } from 'react';
import { Xwrapper } from 'react-xarrows';
import { MapElement, Connection } from '../types';
import ElementWithConnections from './ElementWithConnections';
import TempConnection from './TempConnection';
import ConnectionLine from './ConnectionLine';
import ScaledXarrow from './ScaledXarrow';

interface MapCanvasProps {
  elements: MapElement[];
  setElements: Dispatch<SetStateAction<MapElement[]>>;
  connections: Connection[];
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  selectedElement: string | null;
  setSelectedElement: (id: string | null) => void;
  alignmentGuides: Array<{ position: number; type: 'vertical' | 'horizontal' }>;
  setAlignmentGuides: (guides: Array<{ position: number; type: 'vertical' | 'horizontal' }>) => void;
  isDuplicating: boolean;
  setIsDuplicating: (value: boolean) => void;
  isAltKeyPressed: boolean;
  containerRef: RefObject<HTMLDivElement>;
  canvasPosition: { x: number; y: number };
  scale: number;
  isPanning: boolean;
  handlePanStart: (event: ReactMouseEvent | ReactTouchEvent) => void;
  handlePanMove: (event: ReactMouseEvent | ReactTouchEvent) => void;
  handlePanEnd: () => void;
  handleDragStart: (elementId: string, context: { altKey: boolean }) => void;
  handleDragMove: (elementId: string, delta: { x: number; y: number }) => void;
  handleDragEnd: (elementId: string, delta: { x: number; y: number }, context: { altKey: boolean }) => void;
  handleContainerClick: (e: ReactMouseEvent) => void;
  handleBackgroundPointerDown?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  handleBackgroundDoubleClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  handleStartConnection: (
    elementId: string,
    point: 'top' | 'right' | 'bottom' | 'left',
    e: ReactMouseEvent,
  ) => void;
  connectingFrom: {
    elementId: string;
    point: 'top' | 'right' | 'bottom' | 'left';
  } | null;
  tempConnection: { x: number; y: number; targetElementId: string | null; targetAnchor: 'top' | 'right' | 'bottom' | 'left' | null } | null;
  handleElementClick: (elementId: string) => void;
  handleTextChange: (id: string, text: string) => void;
  handleDoubleClick: (element: MapElement) => void;
  handleToggleCompleted?: (elementId: string) => void;
  drawConnections: boolean;
  drawAlignmentGuides: boolean;
  transformsRef: MutableRefObject<Record<string, { x: number; y: number } | null>>;
}

export const MapCanvas = ({
  elements,
  setElements,
  connections,
  setConnections,
  selectedElement,
  setSelectedElement,
  alignmentGuides,
  setAlignmentGuides,
  isDuplicating,
  setIsDuplicating,
  isAltKeyPressed,
  containerRef,
  canvasPosition,
  scale,
  isPanning,
  handlePanStart,
  handlePanMove,
  handlePanEnd,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleContainerClick,
  handleBackgroundPointerDown,
  handleBackgroundDoubleClick,
  handleStartConnection,
  connectingFrom,
  tempConnection,
  handleElementClick,
  handleTextChange,
  handleDoubleClick,
  handleToggleCompleted,
  drawConnections,
  drawAlignmentGuides,
  transformsRef,
}: MapCanvasProps) => {
  return (
    <div
      className={`map-canvas-wrapper absolute ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ width: '100%', height: '100%' }}
    >
      <div
        ref={containerRef}
        className={`map-container with-grid ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translate3d(${canvasPosition.x}px, ${canvasPosition.y}px, 0) scale(${scale})`,
          transformOrigin: 'top left',
          willChange: 'transform',
          width: '2700px',
          height: '2700px',
          position: 'relative',
        }}
        onClick={handleContainerClick}
      >
          <Xwrapper>
            <div
              className="canvas-background"
              style={{ position: 'relative', width: '100%', height: '100%' }}
              onMouseDown={(e) => {
                handleBackgroundPointerDown?.(e);
                if (e.target === e.currentTarget || e.shiftKey) {
                  handlePanStart(e);
                }
              }}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
              onTouchStart={handlePanStart}
              onTouchMove={handlePanMove}
              onTouchEnd={handlePanEnd}
              onTouchCancel={handlePanEnd}
              onDoubleClick={handleBackgroundDoubleClick}
            >
              {drawAlignmentGuides &&
                alignmentGuides.map((guide) => (
                  <div
                    key={`${guide.type}-${guide.position}`}
                    className={`alignment-guide alignment-guide-${guide.type}`}
                    style={{
                      position: 'absolute',
                      left: guide.type === 'vertical' ? `${guide.position}px` : 0,
                      top: guide.type === 'horizontal' ? `${guide.position}px` : 0,
                    }}
                  />
                ))}

              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {elements
                  .filter((element) => element.type === 'line')
                  .map((element) => (
                    <ConnectionLine
                      key={element.id}
                      element={element}
                      isSelected={selectedElement === element.id}
                      onSelect={setSelectedElement}
                      setElements={setElements}
                      containerRef={containerRef}
                      scale={scale}
                    />
                  ))}
              </svg>

              {elements
                .filter((element) => element.type !== 'line')
                .map((element) => (
                  <ElementWithConnections
                    key={element.id}
                    element={element}
                    isSelected={selectedElement === element.id}
                    onSelect={handleElementClick}
                    onStartConnection={handleStartConnection}
                    transformsRef={transformsRef}
                    onTextChange={handleTextChange}
                    onDoubleClick={handleDoubleClick}
                    scale={scale}
                    isAltPressed={isAltKeyPressed}
                    isDuplicating={isDuplicating}
                    onToggleCompleted={handleToggleCompleted}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                  />
                ))}

              {drawConnections && (
                <>
                  {connections.map((connection) => (
                    <ScaledXarrow
                      key={connection.id}
                      start={connection.start}
                      end={connection.end}
                      startAnchor={connection.startPoint || 'middle'}
                      endAnchor={connection.endPoint || 'middle'}
                      color="#8B8B8B"
                      strokeWidth={1.5}
                      path="smooth"
                      headSize={6}
                      curveness={0.8}
                      scale={scale}
                    />
                  ))}
                  {connectingFrom && tempConnection && (
                    <TempConnection
                      start={connectingFrom.elementId}
                      startPoint={connectingFrom.point}
                      end={tempConnection}
                      scale={scale}
                    />
                  )}
                </>
              )}
            </div>
          </Xwrapper>
        </div>
    </div>
  );
};

export default MapCanvas;

