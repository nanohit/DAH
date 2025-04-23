'use client';

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragMoveEvent, Modifier, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import Xarrow, { Xwrapper } from 'react-xarrows';
import Link from 'next/link';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useXarrow, xarrowPropsType } from 'react-xarrows';
import { saveMap, loadMap, createAutosave, deleteMap, MapData, SavedMap } from '@/utils/mapUtils';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormatToolbar from '@/components/FormatToolbar';
import ReactMarkdown from 'react-markdown';
import { BsBookmark, BsBookmarkFill } from 'react-icons/bs';
import { bookmarkBook } from '@/utils/bookUtils';
import { useAuth } from '@/context/AuthContext';
import { SearchModal } from '@/components/Search/SearchModal';
import { isTokenExpiring, refreshToken } from '@/services/auth';
import { API_BASE_URL } from '@/config/api';
import DraggableElement from '@/components/Map/DraggableElement'; // Added import



interface MapElement {
  id: string;
  type: 'element' | 'book' | 'line' | 'image' | 'link';
  left: number;
  top: number;
  width?: number;
  height?: number;
  text: string;
  orientation: 'horizontal' | 'vertical';
  bookData?: {
    key: string;
    _id?: string;
    title: string;
    author: string[];
    thumbnail?: string;
    highResThumbnail?: string;
    description?: string;
    source: 'openlib' | 'google' | 'alphy';
    flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
    completed?: boolean; // Add completed status property
    flibustaVariants?: Array<{
      title: string;
      author: string;
      sourceId: string;
      formats: Array<{
        format: string;
        url: string;
      }>;
    }>;
    bookmarks?: Array<{
      user: string | { _id: string };
      timestamp: string;
    }>;
  };
  // Add line-specific properties
  lineData?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDraggingStart?: boolean;
    isDraggingEnd?: boolean;
  };
  // Add image-specific properties
  imageData?: {
    url: string;
    alt: string;
  };
  // Add link-specific properties
  linkData?: {
    url: string;
    title?: string;
    previewUrl?: string;
    description?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    image?: string;
    youtubeVideoId?: string; // Add property for YouTube video embedding
  };
}

interface Connection {
  id: string;
  start: string;
  end: string;
  startPoint?: 'top' | 'right' | 'bottom' | 'left';
  endPoint?: 'top' | 'right' | 'bottom' | 'left';
}

interface Point {
  x: number;
  y: number;
  id?: string;
}

interface AlignmentGuide {
  position: number;
  type: 'vertical' | 'horizontal';
}

interface SnapToGridArgs {
  transform: {
    x: number;
    y: number;
  };
  active: {
    id: string | number;
  } | null;
  draggingElement: MapElement | undefined;
  elements: MapElement[];
}

interface BookSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  thumbnail?: string;
  highResThumbnail?: string;
  source: 'openlib' | 'google' | 'alphy';
  description?: string;
  _id?: string; // For Alphy books
  publishedYear?: number;
  inDatabase?: boolean;
  flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
  flibustaVariants?: Array<{
    title: string;
    author: string;
    sourceId: string;
    formats: Array<{
      format: string;
      url: string;
    }>;
  }>;
}

const ConnectionPoint = ({ position, elementId, isSelected, onStartConnection, scale }: {
  position: 'top' | 'right' | 'bottom' | 'left';
  elementId: string;
  isSelected: boolean;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  scale: number;
}) => {
  if (!isSelected) return null;

  const getArrowSymbol = (position: string) => {
    switch (position) {
      case 'top': return '↑';
      case 'right': return '↑';
      case 'bottom': return '↑';
      case 'left': return '↑';
      default: return '';
    }
  };

  // Define fixed sizes for connection points
  const pointSize = 24;
  const pointOffset = 24;
  const fontSize = 16;

  // Position styles with fixed values (no scaling)
  const positionStyles = {
    top: { top: `-${pointOffset}px`, left: '50%', transform: 'translateX(-50%)' },
    right: { top: '50%', right: `-${pointOffset}px`, transform: 'translateY(-50%) rotate(90deg)' },
    bottom: { bottom: `-${pointOffset}px`, left: '50%', transform: 'translateX(-50%) rotate(180deg)' },
    left: { top: '50%', left: `-${pointOffset}px`, transform: 'translateY(-50%) rotate(270deg)' },
  };

  return (
    <div
      style={{
        position: 'absolute',
        transform: `scale(${1/scale})`,
        transformOrigin: position === 'top' ? 'center bottom' :
                         position === 'right' ? 'left center' :
                         position === 'bottom' ? 'center top' :
                         'right center',
        zIndex: 100,
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
    <div
      className="connection-point"
      style={{
        ...positionStyles[position],
        position: 'absolute',
          width: `${pointSize}px`,
          height: `${pointSize}px`,
        backgroundColor: '#4A90E2',
        borderRadius: '50%',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
          fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        zIndex: 10,
        pointerEvents: 'all',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onStartConnection(elementId, position, e);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
        });
        onStartConnection(elementId, position, mouseEvent as unknown as React.MouseEvent<Element, MouseEvent>);
      }}
    >
      {getArrowSymbol(position)}
      </div>
    </div>
  );
};


const ElementWithConnections = ({
  element,
  isSelected,
  onSelect,
  onStartConnection,
  onTransformChange,
  onTextChange,
  onDoubleClick,
  scale,
  isAltPressed,
  isDuplicating,
  onToggleCompleted,
}: {
  element: MapElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onTransformChange: (transform: { x: number; y: number } | null) => void;
  onTextChange: (id: string, newText: string) => void;
  onDoubleClick: (element: MapElement) => void;
  scale: number;
  isAltPressed?: boolean;
  isDuplicating?: boolean;
  onToggleCompleted?: (elementId: string) => void;
}) => {
  const [transform, setTransform] = useState<{ x: number; y: number } | null>(null);
  const [isElementResizing, setIsElementResizing] = useState(false);
  
  // Add a handler for completed button clicks to ensure event propagation is stopped
  const handleCompletedButtonClick = useCallback((e: React.MouseEvent) => {
    // Ensure the event doesn't propagate to parent elements
    e.preventDefault();
    e.stopPropagation();
    
    // Call the toggle function
    if (onToggleCompleted) {
      console.log(`[DEBUG] Button clicked for element ${element.id} - calling toggleCompleted`);
      onToggleCompleted(element.id);
      
      // No forced save - removed as per user request
    }
    
    // Prevent the parent element from being selected or dragged
    return false;
  }, [element.id, onToggleCompleted]);

  const handleTransformChange = useCallback((newTransform: { x: number; y: number } | null) => {
    if (JSON.stringify(transform) !== JSON.stringify(newTransform)) {
      setTransform(newTransform);
      onTransformChange(newTransform);
    }
  }, [transform, onTransformChange]);

  // Handle resize state change
  const handleResizeStateChange = useCallback((isResizing: boolean) => {
    setIsElementResizing(isResizing);
  }, []);
  
  // Use default sizes if width and height are not provided
  const defaultWidth = element.type === 'book' ? 140 : 
    element.type === 'image' ? 200 :
    element.type === 'link' ? 240 :
    (element.orientation === 'horizontal' ? 160 : 140);
  const defaultHeight = element.type === 'book' ? 220 : 
    element.type === 'image' ? 150 :
    element.type === 'link' ? 160 :
    (element.orientation === 'horizontal' ? 128 : 200);

  // Get actual width and height from element or use defaults
  const elementWidth = element.width || defaultWidth;
  const elementHeight = element.height || defaultHeight;
  const crossOffset = element.type === 'book' ? 36 : 24;

  const positions = useMemo(() => {
    // For book elements, we need to calculate the actual bottom position
    if (element.type === 'book') {
      return {
        top: { 
          left: element.left + elementWidth / 2 + (transform?.x ? transform.x / scale : 0), 
          top: element.top + (transform?.y ? transform.y / scale : 0)
        },
        right: { 
          left: element.left + elementWidth + (transform?.x ? transform.x / scale : 0), 
          top: element.top + elementHeight / 2 + (transform?.y ? transform.y / scale : 0)
        },
        bottom: { 
          left: element.left + elementWidth / 2 + (transform?.x ? transform.x / scale : 0), 
          top: element.top + elementHeight + (transform?.y ? transform.y / scale : 0)
        },
        left: { 
          left: element.left + (transform?.x ? transform.x / scale : 0), 
          top: element.top + elementHeight / 2 + (transform?.y ? transform.y / scale : 0)
        },
      };
    }

    // For non-book elements
    return {
      top: { 
        left: element.left + elementWidth / 2 + (transform?.x ? transform.x / scale : 0), 
        top: element.top - crossOffset / scale + (transform?.y ? transform.y / scale : 0)
      },
      right: { 
        left: element.left + elementWidth + crossOffset / scale + (transform?.x ? transform.x / scale : 0), 
        top: element.top + elementHeight / 2 + (transform?.y ? transform.y / scale : 0)
      },
      bottom: { 
        left: element.left + elementWidth / 2 + (transform?.x ? transform.x / scale : 0), 
        top: element.top + elementHeight + crossOffset / scale + (transform?.y ? transform.y / scale : 0)
      },
      left: { 
        left: element.left - crossOffset / scale + (transform?.x ? transform.x / scale : 0), 
        top: element.top + elementHeight / 2 + (transform?.y ? transform.y / scale : 0)
      },
    };
  }, [element.left, element.top, transform, element.type, elementHeight, elementWidth, crossOffset, scale]);

  // Special handler for link elements to handle double-click
  const handleLinkDoubleClick = useCallback(() => {
    if (element.type === 'link' && element.linkData?.url) {
      window.open(element.linkData.url, '_blank');
    }
    onDoubleClick(element);
  }, [element, onDoubleClick]);

  // Check if the element has media to display
  const hasMedia = (element.type === 'image' && element.imageData) || 
                  (element.type === 'link' && element.linkData && (element.linkData.previewUrl || element.linkData.image || element.linkData.youtubeVideoId));

  return (
    <>
      <DraggableElement
        id={element.id}
        left={element.left}
        top={element.top}
        text={element.text}
        orientation={element.orientation}
        isSelected={isSelected}
        onSelect={onSelect}
        onStartConnection={onStartConnection}
        onTransformChange={handleTransformChange}
        onTextChange={onTextChange}
        onDoubleClick={element.type === 'link' ? handleLinkDoubleClick : () => onDoubleClick(element)}
        element={element}
        scale={scale}
        onResizeStateChange={handleResizeStateChange}
        isAltPressed={isAltPressed}
        isDuplicating={isDuplicating}
      >
        {element.type === 'book' && element.bookData ? (
          <div className="w-full h-full flex flex-col relative">
            {/* Completed button - appears when selected or already completed */}
            {(isSelected || element.bookData.completed) && (
              <div 
                className="book-completed-badge cursor-pointer"
                onPointerDown={(e) => {
                  // Stop propagation at the earliest possible event
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  // Prevent the parent element from receiving mouse events
                  e.stopPropagation();
                  e.preventDefault();
                  
                  // Call the handler directly which contains all the logic we need
                  handleCompletedButtonClick(e);
                }}
              >
                <div 
                  className={`flex items-center justify-center text-xs font-semibold py-1 px-2 
                    ${element.bookData.completed ? 'active' : ''}`}
                >
                  Completed
                </div>
              </div>
            )}
            
            {/* Cover segment */}
            <div className="w-full" style={{ height: '140px' }}>
              {element.bookData.thumbnail ? (
                <img 
                  src={element.bookData.thumbnail} 
                  alt={element.bookData.title}
                  className="w-full h-full object-contain"
                  style={{ borderRadius: 0 }}
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No cover</span>
                </div>
              )}
            </div>
            {/* Title segment - floating outside main width */}
            <div className="absolute left-1/2 transform -translate-x-1/2" style={{ width: 'max-content', maxWidth: '180px', top: '150px' }}>
              <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 break-words text-center whitespace-normal">
                  {element.bookData.title}
                </div>
              </div>
              {/* Author segment - directly under title */}
              <div className="flex justify-center">
                <div className="author-segment bg-white px-3 py-1 border border-gray-200 shadow-sm rounded-lg" style={{ maxWidth: '180px', width: 'fit-content' }}>
                  <div className="text-xs text-gray-600 whitespace-nowrap">
                    {Array.isArray(element.bookData.author) 
                      ? element.bookData.author.map(author => {
                          const names = author.split(' ');
                          return names.length > 1 
                            ? `${names[0][0]}. ${names.slice(1).join(' ')}` 
                            : author;
                        }).join(', ')
                      : element.bookData.author}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : element.type === 'image' && element.imageData ? (
          <div 
            className="w-full h-full overflow-hidden flex items-center justify-center bg-white"
          >
            <img 
              src={element.imageData.url} 
              alt={element.imageData.alt || 'Image'} 
              className="w-full h-full"
              style={{ objectFit: 'contain' }}
              onError={(e) => {
                console.error('Image failed to load:', element.imageData?.url);
                e.currentTarget.src = 'https://via.placeholder.com/200x150?text=Image+Error';
              }}
            />
          </div>
        ) : element.type === 'link' && element.linkData ? (
          <div className="w-full h-full flex flex-col overflow-hidden rounded-md relative">
            {/* Media content */}
            {element.linkData.youtubeVideoId ? (
              <div className="w-full h-3/5 bg-gray-100 overflow-hidden">
                <iframe 
                  src={`https://www.youtube.com/embed/${element.linkData.youtubeVideoId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            ) : element.linkData.previewUrl || element.linkData.image ? (
              <div className="w-full h-3/5 bg-gray-100 overflow-hidden">
                <img 
                  src={element.linkData.previewUrl || element.linkData.image} 
                  alt={element.linkData.title || "Link preview"} 
                  className="w-full h-full"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div className="w-full h-2/5 bg-gray-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
            )}

            {/* Text content */}
            <div className="p-2 flex-1 flex flex-col">
              <div className="font-medium text-gray-800 line-clamp-2 text-sm flex items-center">
                <span className="flex-1">{element.linkData.title || element.linkData.displayUrl || 
                  (element.linkData.url ? new URL(element.linkData.url).hostname.replace('www.', '') : "")}</span>
              </div>
              {element.linkData.description && (
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {element.linkData.description}
                </div>
              )}
              <div className="flex items-center mt-auto pt-1 text-xs text-gray-500">
                {element.linkData.favicon && (
                  <img src={element.linkData.favicon} alt="" className="w-4 h-4 mr-1" />
                )}
                <span className="truncate">
                  {element.linkData.displayUrl || 
                    (element.linkData.url ? new URL(element.linkData.url).hostname.replace('www.', '') : "")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span 
            className="text-gray-800 px-2" 
            style={{ fontSize: '16px', pointerEvents: 'none' }}
          >
            <ReactMarkdown components={{
              p: ({ children }) => <span style={{ pointerEvents: 'none' }}>{children}</span>,
              strong: ({ children }) => <strong style={{ pointerEvents: 'none' }}>{children}</strong>,
              em: ({ children }) => <em style={{ pointerEvents: 'none' }}>{children}</em>
            }}>
              {element.text}
            </ReactMarkdown>
          </span>
        )}
      </DraggableElement>
      {isSelected && !isElementResizing && (
        <>
          {Object.entries(positions).map(([position, coords]) => (
            <ScaledConnectionPoint
              key={position}
              position={position as 'top' | 'right' | 'bottom' | 'left'}
              elementId={element.id}
              isSelected={isSelected}
              onStartConnection={onStartConnection}
              scale={scale}
              left={coords.left}
              top={coords.top}
            />
          ))}
        </>
      )}
    </>
  );
};

const TempConnection = ({ start, startPoint, end, scale }: { 
  start: string; 
  startPoint: 'top' | 'right' | 'bottom' | 'left';
  end: { x: number; y: number; }; 
  scale: number;
}) => {
  // Create a unique ID for the end point
  const endId = useMemo(() => `temp-end-${Math.random().toString(36).substr(2, 9)}`, []);
  const [startRef, setStartRef] = useState(start);
  
  useEffect(() => {
    // For book elements, we'll use the element ID directly for all connection points
    // to ensure consistent behavior at all scales
      setStartRef(start);
  }, [start, startPoint]);

  // Create a div at the mouse position
  return (
    <>
      <div
        id={endId}
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
      <ScaledXarrow
        start={startRef}
        end={endId}
        startAnchor={startPoint}
        endAnchor="middle"
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

const snapToGrid = (args: SnapToGridArgs) => {
  const { transform, active, draggingElement, elements } = args;
  if (!active || !draggingElement) return transform;

  const activeElement = elements.find(el => el.id === active.id);
  if (!activeElement) return transform;

  // Get dimensions based on element properties
  const defaultWidth = activeElement.type === 'book' ? 140 : 
    (activeElement.orientation === 'horizontal' ? 160 : 140);
  const defaultHeight = activeElement.type === 'book' ? 220 : 
    (activeElement.orientation === 'horizontal' ? 128 : 200);
  
  // Use custom dimensions if available
  const elementWidth = activeElement.width || defaultWidth;
  const elementHeight = activeElement.height || defaultHeight;

  const SNAP_THRESHOLD = 10;

  // Calculate the actual current position including transform
  const currentLeft = activeElement.left + transform.x;
  const currentTop = activeElement.top + transform.y;
  
  let bestSnapX = transform.x;
  let bestSnapY = transform.y;
  let minDistanceX = SNAP_THRESHOLD;
  let minDistanceY = SNAP_THRESHOLD;

  elements.forEach(element => {
    if (element.id === active.id) return;

    // Get dimensions for target element
    const targetDefaultWidth = element.type === 'book' ? 140 : 
      (element.orientation === 'horizontal' ? 160 : 140);
    const targetDefaultHeight = element.type === 'book' ? 220 : 
      (element.orientation === 'horizontal' ? 128 : 200);
    
    const targetWidth = element.width || targetDefaultWidth;
    const targetHeight = element.height || targetDefaultHeight;

    // Center alignment
    const activeCenter = currentLeft + elementWidth / 2;
    const targetCenter = element.left + targetWidth / 2;
    const centerDiff = Math.abs(activeCenter - targetCenter);
    
    if (centerDiff < minDistanceX) {
      minDistanceX = centerDiff;
      bestSnapX = targetCenter - (activeElement.left + elementWidth / 2);
    }

    // Left edge alignment
    const leftDiff = Math.abs(currentLeft - element.left);
    if (leftDiff < minDistanceX) {
      minDistanceX = leftDiff;
      bestSnapX = element.left - activeElement.left;
    }

    // Right edge alignment
    const rightDiff = Math.abs(currentLeft + elementWidth - (element.left + targetWidth));
    if (rightDiff < minDistanceX) {
      minDistanceX = rightDiff;
      bestSnapX = (element.left + targetWidth) - (activeElement.left + elementWidth);
    }

    // Vertical center alignment
    const activeCenterY = currentTop + elementHeight / 2;
    const targetCenterY = element.top + targetHeight / 2;
    const centerDiffY = Math.abs(activeCenterY - targetCenterY);
    
    if (centerDiffY < minDistanceY) {
      minDistanceY = centerDiffY;
      bestSnapY = targetCenterY - (activeElement.top + elementHeight / 2);
    }

    // Top edge alignment
    const topDiff = Math.abs(currentTop - element.top);
    if (topDiff < minDistanceY) {
      minDistanceY = topDiff;
      bestSnapY = element.top - activeElement.top;
    }

    // Bottom edge alignment
    const bottomDiff = Math.abs(currentTop + elementHeight - (element.top + targetHeight));
    if (bottomDiff < minDistanceY) {
      minDistanceY = bottomDiff;
      bestSnapY = (element.top + targetHeight) - (activeElement.top + elementHeight);
    }
  });

  return {
    x: minDistanceX < SNAP_THRESHOLD ? bestSnapX : transform.x,
    y: minDistanceY < SNAP_THRESHOLD ? bestSnapY : transform.y
  };
};



const Line = ({ 
  element,
  isSelected,
  onSelect,
  setElements,
  containerRef,
  scale,
}: { 
  element: MapElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
  containerRef: React.RefObject<HTMLDivElement>;
  scale: number;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialPosition, setInitialPosition] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  // Track Alt key state for duplication
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  // Listen for Alt key press/release for duplication functionality
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

  if (!element.lineData) return null;

  const { startX, startY, endX, endY } = element.lineData;

  // Function to calculate angle between two points
  const calculateAngle = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  };

  // Function to snap angle to nearest common angle
  const snapAngle = (angle: number) => {
    const commonAngles = [0, 45, 90, 135, 180, -135, -90, -45];
    const SNAP_THRESHOLD = 10; // Degrees

    // Find the closest common angle
    let closestAngle = commonAngles[0];
    let minDiff = Math.abs(angle - commonAngles[0]);

    for (const commonAngle of commonAngles) {
      const diff = Math.abs(angle - commonAngle);
      if (diff < minDiff) {
        minDiff = diff;
        closestAngle = commonAngle;
      }
    }

    // Only snap if we're within the threshold
    return minDiff <= SNAP_THRESHOLD ? closestAngle : angle;
  };

  // Function to calculate new endpoint based on angle and distance
  const calculateEndpoint = (startX: number, startY: number, angle: number, distance: number) => {
    const angleRad = angle * Math.PI / 180;
    return {
      x: startX + distance * Math.cos(angleRad),
      y: startY + distance * Math.sin(angleRad)
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent default text selection
    
    // Select the element
    onSelect(element.id);
    
    // Start dragging immediately without requiring a second click
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition({ startX, startY, endX, endY });
  };

  const handleMouseMove = (e: MouseEvent) => {
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
      }
    };

    setElements((prev: MapElement[]) => prev.map((el: MapElement) => el.id === element.id ? updatedElement : el));
  };

  const handleLineHandleMove = (e: MouseEvent, handle: 'start' | 'end') => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Adjust mouse coordinates for scale
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // Calculate the angle and distance from the fixed point to the mouse position
    const [fixedX, fixedY] = handle === 'start' ? [endX, endY] : [startX, startY];
    let angle = calculateAngle(fixedX, fixedY, x, y);
    const distance = Math.sqrt(Math.pow(x - fixedX, 2) + Math.pow(y - fixedY, 2));

    // Snap the angle if it's close to a common angle
    const snappedAngle = snapAngle(angle);

    // Calculate the new point position based on the snapped angle
    const newPoint = calculateEndpoint(fixedX, fixedY, snappedAngle, distance);

    setElements(prev => prev.map(el => {
      if (el.id === element.id && el.lineData) {
        return {
          ...el,
          lineData: {
            ...el.lineData,
            ...(handle === 'start' 
              ? { startX: newPoint.x, startY: newPoint.y }
              : { endX: newPoint.x, endY: newPoint.y }
            )
          }
        };
      }
      return el;
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setInitialPosition(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, initialPosition]);

  // Update the line handle mouse down handler
  useEffect(() => {
    const handleLineHandleMouseDown = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      if (!target.classList.contains('line-handle')) return;

      const elementId = target.getAttribute('data-element-id');
      const handle = target.getAttribute('data-handle');

      if (!elementId || !handle || elementId !== element.id) return;

      e.stopPropagation();
      e.preventDefault(); // Prevent default text selection when dragging handles
      
      const handleMouseMove = (e: MouseEvent) => handleLineHandleMove(e, handle as 'start' | 'end');
      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleLineHandleMouseDown);
    return () => document.removeEventListener('mousedown', handleLineHandleMouseDown);
  }, [element.id, startX, startY, endX, endY]);

  return (
    <g>
      {/* Invisible wider line for better hit detection */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="transparent"
        strokeWidth="20"
        style={{ cursor: isSelected ? 'move' : 'pointer' }}
        onMouseDown={handleMouseDown}
      />
      {/* Visible line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={isSelected ? '#3B82F6' : '#8B8B8B'}
        strokeWidth={isSelected ? "2" : "1.5"}
        style={{ pointerEvents: 'none' }}
      />
      {isSelected && (
        <>
          {/* Start point handle */}
          <circle
            cx={startX}
            cy={startY}
            r={8}
            fill="#3B82F6"
            className="line-handle start-handle"
            data-element-id={element.id}
            data-handle="start"
          />
          {/* End point handle */}
          <circle
            cx={endX}
            cy={endY}
            r={8}
            fill="#3B82F6"
            className="line-handle end-handle"
            data-element-id={element.id}
            data-handle="end"
          />
        </>
      )}
    </g>
  );
};

// Add this component before the TempConnection component
const ScaledXarrow = ({ 
  start, 
  end, 
  startAnchor, 
  endAnchor, 
  color, 
  strokeWidth, 
  path, 
  headSize, 
  curveness, 
  scale 
}: { 
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
}) => {
  // Create a container that counteracts the parent scaling
  const containerId = useMemo(() => `arrow-container-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Adjust anchors for book elements to ensure consistent behavior
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
  
  // Increase the base headSize from 6 to 9
  const enhancedHeadSize = 9;
  
  return (
    <div 
      id={containerId}
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        transform: `scale(${1/scale})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        zIndex: 5 // Lower z-index to position arrows behind elements
      }}
    >
      <Xarrow
        start={start}
        end={end}
        startAnchor={adjustedStartAnchor}
        endAnchor={adjustedEndAnchor}
        color={color}
        strokeWidth={strokeWidth * scale} // Adjust stroke width to account for inverse scaling
        path={path}
        headSize={enhancedHeadSize * scale} // Use the enhanced head size and adjust for scaling
        curveness={curveness}
        zIndex={5} // Ensure consistency with container z-index
      />
    </div>
  );
};

// Add this component after the ConnectionPoint component
const ScaledConnectionPoint = ({ 
  position, 
  elementId, 
  isSelected, 
  onStartConnection, 
  scale,
  left,
  top
}: {
  position: 'top' | 'right' | 'bottom' | 'left';
  elementId: string;
  isSelected: boolean;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  scale: number;
  left: number;
  top: number;
}) => {
  if (!isSelected) return null;

  // Updated to use the same arrow (↑) for all directions
  const getArrowSymbol = () => '↑';

  // Define fixed sizes for connection points
  const pointSize = 24;
  const fontSize = 16;

  // Create rotation based on direction
  const getRotation = (position: string) => {
    switch (position) {
      case 'top': return 'rotate(0deg)';
      case 'right': return 'rotate(90deg)';
      case 'bottom': return 'rotate(180deg)';
      case 'left': return 'rotate(270deg)';
      default: return 'rotate(0deg)';
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: '0',
        height: '0',
        zIndex: 100,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          transform: `scale(${1/scale})`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: `${pointSize}px`,
            height: `${pointSize}px`,
            backgroundColor: '#4A90E2',
            borderRadius: '50%',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            transform: `translate(-50%, -50%) ${getRotation(position)}`,
            pointerEvents: 'all',
            transition: 'transform 0.2s, background-color 0.2s',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault(); // Prevent default text selection
            onStartConnection(elementId, position, e);
          }}
          onMouseOver={(e) => {
            // Keep the rotation when hovering
            (e.target as HTMLDivElement).style.transform = `translate(-50%, -50%) scale(1.2) ${getRotation(position)}`;
            (e.target as HTMLDivElement).style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            // Keep the rotation when ending hover
            (e.target as HTMLDivElement).style.transform = `translate(-50%, -50%) ${getRotation(position)}`;
            (e.target as HTMLDivElement).style.backgroundColor = '#4A90E2';
          }}
        >
          {getArrowSymbol()}
        </div>
      </div>
    </div>
  );
};

// Add LinkModal component
const LinkModal = ({ onClose, onLinkSubmit }: { 
  onClose: () => void; 
  onLinkSubmit: (linkData: { url: string; title?: string; description?: string; image?: string; siteName?: string; favicon?: string; displayUrl?: string; youtubeVideoId?: string; }) => void;
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setIsLoading(true);
    try {
      // Validate URL format
      let processedUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        processedUrl = 'https://' + url;
      }
      
      // Try to fetch link preview
      const apiKey = '657ab82fe7584749efe812a3b259d48d'; // Link Preview API key
      const apiUrl = `https://api.linkpreview.net/?key=${apiKey}&q=${encodeURIComponent(processedUrl)}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      // Format a clean display URL for the bottom of the card
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname.replace('www.', '');
      const firstPathSegment = urlObj.pathname.split('/')[1];
      const displayUrl = firstPathSegment ? `${hostname}/${firstPathSegment}` : hostname;
      
      // Check if it's a YouTube URL and extract video ID
      let youtubeVideoId;
      if (hostname === 'youtube.com' || hostname === 'youtu.be') {
        if (hostname === 'youtube.com') {
          youtubeVideoId = urlObj.searchParams.get('v') || '';
        } else if (hostname === 'youtu.be' && urlObj.pathname.split('/')[1]) {
          youtubeVideoId = urlObj.pathname.split('/')[1];
        }
      }
      
      if (data && !data.error) {
        // Use API data
        onLinkSubmit({
          url: processedUrl,
          title: title || data.title || '',
          description: data.description || '',
          image: data.image || '',
          siteName: data.title || '',
          favicon: data.favicon || '',
          displayUrl: displayUrl,
          youtubeVideoId
        });
      } else {
        // Use basic data
        onLinkSubmit({
          url: processedUrl,
          title: title || '',
          displayUrl: displayUrl,
          youtubeVideoId
        });
      }
      onClose();
    } catch (error) {
      console.error('Error fetching link preview:', error);
      // Create basic displayUrl
      const displayUrl = url.replace(/^https?:\/\/(?:www\.)?/i, '');
      // Use basic data on error
      onLinkSubmit({
        url: url,
        title: title || '',
        displayUrl: displayUrl
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onWheel={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative z-10">
        {/* Removed "Add Link" title */}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2" htmlFor="url">
              URL
            </label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-900"
              placeholder="https://example.com"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2" htmlFor="title">
              Display Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-900"
              placeholder="Custom title for the link"
            />
            <p className="text-xs text-gray-500 mt-1">
              If left empty, we'll attempt to use the page title from the URL
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-400/50 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-gray-400/50 text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
              disabled={isLoading || !url}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Add Link'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function MapsContent() {
  const [elements, setElements] = useState<MapElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectingFrom, setConnectingFrom] = useState<{ 
    elementId: string; 
    point: 'top' | 'right' | 'bottom' | 'left' 
  } | null>(null);
  const [tempConnection, setTempConnection] = useState<Point | null>(null);
  const [elementTransforms, setElementTransforms] = useState<Record<string, { x: number; y: number } | null>>({});
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState<boolean>(false);
  const [bookDetailsModal, setBookDetailsModal] = useState<MapElement | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaResults, setFlibustaResults] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState<{
    elementId: string;
    handle: 'start' | 'end';
  } | null>(null);
  
  // Initialize canvas position to center
  const [scale, setScaleState] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState(() => {
    // Calculate initial center position
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const canvasWidth = 2700; // Canvas width
    const canvasHeight = 2700; // Canvas height
    const initialScale = 1; // Initial scale factor
    
    // Calculate the center position, taking into account the scale
    return {
      x: (viewportWidth - (canvasWidth * initialScale)) / 2,
      y: (viewportHeight - (canvasHeight * initialScale)) / 2
    };
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Add state for tracking last autosave time and autosave UI
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  
  // Add missing refs needed for saveMapToDatabase
  const saving = useRef<boolean>(false);
  const autoSaving = useRef<boolean>(false);
  
  // Add a ref to store the last data for comparison
  const lastDataRef = useRef<string>('');
  
  // Create a ref for the debounce timer
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a ref to track if autosave is in progress
  const autosaveInProgressRef = useRef<boolean>(false);
  
  // Add missing state variables
  const [mapNameError, setMapNameError] = useState<string>('');
  const [showMapNameDialog, setShowMapNameDialog] = useState<boolean>(false);
  
  // Add save map related state
  const [savedMapId, setSavedMapId] = useState<string | null>(null);
  const [mapName, setMapName] = useState('Untitled Map');
  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const hiddenTextRef = useRef<HTMLSpanElement>(null);
  // Change autosave to false by default
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false); // Add state for private/public toggle
  const autosaveRef = useRef<() => void>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const { setNodeRef } = useDroppable({
    id: 'droppable',
  });

  // Add event listener for element resize events
  useEffect(() => {
    const handleElementResize = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, left, top, width, height, resetTransform } = customEvent.detail;

      setElements(prev => 
        prev.map(element => 
          element.id === id ? 
            { ...element, left, top, width, height } : 
            element
        )
      );

      // Reset the transform for this element if needed
      if (resetTransform) {
        setElementTransforms(prev => ({
          ...prev,
          [id]: null
        }));
      }
    };

    // Handle resize-in-progress for live updates of connections
    const handleResizeProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, left, top, width, height } = customEvent.detail;
      
      // Update element dimensions in real-time
      setElements(prev => 
        prev.map(element => 
          element.id === id ? 
            { ...element, left, top, width, height } : 
            element
        )
      );
    };

    // Listen for both the final resize event and progress updates
    document.addEventListener('element-resized', handleElementResize);
    document.addEventListener('element-resize-progress', handleResizeProgress);

    return () => {
      document.removeEventListener('element-resized', handleElementResize);
      document.removeEventListener('element-resize-progress', handleResizeProgress);
    };
  }, []);

  const calculateAlignmentGuides = useCallback((activeId: string, x: number, y: number) => {
    const THRESHOLD = 5; // Pixels threshold for alignment
    const guides: AlignmentGuide[] = [];
    const activeElement = elements.find(el => el.id === activeId);
    if (!activeElement) return guides;

    // Get dimensions for active element
    const defaultActiveWidth = activeElement.type === 'book' ? 140 : 
      (activeElement.orientation === 'horizontal' ? 160 : 140);
    const defaultActiveHeight = activeElement.type === 'book' ? 220 : 
      (activeElement.orientation === 'horizontal' ? 128 : 200);
    
    const activeWidth = activeElement.width || defaultActiveWidth;
    const activeHeight = activeElement.height || defaultActiveHeight;

    // Calculate center and edges
    const activeCenter = x + activeWidth / 2;
    const activeRight = x + activeWidth;
    const activeBottom = y + activeHeight;

    elements.forEach(element => {
      if (element.id === activeId) return;

      // Get dimensions for target element
      const defaultWidth = element.type === 'book' ? 140 : 
        (element.orientation === 'horizontal' ? 160 : 140);
      const defaultHeight = element.type === 'book' ? 220 : 
        (element.orientation === 'horizontal' ? 128 : 200);
      
      const elementWidth = element.width || defaultWidth;
      const elementHeight = element.height || defaultHeight;

      // Calculate center and edges for target
      const elementCenter = element.left + elementWidth / 2;
      const elementRight = element.left + elementWidth;
      const elementBottom = element.top + elementHeight;

      // Center-to-center alignment (horizontal)
      if (Math.abs(activeCenter - elementCenter) < THRESHOLD) {
        guides.push({ position: elementCenter - activeWidth / 2, type: 'vertical' });
      }

      // Left edge alignment
      if (Math.abs(x - element.left) < THRESHOLD) {
        guides.push({ position: element.left, type: 'vertical' });
      }

      // Right edge to left edge alignment
      if (Math.abs(activeRight - element.left) < THRESHOLD) {
        guides.push({ position: element.left - activeWidth, type: 'vertical' });
      }

      // Left edge to right edge alignment
      if (Math.abs(x - elementRight) < THRESHOLD) {
        guides.push({ position: elementRight, type: 'vertical' });
      }

      // Right edge to right edge alignment
      if (Math.abs(activeRight - elementRight) < THRESHOLD) {
        guides.push({ position: elementRight - activeWidth, type: 'vertical' });
      }

      // Edge to center alignment (horizontal)
      if (Math.abs(activeRight - elementCenter) < THRESHOLD) {
        guides.push({ position: elementCenter - activeWidth, type: 'vertical' });
      }

      if (Math.abs(x - elementCenter) < THRESHOLD) {
        guides.push({ position: elementCenter, type: 'vertical' });
      }

      // Center-to-center alignment (vertical)
      if (Math.abs((y + activeHeight / 2) - (element.top + elementHeight / 2)) < THRESHOLD) {
        guides.push({ position: element.top + elementHeight / 2 - activeHeight / 2, type: 'horizontal' });
      }

      // Top edge alignment
      if (Math.abs(y - element.top) < THRESHOLD) {
        guides.push({ position: element.top, type: 'horizontal' });
      }

      // Bottom edge to top edge alignment
      if (Math.abs(activeBottom - element.top) < THRESHOLD) {
        guides.push({ position: element.top - activeHeight, type: 'horizontal' });
      }

      // Top edge to bottom edge alignment
      if (Math.abs(y - elementBottom) < THRESHOLD) {
        guides.push({ position: elementBottom, type: 'horizontal' });
      }

      // Bottom edge to bottom edge alignment
      if (Math.abs(activeBottom - elementBottom) < THRESHOLD) {
        guides.push({ position: elementBottom - activeHeight, type: 'horizontal' });
      }

      // Edge to center alignment (vertical)
      if (Math.abs(activeBottom - (element.top + elementHeight / 2)) < THRESHOLD) {
        guides.push({ position: element.top + elementHeight / 2 - activeHeight, type: 'horizontal' });
      }

      if (Math.abs(y - (element.top + elementHeight / 2)) < THRESHOLD) {
        guides.push({ position: element.top + elementHeight / 2, type: 'horizontal' });
      }
    });

    // Remove duplicate guides
    return guides.filter((guide, index, self) =>
      index === self.findIndex((g) => g.position === guide.position && g.type === guide.type)
    );
  }, [elements]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
    setAlignmentGuides([]);
    
    // Check if Alt key is pressed to enable duplication mode
    setIsDuplicating(isAltKeyPressed);
  }, [isAltKeyPressed]);

  const moveElement = useCallback((id: string, left: number, top: number) => {
    setElements(prev => 
      prev.map(element => 
        element.id === id ? { ...element, left, top } : element
      )
    );
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active } = event;
    if (!active || !containerRef.current) return;

    const elementId = String(active.id);
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Calculate new position for guides
    const newLeft = element.left + (event.delta.x / scale);
    const newTop = element.top + (event.delta.y / scale);

    // Calculate and show guides
    const guides = calculateAlignmentGuides(elementId, newLeft, newTop);
    setAlignmentGuides(guides);
  }, [elements, calculateAlignmentGuides, scale]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    if (!active || !delta || !containerRef.current) return;

    const elementId = String(active.id);
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Get dimensions for the element
    const defaultWidth = element.type === 'book' ? 140 : 
      (element.orientation === 'horizontal' ? 160 : 140);
    const defaultHeight = element.type === 'book' ? 220 : 
      (element.orientation === 'horizontal' ? 128 : 200);
    
    const elementWidth = element.width || defaultWidth;
    const elementHeight = element.height || defaultHeight;
    const MAGNETIC_THRESHOLD = 10;

    // Calculate new position
    let newLeft = element.left + (delta.x / scale);
    let newTop = element.top + (delta.y / scale);

    // Get guides for snapping
    const guides = calculateAlignmentGuides(elementId, newLeft, newTop);

    // Find the closest guides
    let closestVerticalGuide = null;
    let closestHorizontalGuide = null;
    let minVerticalDist = MAGNETIC_THRESHOLD;
    let minHorizontalDist = MAGNETIC_THRESHOLD;

    guides.forEach(guide => {
      if (guide.type === 'vertical') {
        const dist = Math.abs(newLeft - guide.position);
        if (dist < minVerticalDist) {
          minVerticalDist = dist;
          closestVerticalGuide = guide;
        }
      } else {
        const dist = Math.abs(newTop - guide.position);
        if (dist < minHorizontalDist) {
          minHorizontalDist = dist;
          closestHorizontalGuide = guide;
        }
      }
    });

    // Apply snapping
    if (closestVerticalGuide) {
      newLeft = (closestVerticalGuide as AlignmentGuide).position;
    }
    if (closestHorizontalGuide) {
      newTop = (closestHorizontalGuide as AlignmentGuide).position;
    }

    // Ensure element stays within canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700
    newLeft = Math.max(0, Math.min(newLeft, canvasWidth - elementWidth));
    newTop = Math.max(0, Math.min(newTop, canvasHeight - elementHeight));

    // If in duplication mode, create a duplicate element at the drop position
    if (isDuplicating) {
      // Create a duplicate of the element at the new position
      const duplicate: MapElement = {
        ...element,
        id: `element-${Date.now()}`,
        left: newLeft,
        top: newTop
      };
      
      // Add the duplicate to elements
      setElements(prev => [...prev, duplicate]);
      
      // Select the new element
      setSelectedElement(duplicate.id);
    } else {
      // Standard drag - just move the original element
      moveElement(elementId, newLeft, newTop);
    }

    // Reset drag states
    setIsDragging(false);
    setIsDuplicating(false);
    setAlignmentGuides([]);
    
    // Let the CSS class handle the cursor based on isPanning state
    if (containerRef.current) {
      containerRef.current.className = containerRef.current.className.replace('cursor-copy', '');
      containerRef.current.className = `map-container with-grid absolute ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`;
    }
  }, [elements, calculateAlignmentGuides, scale, moveElement, isDuplicating, isPanning]);

  // Add a helper function to calculate the viewport center in canvas coordinates
  const getViewportCenterInCanvas = useCallback(() => {
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 60; // Subtract toolbar height
    
    // Calculate viewport center in screen coordinates
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    
    // Convert to canvas coordinates
    const canvasCenterX = (viewportCenterX - canvasPosition.x) / scale;
    const canvasCenterY = (viewportCenterY - canvasPosition.y) / scale;
    
    // Canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700
    
    return {
      x: Math.max(0, Math.min(canvasCenterX, canvasWidth)),
      y: Math.max(0, Math.min(canvasCenterY, canvasHeight))
    };
  }, [canvasPosition.x, canvasPosition.y, scale]);

  const handleAddElement = useCallback((orientation: 'horizontal' | 'vertical' = 'horizontal') => {
    if (!containerRef.current) return;

    const elementWidth = orientation === 'horizontal' ? 160 : 140;
    const elementHeight = orientation === 'horizontal' ? 128 : 200;

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Calculate the position so element is centered on the viewport center
    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    // Canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'element',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: 'double click to edit',
      orientation,
    };

    setElements(prev => [...prev, newElement]);
  }, [elements.length, getViewportCenterInCanvas]);

  useEffect(() => {
    if (containerRef.current) {
      setNodeRef(containerRef.current);
    }
  }, [setNodeRef]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (connectingFrom && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate the mouse position in the canvas coordinate system
        // This accounts for both the canvas position and the scale
        const canvasX = (e.clientX - rect.left) / scale;
        const canvasY = (e.clientY - rect.top) / scale;
        
        // Update the temporary connection position
        setTempConnection({
          x: canvasX,
          y: canvasY,
        });

        // Check if we're over any element
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const targetElement = elements.find(el => el.classList.contains('map-element'));
        
        if (targetElement && targetElement.id !== connectingFrom.elementId) {
          // Determine which side of the element we're closest to
          const targetRect = targetElement.getBoundingClientRect();
          
          // Calculate distances to each side in the canvas coordinate system
          const targetLeft = (targetRect.left - rect.left) / scale;
          const targetRight = (targetRect.right - rect.left) / scale;
          const targetTop = (targetRect.top - rect.top) / scale;
          const targetBottom = (targetRect.bottom - rect.top) / scale;

          const distances = {
            left: Math.abs(canvasX - targetLeft),
            right: Math.abs(canvasX - targetRight),
            top: Math.abs(canvasY - targetTop),
            bottom: Math.abs(canvasY - targetBottom)
          };

          // Find the closest side
          const closestSide = Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0] as 'top' | 'right' | 'bottom' | 'left';

          // Create the connection
          const newConnection: Connection = {
            id: `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            start: connectingFrom.elementId,
            end: targetElement.id,
            startPoint: connectingFrom.point,
            endPoint: closestSide,
          };
          setConnections(prev => [...prev, newConnection]);
          setConnectingFrom(null);
          setTempConnection(null);
        }
      }
    };

    const handleMouseUp = () => {
      setConnectingFrom(null);
      setTempConnection(null);
    };

    if (connectingFrom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [connectingFrom, scale]);

  const handleStartConnection = (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setConnectingFrom({ elementId, point });
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      // Calculate the initial position in the canvas coordinate system
      const canvasX = (e.clientX - rect.left) / scale;
      const canvasY = (e.clientY - rect.top) / scale;
      
      // Set the initial position of the temporary connection
      setTempConnection({
        x: canvasX,
        y: canvasY,
      });
      
      // Add touch event handlers for dragging connections on mobile
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (rect && e.touches.length === 1) {
          const canvasX = (e.touches[0].clientX - rect.left) / scale;
          const canvasY = (e.touches[0].clientY - rect.top) / scale;
          setTempConnection({ x: canvasX, y: canvasY });
        }
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        
        // Find the element being dropped onto
        const target = document.elementFromPoint(
          e.changedTouches[0].clientX, 
          e.changedTouches[0].clientY
        );
        
        if (target) {
          const targetId = target.id || target.closest('[id]')?.id;
          if (targetId && targetId !== elementId) {
            // Create the connection
            const newConnection: Connection = {
              id: uuidv4(),
              start: elementId,
              end: targetId,
              startPoint: point,
              endPoint: getOppositePoint(point)
            };
            setConnections(prev => [...prev, newConnection]);
          }
        }
        
        setConnectingFrom(null);
        setTempConnection(null);
      };
      
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }
  };
  
  // Helper function to determine the opposite point
  const getOppositePoint = (point: 'top' | 'right' | 'bottom' | 'left'): 'top' | 'right' | 'bottom' | 'left' => {
    switch (point) {
      case 'top': return 'bottom';
      case 'right': return 'left';
      case 'bottom': return 'top';
      case 'left': return 'right';
    }
  };

  const handleElementClick = (elementId: string) => {
    setSelectedElement(elementId);
  };

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedElement(null);
    }
  }, []);

  const handleDeleteElement = () => {
    if (!selectedElement) return;
    setElements(prev => prev.filter(el => el.id !== selectedElement));
    setConnections(prev => prev.filter(conn => conn.start !== selectedElement && conn.end !== selectedElement));
    setSelectedElement(null);
  };

  const handleClearConnections = () => {
    if (!selectedElement) return;
    setConnections(prev => prev.filter(conn => conn.start !== selectedElement && conn.end !== selectedElement));
  };

  // Optimize temporary connection rendering
  const TempConnectionMemo = useMemo(() => {
    if (!connectingFrom || !tempConnection) return null;
    
    return (
      <TempConnection
        start={connectingFrom.elementId}
        startPoint={connectingFrom.point}
        end={tempConnection}
        scale={scale}
      />
    );
  }, [connectingFrom, tempConnection, scale]);

  // Update the restrictToParentElement modifier
  const modifiers = useMemo(() => {
    // Updated type of modifier
    const customRestrictToParent = ({
      transform,
      active,
      ...rest
    }: {
      transform: { x: number; y: number };
      active: { id: string | number } | null;
      [key: string]: any;
    }) => {
      if (!active) return transform;

      const elementId = String(active.id);
      const element = elements.find(el => el.id === elementId);
      if (!element) return transform;

      // Get dimensions based on element properties
      const defaultWidth = element.type === 'book' ? 140 : 
        (element.orientation === 'horizontal' ? 160 : 140);
      const defaultHeight = element.type === 'book' ? 220 : 
        (element.orientation === 'horizontal' ? 128 : 200);
      
      // Use custom dimensions if available
      const elementWidth = element.width || defaultWidth;
      const elementHeight = element.height || defaultHeight;

      // Get the container dimensions
      const canvasWidth = 2700; // Increased from 1800 to 2700
      const canvasHeight = 2700; // Increased from 1800 to 2700

      // Calculate maximum allowed positions
      const maxX = canvasWidth - elementWidth - element.left;
      const maxY = canvasHeight - elementHeight - element.top;

      // Restrict movement within bounds
      return {
        x: Math.max(-element.left, Math.min(transform.x, maxX)),
        y: Math.max(-element.top, Math.min(transform.y, maxY))
      };
    };

    return [
      customRestrictToParent,
      ((args: any) => snapToGrid({ ...args, elements, draggingElement: elements.find(el => el.id === args.active?.id) })) as any
    ];
  }, [elements, scale]);

  const handleTextChange = useCallback((elementId: string, newText: string) => {
    setElements(prev => prev.map(element => 
      element.id === elementId ? { ...element, text: newText } : element
    ));
  }, []);

  const handleBookSubmit = (bookData: BookSearchResult) => {
    if (!containerRef.current) return;

    const elementWidth = 140; // Book element width
    const elementHeight = 220; // Book element height

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Calculate the position so element is centered on the viewport center
    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    // Canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'book',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth, // Set fixed width for book elements
      height: elementHeight, // Set fixed height for book elements
      text: bookData.title,
      orientation: 'vertical',
      bookData: {
        key: bookData.key,
        _id: bookData._id, // Add the _id from the saved book
        title: bookData.title,
        author: bookData.author_name || [],
        thumbnail: bookData.thumbnail,
        highResThumbnail: bookData.highResThumbnail,
        description: bookData.description,
        source: bookData.source,
        flibustaStatus: bookData.flibustaStatus,
        flibustaVariants: bookData.flibustaVariants,
        completed: false, // Set initial completed status to false
      }
    };

    setElements(prev => [...prev, newElement]);
  };

  const handleElementDoubleClick = (element: MapElement) => {
    if (element.type === 'book') {
      setBookDetailsModal(element);
    } else if (element.type === 'image' && element.imageData) {
      setFullscreenImage({
        url: element.imageData.url,
        alt: element.imageData.alt || 'Image'
      });
    } else if (element.type === 'link' && element.linkData) {
      // For link elements, maybe open the URL in a new tab?
      window.open(element.linkData.url, '_blank');
    } else {
      // For regular text elements
      setTextEditModal({
        id: element.id,
        text: element.text
      });
    }
  };

  const handleSaveText = () => {
    if (!textEditModal) return;
    
    setElements(prev => prev.map(element => 
      element.id === textEditModal.id 
        ? { ...element, text: textEditModal.text }
        : element
    ));
    setTextEditModal(null);
  };

  // Add a new function to get connection references
  const getConnectionRef = (elementId: string, point: 'top' | 'right' | 'bottom' | 'left') => {
    // For book elements with bottom connection, use the author-bottom reference
    const element = document.getElementById(elementId);
    if (element && element.getAttribute('data-type') === 'book' && point === 'bottom') {
      // Create a consistent reference point for the bottom of book elements
      // that doesn't depend on the author element's position
      return elementId;
    }
    return elementId;
  };

  const handleRequestDownloadLinks = async () => {
    if (!bookDetailsModal || !bookDetailsModal.bookData) return;
    
    console.log('Book details modal data:', bookDetailsModal.bookData);
    console.log('Book ID:', bookDetailsModal.bookData._id);
    console.log('Book key:', bookDetailsModal.bookData.key);
    
    setIsFlibustaSearching(true);
    setFlibustaError(null);
    setShowFlibustaResults(true);

    try {
      const response = await axios.get(`/api/books/flibusta/search?query=${encodeURIComponent(bookDetailsModal.bookData.title)}`);
      const data = response.data;

      if (!data) {
        throw new Error('Failed to search on Flibusta');
      }

      setFlibustaResults(data.data || []);
    } catch (err) {
      setFlibustaError(err instanceof Error ? err.message : 'Failed to search on Flibusta');
    } finally {
      setIsFlibustaSearching(false);
    }
  };

  const handleVariantSelect = (variant: any) => {
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map((format: any) => ({
        format: format.format,
        url: `/api/books/flibusta/download/${variant.id}/${format.format}`
      }))
    };

    setSelectedVariant(originalVariant);
    setShowFlibustaResults(false);
  };

  const handleSaveDownloadLinks = async () => {
    if (!bookDetailsModal || !bookDetailsModal.bookData || !selectedVariant) return;
    
    try {
      // Try to get the book ID, or fetch it if not available
      let bookId = bookDetailsModal.bookData._id;
      
      // If _id is not available, try to fetch the book by key
      if (!bookId && bookDetailsModal.bookData.key) {
        console.log('Book ID not found, fetching by key:', bookDetailsModal.bookData.key);
        try {
          // Fetch the book by key to get its _id
          const bookResponse = await axios.get(`/api/books/by-key/${bookDetailsModal.bookData.key}`);
          bookId = bookResponse.data._id;
          
          // Update the element with the fetched _id
          if (bookId) {
            setElements(prev => prev.map(element => {
              if (element.id === bookDetailsModal.id) {
                return {
                  ...element,
                  bookData: {
                    ...element.bookData!,
                    _id: bookId
                  }
                };
              }
              return element;
            }));
          }
        } catch (fetchError) {
          console.error('Error fetching book by key:', fetchError);
        }
      }
      
      if (!bookId) {
        console.error('Book ID is missing and could not be fetched');
        toast.error('Cannot save download links: Book ID is missing');
        return;
      }
      
      console.log('Saving download links for book:', bookId);
      console.log('Selected variant data:', selectedVariant);
      
      // Ensure we have the token for the request
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in to save download links');
        return;
      }
      
      // Update the book in the database using the correct endpoint
      const response = await axios.post(`/api/books/${bookId}/save-flibusta`, {
        variant: {
          title: selectedVariant.title,
          author: selectedVariant.author,
          sourceId: selectedVariant.id,
          formats: [
            ...selectedVariant.formats.map((format: any) => ({
              format: format.format,
              url: `/api/books/flibusta/download/${selectedVariant.id}/${format.format}`
            })),
            {
              format: 'read',
              url: `https://flibusta.is/b/${selectedVariant.id}/read`
            }
          ]
        }
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('Server response:', response.data);
      const updatedBook = response.data;
      
      // Update the element in the local state
      setElements(prev => prev.map(element => {
        if (element.id === bookDetailsModal.id) {
          return {
            ...element,
            bookData: {
              ...element.bookData!,
              _id: updatedBook._id, // Ensure _id is updated
              flibustaStatus: 'uploaded',
              flibustaVariants: updatedBook.flibustaVariants
            }
          };
        }
        return element;
      }));
      
      // Update the modal state
      setBookDetailsModal(prev => {
        if (!prev) return null;
        return {
          ...prev,
          bookData: {
            ...prev.bookData!,
            _id: updatedBook._id, // Ensure _id is updated
            flibustaStatus: 'uploaded',
            flibustaVariants: updatedBook.flibustaVariants
          }
        };
      });
      
      // Reset the variant selection
      setSelectedVariant(null);
      toast.success('Download links saved successfully');
    } catch (error) {
      console.error('Error saving download links:', error);
      toast.error('Failed to save download links');
    }
  };

  const handleClearDownloadLinks = () => {
    setSelectedVariant(null);
  };

  const handleAddLine = useCallback(() => {
    if (!containerRef.current) return;

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Lines start with points a bit to the left and right of center
    const startX = viewportCenter.x - 50;
    const endX = viewportCenter.x + 50;
    const centerY = viewportCenter.y;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'line',
      left: 0,
      top: 0,
      text: '',
      orientation: 'horizontal',
      lineData: {
        startX,
        startY: centerY,
        endX,
        endY: centerY,
      }
    };

    setElements(prev => [...prev, newElement]);
  }, [getViewportCenterInCanvas]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingLineHandle || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setElements(prev => prev.map(element => {
        if (element.id === isDraggingLineHandle.elementId && element.lineData) {
          return {
            ...element,
            lineData: {
              ...element.lineData,
              ...(isDraggingLineHandle.handle === 'start' 
                ? { startX: x, startY: y }
                : { endX: x, endY: y }
              )
            }
          };
        }
        return element;
      }));
    };

    const handleMouseUp = () => {
      setIsDraggingLineHandle(null);
    };

    if (isDraggingLineHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLineHandle]);

  // Update the line handle mouse down handler
  useEffect(() => {
    const handleLineHandleMouseDown = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      if (!target.classList.contains('line-handle')) return;

      const elementId = target.getAttribute('data-element-id');
      const handle = target.getAttribute('data-handle');

      if (!elementId || !handle) return;

      e.stopPropagation();
      e.preventDefault(); // Prevent default text selection when dragging handles
      
      setIsDraggingLineHandle({
        elementId,
        handle: handle as 'start' | 'end'
      });
    };

    document.addEventListener('mousedown', handleLineHandleMouseDown);
    return () => document.removeEventListener('mousedown', handleLineHandleMouseDown);
  }, []);

  // Add pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Blur any active inputs to save map name
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.tagName === 'INPUT') {
      activeElement.blur();
    }
    
    // Only start panning if clicking directly on the container (not on elements)
    if (e.target === e.currentTarget) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
      e.preventDefault();
    }
  }, [canvasPosition]);

  const handlePanMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setCanvasPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      e.preventDefault();
    }
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);
// Add touch handling for mobile devices
const [touchPoints, setTouchPoints] = useState<{ [key: string]: { x: number, y: number } }>({});
const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
const [initialScale, setInitialScale] = useState<number>(1);

// Calculate distance between two touch points
const getDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Handle touch start events
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  // Blur any active inputs to save map name
  const activeElement = document.activeElement as HTMLElement;
  if (activeElement && activeElement.tagName === 'INPUT') {
    activeElement.blur();
  }
  
  // Store all touch points
  const newTouchPoints: { [key: string]: { x: number, y: number } } = {};
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    newTouchPoints[touch.identifier] = { x: touch.clientX, y: touch.clientY };
  }
  setTouchPoints(newTouchPoints);
  
  // If two touch points, store initial distance for pinch-to-zoom
  if (e.touches.length === 2) {
    const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
    const distance = getDistance(touch1, touch2);
    setInitialPinchDistance(distance);
    setInitialScale(scale);
  }
  
  // If one touch point, treat it as panning
  if (e.touches.length === 1 && e.target === e.currentTarget) {
    setIsPanning(true);
    setPanStart({ 
      x: e.touches[0].clientX - canvasPosition.x, 
      y: e.touches[0].clientY - canvasPosition.y 
    });
  }
}, [canvasPosition, scale]);

// Handle touch move events
const handleTouchMove = useCallback((e: React.TouchEvent) => {
  // Update stored touch points
  const newTouchPoints: { [key: string]: { x: number, y: number } } = {};
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    newTouchPoints[touch.identifier] = { x: touch.clientX, y: touch.clientY };
  }
  setTouchPoints(newTouchPoints);
  
  // Handle pinch-to-zoom with two fingers
  if (e.touches.length === 2 && initialPinchDistance !== null) {
    const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
    const currentDistance = getDistance(touch1, touch2);
    const zoomFactor = currentDistance / initialPinchDistance;
    const newScale = Math.max(0.1, Math.min(3, initialScale * zoomFactor));
    setScaleState(newScale);
  }
  
  // Handle panning with one finger
  if (e.touches.length === 1 && isPanning) {
    const newX = e.touches[0].clientX - panStart.x;
    const newY = e.touches[0].clientY - panStart.y;
    setCanvasPosition({ x: newX, y: newY });
  }
}, [initialPinchDistance, initialScale, isPanning, panStart]);

// Handle touch end events
const handleTouchEnd = useCallback((e: React.TouchEvent) => {
  // Create a copy of the current touch points
  const newTouchPoints = { ...touchPoints };
  
  // Remove touch points that have ended
  Array.from(e.changedTouches).forEach(touch => {
    delete newTouchPoints[touch.identifier];
  });
  
  setTouchPoints(newTouchPoints);
  
  // If fewer than two touch points remain, reset pinch zoom state
  if (Object.keys(newTouchPoints).length < 2) {
    setInitialPinchDistance(null);
  }
  
  // If no touch points remain, end panning
  if (Object.keys(newTouchPoints).length === 0) {
    setIsPanning(false);
  }
}, [touchPoints]);
  // Add pan effect
  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
    };
  }, [isPanning, handlePanMove, handlePanEnd]);

  // Add wheel event handler for zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check if any modal is open by checking the state variables at runtime
    // This avoids the temporal dead zone error from dependency array
    const modalCheck = () => {
      return isSearchModalOpen || 
             !!bookDetailsModal || 
             // Access textEditModal via function call to avoid circular reference
             !!document.querySelector('#textEditModal') || 
             isImageModalOpen ||
             isLinkModalOpen ||
             !!fullscreenImage;
    };
    
    // If a modal is open, don't adjust the canvas scale
    if (modalCheck()) {
      return;
    }
    
    // Remove the control key requirement
    e.preventDefault();
    
    const ZOOM_SENSITIVITY = 0.001;
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    
    setScaleState(prevScale => {
      const newScale = Math.min(Math.max(0.25, prevScale + delta), 2);
      
      // Adjust position to zoom towards cursor
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        // Mouse position relative to the viewport
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // The point on the canvas where the mouse is pointing
        const pointX = (mouseX - canvasPosition.x) / prevScale;
        const pointY = (mouseY - canvasPosition.y) / prevScale;
        
        // New position that keeps the point under the mouse
        const newX = mouseX - pointX * newScale;
        const newY = mouseY - pointY * newScale;
        
        setCanvasPosition({ x: newX, y: newY });
      }
      
      return newScale;
    });
  }, [canvasPosition]); // Only depend on canvasPosition

  // Add keyboard shortcut handler for zooming
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if any modal is open by checking the state variables at runtime
    // This avoids the temporal dead zone error from dependency array
    const modalCheck = () => {
      return isSearchModalOpen || 
             !!bookDetailsModal || 
             // Access textEditModal via function call to avoid circular reference
             !!document.querySelector('#textEditModal') || 
             isImageModalOpen ||
             isLinkModalOpen ||
             !!fullscreenImage;
    };
    
    // Don't capture key events when text modal is open to allow for text navigation
    if (document.querySelector('#textEditModal')) {
      // Still capture Ctrl+= and Ctrl+- for zoom, but nothing else
      if (e.ctrlKey && (e.key === '=' || e.key === '+' || e.key === '-')) {
        e.preventDefault();
        if (e.key === '=' || e.key === '+') {
          setScaleState(prevScale => Math.min(prevScale + 0.25, 2));
        } else if (e.key === '-') {
          setScaleState(prevScale => Math.max(prevScale - 0.1, 0.1));
        }
      }
      return;
    }
    
    // Don't interfere with Alt+Arrow key combinations as they're used for text editing
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      return;
    }
    
    if (e.ctrlKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setScaleState(prevScale => Math.min(prevScale + 0.25, 2));
      } else if (e.key === '-') {
        e.preventDefault();
        setScaleState(prevScale => Math.max(prevScale - 0.1, 0.1));
      }
    }
    
    // Track Alt key for element duplication (handle both key formats)
    if (e.key === 'Alt' || e.key === 'Meta' || e.altKey) {
      // Don't prevent default behavior for Alt+Arrow key combinations
      if (!(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault(); // Prevent browser's default behavior for other Alt combinations
      }
      
      setIsAltKeyPressed(true);
      
      // Update the container cursor using CSS class
      if (containerRef.current) {
        // Keep the grabbing state if already panning, otherwise show copy cursor
        if (isPanning) {
          containerRef.current.className = containerRef.current.className.replace('cursor-grab', 'cursor-grabbing');
        } else {
          containerRef.current.className = containerRef.current.className.replace('cursor-grab', 'cursor-copy');
        }
      }
    }
  }, [isPanning]); // Remove textEditModal from dependency array

  // Handle key up for Alt key
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Skip Alt key handling when text edit modal is open
    if (document.querySelector('#textEditModal')) {
      return;
    }
    
    if (e.key === 'Alt' || e.key === 'Meta' || e.altKey) {
      // Don't prevent default behavior for Alt+Arrow key combinations
      if (!(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault(); // Prevent browser's default behavior for other Alt combinations
      }
      
      setIsAltKeyPressed(false);
      
      // Restore cursor based on panning state using CSS class
      if (containerRef.current) {
        containerRef.current.className = containerRef.current.className.replace('cursor-copy', '');
        containerRef.current.className = `map-container with-grid absolute ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`;
      }
    }
  }, [isPanning]); // Remove textEditModal from dependency array

  // Add event listeners
  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleWheel, handleKeyDown, handleKeyUp]);

  // Add this near the top of the MapsPage component
  useEffect(() => {
    // Removed logging for connections and scale
    // Check if the Xarrow library is properly handling scale
    setTimeout(() => {
      const xarrows = document.querySelectorAll('.xarrow');
      if (xarrows.length > 0) {
        console.log('Xarrow Elements:', {
          count: xarrows.length,
          firstXarrow: xarrows[0],
          xarrowStyles: window.getComputedStyle(xarrows[0]),
          scale
        });
      }
    }, 100);
  }, [connections, scale]);

  const [textEditModal, setTextEditModal] = useState<{ id: string; text: string } | null>(null);
  const bookCoverRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Book cover tilt effect handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bookCoverRef.current) return;
    
    const { left, top, width, height } = bookCoverRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    // Calculate tilt, with more subtle effect (reduced factor)
    const tiltX = -(y - height / 2) / 10; // Vertical axis
    const tiltY = (x - width / 2) / 15; // Horizontal axis
    
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  // Add the maps-page class to the body to prevent scrolling
  useEffect(() => {
    // Add class to prevent body scrolling
    document.body.classList.add('maps-page');
    
    // Remove the class when component unmounts
    return () => {
      document.body.classList.remove('maps-page');
    };
  }, []);

  // Add state for image uploading
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  
  // Add state for link modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLoadingLinkPreview, setIsLoadingLinkPreview] = useState(false);
  const [linkPreviewData, setLinkPreviewData] = useState<{
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    youtubeVideoId?: string; // Add property for YouTube video embedding
  } | null>(null);
  
  // Function to fetch link preview data
  const fetchLinkPreview = async (url: string) => {
    setIsLoadingLinkPreview(true);
    try {
      // Validate URL format
      let processedUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        processedUrl = 'https://' + url;
      }
      
      // Get URL object for parse operations
      const urlObj = new URL(processedUrl);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      // Special handling for popular services
      
      // Special handling for Yandex Music
      if (hostname === 'music.yandex.ru') {
        try {
          // Format displayUrl
          const displayUrl = 'music.yandex.ru/' + pathParts.slice(0, 2).join('/');
          
          // Determine content type and extract IDs
          const isTrack = pathParts.includes('track');
          const isAlbum = pathParts.includes('album');
          
          let title = 'Yandex Music';
          let description = 'Listen to music on Yandex Music';
          
          if (isTrack) {
            const albumIndex = pathParts.indexOf('album');
            const trackIndex = pathParts.indexOf('track');
            
            if (albumIndex !== -1 && trackIndex !== -1 && albumIndex + 1 < pathParts.length && trackIndex + 1 < pathParts.length) {
              const albumId = pathParts[albumIndex + 1];
              const trackId = pathParts[trackIndex + 1];
              title = `Track on Yandex Music (#${trackId})`;
              description = `From album #${albumId} on Yandex Music`;
            } else {
              title = 'Track on Yandex Music';
            }
          } else if (isAlbum) {
            const albumIndex = pathParts.indexOf('album');
            if (albumIndex !== -1 && albumIndex + 1 < pathParts.length) {
              const albumId = pathParts[albumIndex + 1];
              title = `Album on Yandex Music (#${albumId})`;
            } else {
              title = 'Album on Yandex Music';
            }
          }
          
          // Create a custom preview for Yandex Music
          setLinkPreviewData({
            url: processedUrl,
            title: title,
            description: description,
            image: 'https://web.archive.org/web/20230630161447im_/https://music.yandex.ru/blocks/meta/i/og-image.png', // Yandex Music logo/default image
            siteName: 'Yandex Music',
            favicon: 'https://music.yandex.ru/favicon.ico',
            displayUrl: displayUrl
          });
          setIsLoadingLinkPreview(false);
          return;
        } catch (error) {
          console.error('Error with Yandex Music special handling:', error);
          // Continue with regular link preview if special handling fails
        }
      }
      
      // Special handling for YouTube
      else if (hostname === 'youtube.com' || hostname === 'youtu.be') {
        try {
          // Extract video ID
          let videoId = '';
          if (hostname === 'youtube.com') {
            videoId = urlObj.searchParams.get('v') || '';
          } else if (hostname === 'youtu.be' && pathParts.length > 0) {
            videoId = pathParts[0];
          }
          
          // Format clean displayUrl
          const displayUrl = hostname + (videoId ? '/watch' : '');
          
          if (videoId) {
            // Create a custom preview with the video thumbnail
            setLinkPreviewData({
              url: processedUrl,
              title: 'YouTube Video',
              description: 'Watch this video on YouTube',
              image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              siteName: 'YouTube',
              favicon: 'https://www.youtube.com/favicon.ico',
              displayUrl: displayUrl,
              youtubeVideoId: videoId // Store the YouTube video ID for embedding
            });
            setIsLoadingLinkPreview(false);
            return;
          }
        } catch (error) {
          console.error('Error with YouTube special handling:', error);
        }
      }
      
      // Special handling for Meduza
      else if (hostname === 'meduza.io') {
        try {
          const displayUrl = 'meduza.io' + (pathParts.length > 0 ? '/' + pathParts[0] : '');
          
          setLinkPreviewData({
            url: processedUrl,
            title: 'Meduza',
            description: 'News from Meduza',
            image: 'https://meduza.io/image/social/meduza-share.png',
            siteName: 'Meduza',
            favicon: 'https://meduza.io/favicon.ico',
            displayUrl: displayUrl
          });
          setIsLoadingLinkPreview(false);
          return;
        } catch (error) {
          console.error('Error with Meduza special handling:', error);
        }
      }
      
      // Try to fetch link preview using linkpreview.net API
      const apiKey = '657ab82fe7584749efe812a3b259d48d'; // Link Preview API key
      const apiUrl = `https://api.linkpreview.net/?key=${apiKey}&q=${encodeURIComponent(processedUrl)}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data && !data.error) {
        // Format a clean display URL
        const urlObj = new URL(processedUrl);
        const hostname = urlObj.hostname.replace('www.', '');
        const firstPathSegment = urlObj.pathname.split('/')[1];
        const displayUrl = firstPathSegment ? `${hostname}/${firstPathSegment}` : hostname;
        
        setLinkPreviewData({
          url: processedUrl,
          title: data.title || '',
          description: data.description || '',
          image: data.image || '',
          siteName: data.title || '',
          favicon: data.favicon || '',
          displayUrl: displayUrl
        });
      } else {
        // If API fails, create basic preview
        const urlObj = new URL(processedUrl);
        const hostname = urlObj.hostname.replace('www.', '');
        const firstPathSegment = urlObj.pathname.split('/')[1];
        const displayUrl = firstPathSegment ? `${hostname}/${firstPathSegment}` : hostname;
        
        setLinkPreviewData({
          url: processedUrl,
          title: url,
          displayUrl: displayUrl
        });
      }
    } catch (error) {
      console.error('Error fetching link preview:', error);
      // Set basic preview data on error
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const hostname = urlObj.hostname.replace('www.', '');
        const firstPathSegment = urlObj.pathname.split('/')[1];
        const displayUrl = firstPathSegment ? `${hostname}/${firstPathSegment}` : hostname;
        
        setLinkPreviewData({
          url: url,
          title: url,
          displayUrl: displayUrl
        });
      } catch (e) {
        setLinkPreviewData({
          url: url,
          title: url,
          displayUrl: url
        });
      }
    } finally {
      setIsLoadingLinkPreview(false);
    }
  };
  
  // Function to add a link element to the canvas
  const handleAddLinkElement = useCallback((linkData: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    youtubeVideoId?: string; // Add property for YouTube video embedding
  }) => {
    if (!containerRef.current) return;

    const elementWidth = 240; // Default width for link elements
    const elementHeight = 160; // Default height for link elements

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Calculate the position so element is centered on the viewport center
    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    // Canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'link',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: linkData.title || linkData.displayUrl || 
        (linkData.url ? new URL(linkData.url).hostname.replace('www.', '') : ""),
      orientation: 'horizontal',
      linkData: {
        url: linkData.url,
        title: linkData.title, // Keep title for potential future use
        description: linkData.description,
        siteName: linkData.siteName,
        favicon: linkData.favicon,
        displayUrl: linkData.displayUrl,
        image: linkData.image,
        youtubeVideoId: linkData.youtubeVideoId // Include YouTube video ID
      }
    };

    setElements(prev => [...prev, newElement]);
    setLinkPreviewData(null);
    setIsLinkModalOpen(false);
  }, [elements.length, getViewportCenterInCanvas]);
  
  // Function to open link modal
  const handleAddLink = useCallback(() => {
    setIsLinkModalOpen(true);
  }, []);
  
  // Function to handle image uploads using imgBB API
  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    toast.loading('Uploading image...', { id: 'image-upload' });
    
    try {
      console.log('Uploading image:', file.name, file.type, file.size);
      
      const formData = new FormData();
      formData.append('image', file);
      
      console.log('Making request to ImgBB API');
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });

      console.log('ImgBB response status:', response.status);
      
      const data = await response.json();
      console.log('ImgBB response data:', data);
      
      if (data.success) {
        console.log('Upload successful, image URL:', data.data.display_url);
        setUploadedImageUrl(data.data.display_url);
        handleAddImageElement(data.data.display_url);
        setIsImageModalOpen(false);
        toast.success('Image uploaded successfully!', { id: 'image-upload' });
      } else {
        console.error('ImgBB upload failed:', data);
        throw new Error(data.error?.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
        id: 'image-upload' 
      });
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  // Function to add an image element to the canvas
  const handleAddImageElement = useCallback((imageUrl: string) => {
    if (!containerRef.current) return;
    console.log('Adding image element with URL:', imageUrl);

    const elementWidth = 200; // Default width for image elements
    const elementHeight = 150; // Default height for image elements

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Calculate the position so element is centered on the viewport center
    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    // Canvas bounds
    const canvasWidth = 2700; // Increased from 1800 to 2700
    const canvasHeight = 2700; // Increased from 1800 to 2700

    const newElement: MapElement = {
      id: `image-${Date.now()}`,
      type: 'image',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: 'Image', // Image elements need some text
      orientation: 'horizontal',
      imageData: {
        url: imageUrl,
        alt: `Image ${elements.length + 1}`
      }
    };

    console.log('Created new image element:', newElement);
    setElements(prev => [...prev, newElement]);
  }, [elements.length, getViewportCenterInCanvas]);
  
  // Function to open image upload modal
  const handleAddImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  }, []);

  // Add state for fullscreen image view
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; alt?: string } | null>(null);

  // Load map from URL if id is present
  useEffect(() => {
    // Extract map ID from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('id');
    
    if (mapId) {
      loadMapData(mapId);
    }
  }, []);

  // Update document title when map name changes
  useEffect(() => {
    // Only update the title if we're not in the initial loading phase
    if (savedMapId) {
      document.title = mapName ? `${mapName} - Alphy` : 'Alphy';
    }
  }, [mapName, savedMapId]);

  // Function to load map data from server
  const loadMapData = async (mapId: string) => {
    try {
      const mapData = await loadMap(mapId);
      
      if (mapData) {
        console.log('[DEBUG loadMapData] Loaded map data isPrivate:', mapData?.isPrivate);
        
        // Debug: Log any book elements with completed status
        const booksWithCompletedStatus = mapData.elements.filter(
          el => el.type === 'book' && el.bookData && el.bookData.completed === true
        );
        
        if (booksWithCompletedStatus.length > 0) {
          console.log('Loaded map has books with completed status:', booksWithCompletedStatus);
        } else {
          console.log('No books with completed status found in loaded map');
        }
        
        setElements(mapData.elements);
        setConnections(mapData.connections);
        setCanvasPosition(mapData.canvasPosition);
        setScaleState(mapData.scale);
        setMapName(mapData.name);
        setIsPrivate(mapData?.isPrivate === true); // Explicitly convert to boolean
        setSavedMapId(mapData._id);
        
        // Store current state for comparison
        lastDataRef.current = JSON.stringify({ elements: mapData.elements, connections: mapData.connections });
      }
    } catch (error) {
      console.error('Error loading map:', error);
      toast.error('Error loading map');
    }
  };

  const saveMapToDatabase = async (overrideIsPrivate?: boolean) => {
    if (saving.current) {
      console.log('[DEBUG] Already saving, skipping this save operation');
      return;
    }

    console.log('[DEBUG] saveMapToDatabase called, current autosave state:', autoSaving.current);
    saving.current = true;

    try {
      // Check for required data
      if (!mapName) {
        setMapNameError('Map name is required');
        setShowMapNameDialog(true);
        saving.current = false;
        return;
      }
      
      // Clear any previous error
      setMapNameError('');

      // Check for books in the map for debugging
      const booksInMap = elements.filter(e => e.type === 'book');
      console.log('[DEBUG] All books in the map:', booksInMap);

      // Count completed books for debugging
      const completedBooks = elements.filter(
        e => e.type === 'book' && e.bookData && e.bookData.completed === true
      );
      if (completedBooks.length > 0) {
        console.log('[DEBUG] Found', completedBooks.length, 'completed books');
      }

      // Prepare map data
      const mapData = {
        name: mapName,
        elements,
        connections,
        canvasPosition,
        scale,
        // Add required properties for MapData interface
        canvasWidth: containerRef.current?.clientWidth || 1000,
        canvasHeight: containerRef.current?.clientHeight || 800,
        // Use the override value if provided, otherwise use the current state
        isPrivate: typeof overrideIsPrivate === 'boolean' ? overrideIsPrivate : isPrivate
      };

      console.log('[DEBUG saveMapToDatabase] Saving map with isPrivate:', mapData.isPrivate);

      // Save map data using the map service
      console.log('[DEBUG] Saving map to database...');
      const savedMap = await saveMap(mapData, savedMapId);
      console.log('[DEBUG] Map saved successfully');
      
      // Check for null before accessing properties
      if (savedMap) {
        console.log('[DEBUG] Saved map has isPrivate:', savedMap?.isPrivate);
        console.log('[DEBUG] Saved map properties:', Object.keys(savedMap));

        // Update our state with the returned isPrivate value
        if ('isPrivate' in savedMap) {
          // Use Boolean() to convert undefined to false if needed
          setIsPrivate(Boolean(savedMap.isPrivate));
          console.log('[DEBUG] Updated isPrivate state to:', Boolean(savedMap.isPrivate));
        } else {
          console.log('[DEBUG] Warning: isPrivate not found in saved map response');
        }
        
        if (!savedMapId) {
          setSavedMapId(savedMap._id);
          // Update URL with map ID without reloading page
          window.history.pushState({}, '', `/maps?id=${savedMap._id}`);
        }
      }
      
      setLastSavedTime(new Date());
      
      return true;
    } catch (error) {
      console.error('Error saving map:', error);
      toast.error('Failed to save map');
      saving.current = false;
      return false;
    } finally {
      saving.current = false;
    }
  };
  
  // Update the timer effect to use 7 seconds instead of 2
  useEffect(() => {
    // If autosave disabled or no map to save, clear any existing timer and return
    if (!isAutosaveEnabled || !savedMapId) {
      // Clean up any existing timer when autosave is turned off
      if (autosaveTimerRef.current) {
        console.log('Autosave disabled, clearing existing timer');
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      // Also reset the autosave in progress flag
      if (autosaveInProgressRef.current) {
        autosaveInProgressRef.current = false;
        setIsAutoSaving(false);
      }
      return;
    }

    // Helper function to compare objects ignoring connection IDs
    const areDataEquivalent = (
      current: {
        name: string;
        elements: MapElement[];
        connections: Connection[];
        canvasPosition: { x: number; y: number };
        scale: number;
        canvasWidth: number;
        canvasHeight: number;
        isPrivate?: boolean;
      } | null | undefined, 
      previous: {
        name: string;
        elements: MapElement[];
        connections: Connection[];
        canvasPosition: { x: number; y: number };
        scale: number;
        canvasWidth: number;
        canvasHeight: number;
        isPrivate?: boolean;
      } | null | undefined
    ) => {
      // If previous data doesn't exist, treat as changed
      if (!current || !previous) return false;
      
      // Compare elements count
      if (!current.elements || !previous.elements || current.elements.length !== previous.elements.length) return false;
      
      // Compare connections count
      if (!current.connections || !previous.connections || current.connections.length !== previous.connections.length) return false;
      
      // Compare isPrivate
      if (current.isPrivate !== previous.isPrivate) {
        console.log('[DEBUG] areDataEquivalent detected isPrivate change:', previous.isPrivate, '->', current.isPrivate);
        return false;
      }
      
      // Compare elements deeply but ignore IDs
      for (let i = 0; i < current.elements.length; i++) {
        const currentEl = { ...current.elements[i] };
        const prevEl = { ...previous.elements[i] };
        
        if (!currentEl || !prevEl) return false;
        
        // If positions or text changed, data is different
        if (currentEl.left !== prevEl.left || 
            currentEl.top !== prevEl.top || 
            currentEl.text !== prevEl.text ||
            currentEl.width !== prevEl.width ||
            currentEl.height !== prevEl.height) {
          return false;
        }
      }
      
      // For connections, we only care about the connections between elements, not their IDs
      for (let i = 0; i < current.connections.length; i++) {
        const currentConn = current.connections[i];
        const prevConn = previous.connections[i];
        
        if (!currentConn || !prevConn) return false;
        
        if (currentConn.start !== prevConn.start || 
            currentConn.end !== prevConn.end ||
            currentConn.startPoint !== prevConn.startPoint ||
            currentConn.endPoint !== prevConn.endPoint) {
          return false;
        }
      }
      
      // Compare canvas position
      if (!current.canvasPosition || !previous.canvasPosition || 
          current.canvasPosition.x !== previous.canvasPosition.x || 
          current.canvasPosition.y !== previous.canvasPosition.y) {
        return false;
      }
      
      // Compare scale
      if (current.scale !== previous.scale) return false;
      
      // Compare map name
      if (current.name !== previous.name) return false;
      
      // If we got here, data is equivalent (ignoring connection IDs)
      return true;
    };
    
    // Get current data for comparison
    const currentData = {
      name: mapName,
      elements,
      connections,
      canvasPosition,
      scale,
      canvasWidth: containerRef.current?.clientWidth || 1000,
      canvasHeight: containerRef.current?.clientHeight || 800,
      isPrivate // Include isPrivate in the comparison data
    };
    
    // Get previous data
    let previousData = null;
    try {
      if (lastDataRef.current) {
        previousData = JSON.parse(lastDataRef.current);
      }
    } catch (e) {
      console.error('Error parsing previous data:', e);
    }
    
    // Only trigger autosave if data has meaningfully changed
    if (!areDataEquivalent(currentData, previousData)) {
      console.log('Data changed, scheduling autosave');
      lastDataRef.current = JSON.stringify(currentData);
      
      // Clear previous timer if it exists
      if (autosaveTimerRef.current) {
        console.log('Clearing existing autosave timer');
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      
      // Don't schedule another autosave if one is already in progress
      if (!autosaveInProgressRef.current) {
        console.log('Setting autosave timer (7 second delay)');
        autosaveTimerRef.current = setTimeout(async () => {
          console.log('Autosave timer fired, calling saveMapToDatabase');
          
          // Mark autosave as in progress before starting
          autosaveInProgressRef.current = true;
          setIsAutoSaving(true);
          
          try {
            // Perform the save operation
            const success = await saveMapToDatabase();
            
            if (success) {
              console.log('Autosave completed successfully');
            } else {
              console.warn('Autosave returned failure');
            }
          } catch (error) {
            console.error('Autosave failed with exception:', error);
          } finally {
            // Always reset the flags, even if there was an error
            console.log('Resetting autosave flags');
            autosaveInProgressRef.current = false;
            autosaveTimerRef.current = null;
            setIsAutoSaving(false);
          }
        }, 7000); // 7 second debounce
      } else {
        console.log('Autosave already in progress, skipping timer creation');
      }
    }
  }, [elements, connections, mapName, canvasPosition, scale, isAutosaveEnabled, savedMapId, isPrivate]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        console.log('Component unmounting, clearing autosave timer');
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Handle save map
  const handleSaveMap = async () => {
    const result = await saveMapToDatabase();
    
    // If this is a new map that was just saved for the first time,
    // update the isPrivate state to match what the user selected
    if (result && !savedMapId) {
      console.log('[DEBUG] New map saved, ensuring isPrivate state is preserved');
      // No need to update state here, we'll use the returned savedMap.isPrivate value
    }
    
    return result;
  };

  // Function to save and navigate to saved maps page
  const handleSaveAndExit = async () => {
    await handleSaveMap();
    router.push('/');
  };

  const toggleBookCompleted = useCallback((elementId: string) => {
    // First find the current element to determine new state
    const element = elements.find(el => el.id === elementId);
    
    console.log('[DEBUG] toggleBookCompleted called with element:', element);
    
    if (!element || element.type !== 'book' || !element.bookData) {
      console.warn('[DEBUG] Cannot toggle completed - invalid element or missing bookData');
      return;
    }
    
    const newCompletedState = !element.bookData.completed;
    
    console.log(`Toggling book completed status for ${elementId}: ${element?.bookData?.completed || false} -> ${newCompletedState}`);
    console.log('[DEBUG] Original bookData structure:', JSON.stringify(element.bookData));
    
    // Update element state with a deep clone to ensure React detects the change
    setElements(prev => {
      // Create a deep copy of the elements array
      const updatedElements = prev.map(element => {
        if (element.id === elementId && element.type === 'book' && element.bookData) {
          // Create a new object with the updated completed property
          const newBookData = { 
            ...element.bookData, 
            completed: newCompletedState 
          };
          
          console.log('[DEBUG] New bookData structure:', JSON.stringify(newBookData));
          
          return { 
            ...element, 
            bookData: newBookData
          };
        }
        return element;
      });
      
      // For debugging: count books marked as completed in the updated array
      const completedCount = updatedElements.filter(
        (el: any) => el.type === 'book' && el.bookData && el.bookData.completed === true
      ).length;
      
      console.log(`[DEBUG] After update: ${completedCount} books marked as completed`);
      
      return updatedElements;
    });
    
    // Show toast notification
    toast.success(newCompletedState ? 'Marked as completed' : 'Marked as not completed', {
      duration: 1500,
      position: 'bottom-center',
      style: {
        backgroundColor: newCompletedState ? '#000' : '#fff',
        color: newCompletedState ? '#fff' : '#000',
        border: newCompletedState ? 'none' : '1px solid #e5e7eb'
      }
    });
    
    // Let the autosave mechanism handle saving 
    // The useEffect watching elements will trigger an autosave after a delay
  }, [elements]);

  const handleCopyShareLink = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([shareUrl], { type: 'text/plain' }),
      }),
    ]);
    
    // Set copied state temporarily
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // State for dropdown and link copy confirmation
  const [showDropdown, setShowDropdown] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Reference for the dropdown menu
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to delete the current map
  const handleDeleteMap = async () => {
    if (savedMapId) {
      const success = await deleteMap(savedMapId);
      if (success) {
        toast.success('Map deleted successfully');
        router.push('/saved-maps');
      }
    }
    setShowDeleteConfirm(false);
    setShowDropdown(false);
  };
  
  // Function to adjust input width based on content
  const adjustInputWidth = useCallback(() => {
    if (hiddenTextRef.current && mapNameInputRef.current) {
      // Add minimal padding for cursor space
      const width = hiddenTextRef.current.offsetWidth + 12; 
      // Set a minimum width for about 4 characters
      // Set a maximum width to prevent it from pushing other elements too far
      const calculatedWidth = Math.max(Math.min(width, 420), 40);
      mapNameInputRef.current.style.width = `${calculatedWidth}px`;
    }
  }, []);

  // Adjust width when map name changes
  useEffect(() => {
    adjustInputWidth();
  }, [mapName, adjustInputWidth]);

  // Set initial width on component mount
  useEffect(() => {
    adjustInputWidth();
    // Set up a resize listener for font loading
    window.addEventListener('resize', adjustInputWidth);
    // Adjust one more time after a delay to account for font loading
    const timeoutId = setTimeout(adjustInputWidth, 100);
    
    return () => {
      window.removeEventListener('resize', adjustInputWidth);
      clearTimeout(timeoutId);
    };
  }, [adjustInputWidth]);
  
  // Add text formatting state and refs
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const textEditRef = useRef<HTMLTextAreaElement>(null);

  // Function to handle text formatting
  const handleFormat = (type: string, selection: { start: number; end: number }) => {
    if (!textEditRef.current || !textEditModal) return;
    
    const textarea = textEditRef.current;
    const text = textarea.value;
    const { start, end } = selection;
    let newText = '';
    
    switch (type) {
      case 'bold':
        newText = text.substring(0, start) + '**' + text.substring(start, end) + '**' + text.substring(end);
        break;
      case 'italic':
        newText = text.substring(0, start) + '*' + text.substring(start, end) + '*' + text.substring(end);
        break;
      case 'link':
        newText = text.substring(0, start) + '[' + text.substring(start, end) + '](url)' + text.substring(end);
        break;
      case 'clear':
        // Simple clear formatting - remove common markdown
        const selectedText = text.substring(start, end)
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/_/g, '')
          .replace(/\[|\]\(.*?\)/g, '');
        newText = text.substring(0, start) + selectedText + text.substring(end);
        break;
      default:
        return;
    }
    
    setTextEditModal({ ...textEditModal, text: newText });
    
    // Set selection back to the textarea after formatting
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    }, 0);
  };
  
  // Bookmark states
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  
  // Add useEffect to check bookmark status when a book is opened
  useEffect(() => {
    if (bookDetailsModal && bookDetailsModal.bookData && bookDetailsModal.bookData._id && user) {
      // Check if the book is already bookmarked by this user
      const isMarked = bookDetailsModal.bookData.bookmarks?.some(bookmark => 
        (typeof bookmark.user === 'string' ? bookmark.user : (bookmark.user as { _id: string })._id) === 
        (typeof user._id === 'string' ? user._id : (user._id as { _id: string })._id)
      );
      setIsBookmarked(!!isMarked);
    } else {
      setIsBookmarked(false);
    }
  }, [bookDetailsModal, user]);
  
  // ... existing code
  
  // Handle bookmarking/unbookmarking a book
  const handleBookmarkToggle = async () => {
    if (!bookDetailsModal || !bookDetailsModal.bookData || !bookDetailsModal.bookData._id || !user) {
      toast.error('You must be logged in to bookmark books');
      return;
    }

    try {
      const result = await bookmarkBook(bookDetailsModal.bookData._id);
      
      if (result.success) {
        setIsBookmarked(result.isBookmarked);
        toast.success(result.isBookmarked ? 'Book bookmarked successfully' : 'Book removed from bookmarks');
        
        // Update the book data with the new bookmark status
        setBookDetailsModal(prev => {
          if (!prev) return null;
          
          const updatedElement = {...prev};
          const updatedBookData = {...updatedElement.bookData};
          
          if (!updatedBookData.bookmarks) {
            updatedBookData.bookmarks = [];
          }
          
          if (result.isBookmarked) {
            // Add the bookmark if it doesn't exist
            if (!updatedBookData.bookmarks.some(b => 
              (typeof b.user === 'string' ? b.user : (b.user as { _id: string })._id) === 
              (typeof user._id === 'string' ? user._id : (user._id as { _id: string })._id)
            )) {
              updatedBookData.bookmarks.push({ user: user._id, timestamp: new Date().toISOString() });
            }
          } else {
            // Remove the bookmark
            updatedBookData.bookmarks = updatedBookData.bookmarks.filter(b => 
              (typeof b.user === 'string' ? b.user : (b.user as { _id: string })._id) !== 
              (typeof user._id === 'string' ? user._id : (user._id as { _id: string })._id)
            );
          }
          
          updatedElement.bookData = {
            ...updatedBookData,
            key: updatedBookData.key || '',
            title: updatedBookData.title || '',
            author: updatedBookData.author || [],
            source: updatedBookData.source || 'alphy'
          } as typeof updatedElement.bookData;
          return updatedElement;
        });
      }
    } catch (error) {
      console.error('Error bookmarking book:', error);
      toast.error('Failed to update bookmark status');
    }
  };
  
  // ... existing code
  
  // Add token check and refresh on component mount and at intervals
  useEffect(() => {
    // Check token on component mount
    const checkAndRefreshToken = async () => {
      if (isTokenExpiring()) {
        console.log("Token is expiring soon, attempting to refresh");
        setIsRefreshingToken(true);
        try {
          const success = await refreshToken();
          if (success) {
            console.log("Token refreshed successfully in Maps component");
          } else {
            console.warn("Failed to refresh token");
          }
        } catch (error) {
          console.error("Error refreshing token:", error);
        } finally {
          setIsRefreshingToken(false);
        }
      }
    };
    
    // Authentication heartbeat to prevent session loss
    const authHeartbeat = () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token) {
        console.warn("Token missing during heartbeat check");
        return;
      }
      
      if (!userStr && token) {
        console.log("User data missing but token exists, attempting to restore session");
        // If we have a token but no user data, try to fetch user data again
        const api = axios.create({
          baseURL: API_BASE_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        api.get('/api/auth/me')
          .then(response => {
            if (response.data && !response.data.error) {
              console.log("Session restored during heartbeat");
              localStorage.setItem('user', JSON.stringify(response.data));
            }
          })
          .catch(err => {
            console.error("Failed to restore session during heartbeat", err);
            // Don't remove token here - just log the error
          });
      }
    };
    
    // Run checks immediately
    checkAndRefreshToken();
    authHeartbeat();
    
    // Set up interval to check more frequently (every 5 minutes for token refresh,
    // every 1 minute for heartbeat check)
    const tokenRefreshInterval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
    const heartbeatInterval = setInterval(authHeartbeat, 60 * 1000);
    
    return () => {
      clearInterval(tokenRefreshInterval);
      clearInterval(heartbeatInterval);
    };
  }, []);

  // Add keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+S (Mac) or Ctrl+S (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser's save dialog
        handleSaveMap();
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveMap]);  // Include handleSaveMap in dependencies

  // Add a special useEffect to track isPrivate changes
  useEffect(() => {
    console.log('[DEBUG] isPrivate state changed to:', isPrivate);
    
    // If the map has already been saved, show notification when privacy changes
    if (savedMapId) {
      if (isPrivate) {
        toast.success('Map is now private. Only you can view and edit it.', { duration: 3000 });
      } else {
        toast.success('Map is now public. Anyone with the link can view it.', { duration: 3000 });
      }
      
      // Note: We don't trigger saveMapToDatabase here anymore since we do it directly in the click handlers
    }
  }, [isPrivate, savedMapId]);

  return (
    <DndContext 
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      {/* Fixed position container to prevent scrolling and account for top toolbar */}
      <div className="fixed inset-0 top-[60px] bg-white">
        {/* Floating header toolbar - redesigned */}
        <div className="absolute top-5 left-5 bg-white rounded-lg shadow-lg px-3 p-2 flex items-center gap-1 z-20 h-14">
          <button
            onClick={handleSaveAndExit}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
            title="Save and return to Saved Maps"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <div className="flex items-center">
            <input 
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              onBlur={() => {
                if (savedMapId && mapName.trim()) {
                  saveMapToDatabase();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                  if (savedMapId && mapName.trim()) {
                    saveMapToDatabase();
                  }
                }
              }}
              className="text-gray-800 font-medium bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded px-1 py-0.5 transition-colors"
              placeholder="Untitled"
              ref={mapNameInputRef}
            />
            <span 
              ref={hiddenTextRef} 
              className="absolute opacity-0 pointer-events-none font-medium"
              style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'pre' }}
            >
              {mapName || 'Untitled'}
            </span>
            {savedMapId && isAutosaveEnabled && (
              <span className={`text-xs mr-0.5 ${isAutoSaving ? 'text-yellow-600' : 'text-green-600'} flex items-center`}>
                {isAutoSaving ? (
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-3 w-3 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
            )}
          </div>
          
          <button
            onClick={handleSaveMap}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
            title="Save"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>
          
          <div className="relative">
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" 
              title="More options"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showDropdown && (
              <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                {/* Public/Private toggle */}
                <div className="px-4 py-2">
                  <div className="inline-flex border border-gray-400/50 rounded-md overflow-hidden w-full">
                    <button
                      onClick={() => {
                        console.log('[DEBUG] Setting isPrivate to false');
                        setIsPrivate(false);
                        if (savedMapId) {
                          saveMapToDatabase(false);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 flex-1 ${
                        !isPrivate 
                          ? 'bg-gray-100 text-gray-800' 
                          : 'bg-white text-black hover:bg-gray-50'
                      }`}
                    >
                      Public
                    </button>
                    <button
                      onClick={() => {
                        console.log('[DEBUG] Setting isPrivate to true');
                        setIsPrivate(true);
                        if (savedMapId) {
                          saveMapToDatabase(true);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 flex-1 ${
                        isPrivate 
                          ? 'bg-gray-100 text-gray-800' 
                          : 'bg-white text-black hover:bg-gray-50'
                      }`}
                    >
                      Private
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center">
                  <input
                    type="checkbox"
                    id="autosave-toggle"
                    checked={isAutosaveEnabled}
                    onChange={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autosave-toggle" className="cursor-pointer text-sm text-gray-700">
                    Auto save
                  </label>
                </div>
                
                <div 
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center"
                  onClick={handleCopyShareLink}
                >
                  {linkCopied ? (
                    <>
                      <svg className="h-4 w-4 mr-2 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Link copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </>
                  )}
                </div>
                
                {savedMapId && (
                  <div 
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-600 flex items-center"
                    onClick={() => !showDeleteConfirm && setShowDeleteConfirm(true)}
                  >
                    {showDeleteConfirm ? (
                      <div className="flex flex-col w-full">
                        <div className="text-gray-800 mb-2">Are you sure?</div>
                        <div className="flex justify-between">
                          <button 
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded" 
                            onClick={handleDeleteMap}
                          >
                            Delete
                          </button>
                          <button 
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded" 
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete map
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

       {/* Floating Toolbar */}
       <div className="absolute md:top-5 md:left-1/2 md:-translate-x-1/2 top-60 left-2 bg-white rounded-lg shadow-lg p-2 md:flex md:items-center md:flex-row flex-col items-start gap-2 z-50 md:h-14">          <button
            onClick={() => handleAddElement('horizontal')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3"></path>
              <path d="M9 20h6"></path>
              <path d="M12 4v16"></path>
            </svg>
          </button>
          <button
            onClick={handleAddLine}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Line"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="20" y2="20"></line>
            </svg>
          </button>
          <button
            onClick={handleAddLink}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button
            onClick={handleAddImage}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Book"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>
          {selectedElement && (
            <>
              <div className="w-px h-6 bg-gray-200"></div>
              <button
                onClick={handleDeleteElement}
                className="p-2 hover:bg-gray-100 rounded-lg text-red-600 flex items-center gap-2 transition-colors"
                title="Delete Element"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleClearConnections()}
                title="Clear Connections"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="4" cy="6" r="1.5" fill="#2D3748" stroke="none" />
                  <circle cx="20" cy="18" r="1.5" fill="#2D3748" stroke="none" />
                  <path d="M4 6 L20 18" stroke="#2D3748" strokeWidth="1.8" />
                  <path d="M6 12 L18 12" stroke="#E53E3E" strokeWidth="2.5" transform="rotate(45 12 12)" />
                  <path d="M6 12 L18 12" stroke="#E53E3E" strokeWidth="2.5" transform="rotate(-45 12 12)" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Make canvas fill the entire viewport height */}
        <div className="h-full w-full overflow-hidden relative">
        <div
  ref={containerRef}
  className={`map-container with-grid absolute ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
  style={{
    width: '2700px', // Increased from 1800px to 2700px
    height: '2700px', // Increased from 1800px to 2700px
    transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${scale})`,
    transformOrigin: '0 0',
    touchAction: 'none', // Prevent default touch behaviors
  }}
  onMouseDown={handlePanStart}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  onClick={handleContainerClick}
>
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ zIndex: 5 }}
            >
              {elements.map((element) => (
                element.type === 'line' ? (
                  <Line
                    key={element.id}
                    element={element}
                    isSelected={selectedElement === element.id}
                    onSelect={handleElementClick}
                    setElements={setElements}
                    containerRef={containerRef}
                    scale={scale}
                  />
                ) : null
              ))}
            </svg>

          <Xwrapper>
              {/* Existing elements */}
            {elements.map((element) => (
                element.type !== 'line' ? (
              <ElementWithConnections
                key={element.id}
                element={element}
                isSelected={selectedElement === element.id}
                onSelect={handleElementClick}
                onStartConnection={handleStartConnection}
                onTransformChange={(transform) => {
                  setElementTransforms(prev => ({
                    ...prev,
                    [element.id]: transform
                  }));
                }}
                onTextChange={handleTextChange}
                onDoubleClick={handleElementDoubleClick}
                scale={scale}
                isAltPressed={isAltKeyPressed}
                isDuplicating={isDuplicating}
                onToggleCompleted={toggleBookCompleted}
              />
              ) : null
            ))}
            
              {/* Arrows */}
            {connections.map((connection, index) => (
                <ScaledXarrow
                key={`${connection.id}-${index}`}
                start={getConnectionRef(connection.start, connection.startPoint || 'right')}
                end={getConnectionRef(connection.end, connection.endPoint || 'left')}
                startAnchor={connection.startPoint || 'right'}
                endAnchor={connection.endPoint || 'left'}
                  color="#8B8B8B"
                  strokeWidth={1.5}
                path="smooth"
                headSize={6}
                curveness={0.8}
                  scale={scale}
              />
            ))}

            {TempConnectionMemo}
          </Xwrapper>
        </div>
        </div>

        {/* Update zoom controls to white background with dark text */}
        <div className="fixed bottom-4 right-4 bg-white text-gray-700 rounded-lg shadow-lg p-1 flex items-center gap-2" style={{ minWidth: "150px" }}>
          <button 
            onClick={() => setScaleState(prev => Math.max(prev - 0.1, 0.25))}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg font-medium w-10 h-10 flex items-center justify-center"
          >
            -
          </button>
          <span className="flex-grow text-center font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScaleState(prev => Math.min(prev + 0.25, 2))}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg font-medium w-10 h-10 flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      {isSearchModalOpen && (
        <SearchModal
          onClose={() => setIsSearchModalOpen(false)}
          onBookSubmit={(bookData) => {
            handleBookSubmit(bookData);
            setIsSearchModalOpen(false);
          }}
    shouldSaveToDb={true}
        />
      )}
      
      {bookDetailsModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={() => setBookDetailsModal(null)}></div>
          
          <div 
            className="bg-black border border-gray-800 rounded-xl w-[800px] h-[85vh] relative flex flex-col overflow-hidden"
            style={{
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
              background: 'linear-gradient(to bottom right, #0a0a0a, #000000)'
            }}
          >
            <div 
              className="p-8 flex-1 overflow-y-auto custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-8">
                <button 
                  onClick={() => setBookDetailsModal(null)} 
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 group"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to map</span>
                </button>
                
                {/* Bookmark button in top right */}
                {user && bookDetailsModal.bookData?._id && (
                  <button 
                    onClick={handleBookmarkToggle}
                    onMouseEnter={() => setIsBookmarkHovered(true)}
                    onMouseLeave={() => setIsBookmarkHovered(false)}
                    className="text-white"
                  >
                    {isBookmarked || isBookmarkHovered ? (
                      <BsBookmarkFill size={24} />
                    ) : (
                      <BsBookmark size={24} />
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex flex-col md:flex-row gap-12">
                {/* Book cover with 3D tilt effect */}
                <div className="w-full md:w-64 flex-shrink-0">
                  <div 
                    ref={bookCoverRef}
                    className="relative group perspective-700"
                    onMouseMove={handleMouseMove}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div 
                      className="transform-gpu transition-transform duration-200 ease-out relative"
                      style={{ 
                        transform: isHovering 
                          ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.05, 1.05, 1.05)` 
                          : 'rotateX(0deg) rotateY(0deg)',
                        transformStyle: 'preserve-3d' 
                      }}
                    >
                      {bookDetailsModal.bookData?.thumbnail ? (
                        <img 
                          src={bookDetailsModal.bookData.highResThumbnail || bookDetailsModal.bookData.thumbnail} 
                          alt={bookDetailsModal.bookData.title}
                          className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: isHovering 
                              ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                              : '0 4px 20px rgba(0, 0, 0, 0.3)',
                            transition: 'box-shadow 0.2s ease-out'
                          }}
                          onError={(e) => {
                            if (e.currentTarget.src !== bookDetailsModal.bookData?.thumbnail) {
                              e.currentTarget.src = bookDetailsModal.bookData?.thumbnail || '';
                            }
                          }}
                        />
                      ) : (
                        <div 
                          className="w-full h-96 bg-gray-900 flex items-center justify-center shadow-lg" 
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: isHovering 
                              ? '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 0, 0, 0.6)' 
                              : '0 4px 20px rgba(0, 0, 0, 0.3)',
                            transition: 'box-shadow 0.2s ease-out'
                          }}
                        >
                          <span className="text-gray-600">No cover</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Book details */}
                <div className="flex-1 mt-4 md:mt-0">
                  <h2 className="text-3xl font-bold text-white mb-3">{bookDetailsModal.bookData?.title}</h2>
                  
                  {bookDetailsModal.bookData?.author && (
                    <p className="text-lg text-gray-300 mb-6 font-light">
                      {Array.isArray(bookDetailsModal.bookData.author) 
                        ? bookDetailsModal.bookData.author.join(', ') 
                        : bookDetailsModal.bookData.author}
                    </p>
                  )}
                  
                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex">
                      {[1,2,3,4,5].map((star) => (
                        <span key={star} className="text-gray-700">★</span>
                      ))}
                    </div>
                    <span className="text-gray-600">n/a</span>
                  </div>
                  
                  {/* Description */}
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-gray-200 text-lg font-medium">Description</h3>
                      <button
                        onClick={() => setIsEditingDescription(true)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        edit
                      </button>
                    </div>
                    
                    {isEditingDescription ? (
                      <div>
                        <textarea
                          value={bookDetailsModal.bookData?.description || ''}
                          onChange={(e) => setBookDetailsModal(prev => ({
                            ...prev!,
                            bookData: {
                              ...prev!.bookData!,
                              description: e.target.value
                            }
                          }))}
                          className="w-full h-32 p-2 border border-gray-700 rounded bg-gray-900 text-white text-sm"
                          placeholder="Enter book description..."
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setIsEditingDescription(false)}
                            className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : bookDetailsModal.bookData?.description ? (
                      <div>
                        <p className="text-gray-400 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                          {showFullDescription 
                            ? bookDetailsModal.bookData.description 
                            : bookDetailsModal.bookData.description.slice(0, 420)}
                        </p>
                        {bookDetailsModal.bookData.description.length > 420 && (
                          <button
                            onClick={() => setShowFullDescription(!showFullDescription)}
                            className="text-sm text-gray-500 hover:text-gray-300 mt-3 transition-colors focus:outline-none"
                          >
                            {showFullDescription ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">No description available</span>
                    )}
                  </div>
                  
                  {/* Download section */}
                  <div className="mt-8">
                    <h3 className="text-gray-200 text-lg font-medium mb-4">Download</h3>
                    
                    {selectedVariant ? (
                      <div>
                        {/* Preview download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {[
                            ...selectedVariant.formats.filter((format: any) => format.format !== 'mobi'),
                            { format: 'read', url: `https://flibusta.is/b/${selectedVariant.id}/read` }
                          ].map((format: any) => (
                            <button
                              key={format.format}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (format.format === 'read') {
                                    window.open(format.url, '_blank');
                                    return;
                                  }

                                  // Direct access to Cloudflare worker URL
                                  if (!bookDetailsModal || !bookDetailsModal.bookData || !bookDetailsModal.bookData.flibustaVariants || 
                                      !bookDetailsModal.bookData.flibustaVariants[0] || !bookDetailsModal.bookData.flibustaVariants[0].sourceId) {
                                    console.error('Source ID not found in book data');
                                    toast.error('Download link not available');
                                    return;
                                  }
                                  
                                  const sourceId = bookDetailsModal.bookData.flibustaVariants[0].sourceId;
                                  window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${selectedVariant.id}/${format.format}`;
                                } catch (err) {
                                  console.error('Error getting download link:', err);
                                  toast.error('Failed to get download link. Please try again.');
                                }
                              }}
                              className={`px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 ${
                                format.format === 'read'
                                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-700'
                              }`}
                            >
                              {format.format === 'read' ? 'Read online (VPN)' : `.${format.format}`}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleSaveDownloadLinks}
                          className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                        >
                          Save book with download links
                        </button>
                        <button
                          onClick={() => setSelectedVariant(null)}
                          className="mt-4 ml-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear selection
                        </button>
                      </div>
                    ) : bookDetailsModal.bookData?.flibustaStatus === 'uploaded' ? (
                      <div>
                        {/* Saved download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {bookDetailsModal.bookData.flibustaVariants?.[0]?.formats
                            .filter(format => format.format !== 'mobi')
                            .map((format) => (
                            <button
                              key={format.format}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (format.format === 'read') {
                                    window.open(format.url, '_blank');
                                    return;
                                  }
                                  
                                  // Direct access to Cloudflare worker URL
                                  window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${bookDetailsModal?.bookData?.flibustaVariants?.[0]?.sourceId}/${format.format}`;
                                } catch (err) {
                                  console.error('Error getting download link:', err);
                                  toast.error('Failed to get download link. Please try again.');
                                }
                              }}
                              className={`px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 ${
                                format.format === 'read'
                                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-700'
                              }`}
                            >
                              {format.format === 'read' ? 'Read online (VPN)' : `.${format.format}`}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleClearDownloadLinks}
                          className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear download links
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={handleRequestDownloadLinks}
                          className="px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all duration-300 border border-gray-700 hover:scale-105"
                        >
                          {isFlibustaSearching ? 
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Searching...
                            </span> : 
                            'Request download links'
                          }
                        </button>
                      </div>
                    )}

                    {/* Flibusta search results dropdown */}
                    {showFlibustaResults && flibustaResults.length > 0 && (
                      <div className="mt-4 border border-gray-800 rounded-md shadow-lg bg-gray-900 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="p-3 bg-gray-800 border-b border-gray-700">
                          <h4 className="text-sm font-medium text-white">Select a book variant:</h4>
                        </div>
                        {flibustaResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleVariantSelect(result)}
                            className="w-full p-3 text-left hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-sm text-white">{result.title}</div>
                            <div className="text-xs text-gray-400">{result.author}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Available formats: {result.formats.map((f: { format: string }) => f.format.toUpperCase()).join(', ')}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Error message */}
                    {flibustaError && (
                      <div className="mt-3 text-sm text-red-400">
                        {flibustaError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {textEditModal && (
        <div 
          id="textEditModal"
          className="fixed inset-0 flex items-center justify-center z-50"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setTextEditModal(null)}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-900"
              rows={4}
              value={textEditModal.text}
              onChange={(e) => setTextEditModal({ ...textEditModal, text: e.target.value })}
              autoFocus
              ref={textEditRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveText();
                } else if (e.key === 'Escape') {
                  setTextEditModal(null);
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  setShowFormatToolbar(prev => !prev);
                }
              }}
            />
            <FormatToolbar 
              onFormat={handleFormat}
              inputRef={textEditRef}
              isVisible={showFormatToolbar}
              onClose={() => setShowFormatToolbar(false)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTextEditModal(null)}
                className="border border-gray-400/50 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveText}
                className="border border-gray-400/50 text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-4xl max-h-screen p-4">
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-all"
              onClick={() => setFullscreenImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img
              src={fullscreenImage.url}
              alt={fullscreenImage.alt || 'Fullscreen image'}
              className="max-w-full max-h-[calc(100vh-8rem)] object-contain mx-auto shadow-xl"
              onError={(e) => {
                console.error('Fullscreen image failed to load:', fullscreenImage.url);
                e.currentTarget.src = 'https://via.placeholder.com/800x600?text=Image+Error';
              }}
            />
          </div>
        </div>
      )}

      {isLinkModalOpen && (
        <div onWheel={(e) => e.stopPropagation()}>
          <LinkModal
            onClose={() => setIsLinkModalOpen(false)}
            onLinkSubmit={handleAddLinkElement}
          />
        </div>
      )}

      {isImageModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black bg-opacity-80" onClick={() => setIsImageModalOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Upload Image</h2>
            <div className="mb-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
                className="w-full text-gray-900"
              />
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// Wrapper with suspense boundary
export default function MapsPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>}>
      <MapsContent />
    </Suspense>
  );
}