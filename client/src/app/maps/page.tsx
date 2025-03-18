'use client';

import { useState, useRef, useCallback, useEffect, useMemo, useContext, Suspense } from 'react';
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
        pointerEvents: 'none'
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
        pointerEvents: 'all'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onStartConnection(elementId, position, e);
      }}
    >
      {getArrowSymbol(position)}
      </div>
    </div>
  );
};

const DraggableElement = ({ 
  id, 
  left, 
  top, 
  text, 
  orientation,
  isSelected,
  onSelect,
  onStartConnection,
  onTransformChange,
  onTextChange,
  onDoubleClick,
  element,
  scale, // Add scale prop
  onResizeStateChange, // Add callback for resize state
  isAltPressed, // Add Alt key state
  isDuplicating, // Add duplicating state
  children, // Add children prop
}: {
  id: string;
  left: number;
  top: number;
  text: string;
  orientation: 'horizontal' | 'vertical';
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onTransformChange: (transform: { x: number; y: number } | null) => void;
  onTextChange: (id: string, newText: string) => void;
  onDoubleClick?: () => void;
  element: MapElement;
  scale: number; // Add scale type
  onResizeStateChange?: (isResizing: boolean) => void; // Add callback type
  isAltPressed?: boolean; // Alt key state
  isDuplicating?: boolean; // Duplicating mode
  children?: React.ReactNode; // Add children type
}) => {
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [startResize, setStartResize] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: isResizing || isEditing
  });

  // Default sizes if not provided in element
  const defaultWidth = orientation === 'horizontal' ? 160 : 140;
  const defaultHeight = orientation === 'horizontal' ? 128 : 200;
  
  // Use element widths and heights if provided, otherwise use defaults
  const elementWidth = element.width || defaultWidth;
  const elementHeight = element.height || defaultHeight;

  // Check if the element is a book (not resizable)
  const isBook = element.type === 'book';

  const currentTransform = useMemo(() => 
    transform ? { x: transform.x, y: transform.y } : null
  , [transform?.x, transform?.y]);

  useEffect(() => {
    onTransformChange(currentTransform);
  }, [currentTransform, onTransformChange]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle resize logic
  useEffect(() => {
    if (!isResizing) return;

    // Get the element's initial state before any resize operations
    const element = document.getElementById(id);
    if (!element) return;

    // Store the original element's position before any resize changes
    const rect = element.getBoundingClientRect();

    const handleResizeMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate delta from the start position in screen coordinates
      const dx = (e.clientX - startResize.x) / scale;
      const dy = (e.clientY - startResize.y) / scale;

      let newWidth = startResize.width;
      let newHeight = startResize.height;
      let newLeft = startResize.left;
      let newTop = startResize.top;

      // Handle different resize directions
      if (resizeDirection === 'right') {
        newWidth = Math.max(80, startResize.width + dx);
      } else if (resizeDirection === 'bottom') {
        newHeight = Math.max(40, startResize.height + dy);
      } else if (resizeDirection === 'left') {
        const widthChange = Math.min(dx, startResize.width - 80);
        newWidth = startResize.width - widthChange;
        newLeft = startResize.left + widthChange;
      } else if (resizeDirection === 'top') {
        const heightChange = Math.min(dy, startResize.height - 40);
        newHeight = startResize.height - heightChange;
        newTop = startResize.top + heightChange;
      } else if (resizeDirection === 'top-left') {
        const widthChange = Math.min(dx, startResize.width - 80);
        const heightChange = Math.min(dy, startResize.height - 40);
        newWidth = startResize.width - widthChange;
        newHeight = startResize.height - heightChange;
        newLeft = startResize.left + widthChange;
        newTop = startResize.top + heightChange;
      } else if (resizeDirection === 'top-right') {
        const heightChange = Math.min(dy, startResize.height - 40);
        newWidth = Math.max(80, startResize.width + dx);
        newHeight = startResize.height - heightChange;
        newTop = startResize.top + heightChange;
      } else if (resizeDirection === 'bottom-left') {
        const widthChange = Math.min(dx, startResize.width - 80);
        newWidth = startResize.width - widthChange;
        newHeight = Math.max(40, startResize.height + dy);
        newLeft = startResize.left + widthChange;
      } else if (resizeDirection === 'bottom-right') {
        newWidth = Math.max(80, startResize.width + dx);
        newHeight = Math.max(40, startResize.height + dy);
      }

      // Apply changes directly to the element's position and size
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      // Remove transform during resize to prevent conflicts
      element.style.transform = 'none';
      
      // Dispatch a resize-in-progress event to update connections in real-time
      const resizeEvent = new CustomEvent('element-resize-progress', {
        detail: {
          id,
          left: newLeft,
          top: newTop,
          width: newWidth,
          height: newHeight
        },
        bubbles: true
      });
      element.dispatchEvent(resizeEvent);
    };

    const handleResizeMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the final dimensions and position
      const finalWidth = parseFloat(element.style.width);
      const finalHeight = parseFloat(element.style.height);
      const finalLeft = parseFloat(element.style.left);
      const finalTop = parseFloat(element.style.top);

      // Create a custom event with the final position and size
      const event = new CustomEvent('element-resized', {
        detail: {
          id,
          left: finalLeft,
          top: finalTop,
          width: finalWidth,
          height: finalHeight,
          resetTransform: true
        },
        bubbles: true
      });
      
      // Clean up
      setIsResizing(false);
      setResizeDirection(null);
      
      // Dispatch event after state is updated
      setTimeout(() => {
        element.dispatchEvent(event);
      }, 0);

      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };

    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [isResizing, resizeDirection, startResize, id, scale]);

  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Enforce stopping propagation
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
      e.nativeEvent.stopPropagation();
    }
    
    if (!isSelected) {
      onSelect(id);
    }
    
    // Get the element
    const element = document.getElementById(id);
    if (!element) return;
    
    // Use the actual rendered size and position
    const renderedWidth = parseFloat(element.style.width) || elementWidth;
    const renderedHeight = parseFloat(element.style.height) || elementHeight;
    
    setIsResizing(true);
    setResizeDirection(direction);
    setStartResize({ 
      x: e.clientX, 
      y: e.clientY, 
      width: renderedWidth, 
      height: renderedHeight,
      left: left,
      top: top
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing) {
      e.stopPropagation();
      return;
    }
    setIsDragStarted(false);
    if (listeners?.onMouseDown) {
      listeners.onMouseDown(e);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragStarted && !isResizing) {
      onSelect(id);
    }
    setIsDragStarted(false);
  };

  const handleDragStart = () => {
    setIsDragStarted(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      setIsEditing(true);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    }
  };

  // Add a ref for the author segment bottom connection
  const authorBottomRef = useRef<HTMLDivElement>(null);
  
  // Update the author bottom ref position
  useEffect(() => {
    if (element.type === 'book') {
      const bookElement = document.getElementById(id);
      if (!bookElement) return;
      
      const updateAuthorRef = () => {
        if (!authorBottomRef.current) return;
        
        const authorElement = bookElement.querySelector('.author-segment');
        if (authorElement) {
          const authorRect = authorElement.getBoundingClientRect();
          const bookRect = bookElement.getBoundingClientRect();
          
          // Position the ref at the bottom of the author element
          authorBottomRef.current.style.left = `${bookRect.width / 2}px`;
          authorBottomRef.current.style.top = `${authorRect.bottom - bookRect.top}px`;
        }
      };
      
      // Initial update
      updateAuthorRef();
      
      // Set up observer to watch for changes
      const observer = new MutationObserver(updateAuthorRef);
      observer.observe(bookElement, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['style', 'class'] 
      });
      
      return () => observer.disconnect();
    }
  }, [element.type, id]);

  // Notify parent when resize state changes
  useEffect(() => {
    if (onResizeStateChange) {
      onResizeStateChange(isResizing);
    }
  }, [isResizing, onResizeStateChange]);

  return (
    <>
      <div
        ref={setNodeRef}
        id={id}
        data-type={element.type}
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          opacity: isDragging ? (isDuplicating ? 0.3 : 0.5) : 1,
          // When duplicating, don't apply the transform to the original element
          transform: isDragging && isDuplicating ? 'none' : (transform ? `translate3d(${transform.x / scale}px, ${transform.y / scale}px, 0)` : undefined),
          width: `${elementWidth}px`,
          height: `${elementHeight}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          border: isSelected ? '2px solid rgb(59, 130, 246)' : '1px solid #ccc',
          borderRadius: '8px',
          cursor: isEditing ? 'text' : isResizing ? 'nwse-resize' : (isAltPressed ? 'copy' : 'move'),
          userSelect: 'none',
          boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
          backgroundImage: isSelected && text.includes('book') ? `url(${text})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: isSelected ? 20 : 10,
        }}
        className={`map-element ${isSelected ? 'selected' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDragStart={handleDragStart}
        onDoubleClick={handleDoubleClick}
        {...(isEditing || isResizing ? {} : { ...attributes, ...listeners })}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            name={`element-text-${id}`}
            value={text}
            onChange={(e) => onTextChange(id, e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              textAlign: 'center',
              width: '90%',
              padding: '4px',
              fontSize: '16px',
              outline: 'none',
              cursor: 'text',
              color: '#000',
              userSelect: 'text',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {children ? children : (
              <span 
                className="text-gray-800 px-2" 
                style={{ fontSize: '16px', pointerEvents: 'none' }}
              >
                <ReactMarkdown components={{
                  p: ({ children }) => <span style={{ pointerEvents: 'none' }}>{children}</span>,
                  strong: ({ children }) => <strong style={{ pointerEvents: 'none' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ pointerEvents: 'none' }}>{children}</em>
                }}>
                  {text}
                </ReactMarkdown>
              </span>
            )}
            
            {/* Reference element for author bottom connection */}
            {element.type === 'book' && (
              <div
                id={`${id}-author-bottom`}
                ref={authorBottomRef}
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '1px',
                  height: '1px'
                }}
              />
            )}
          </>
        )}
      </div>
      
      {/* Add a ghost element when duplicating */}
      {isDragging && isDuplicating && transform && (
        <div
          style={{
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            transform: `translate3d(${transform.x / scale}px, ${transform.y / scale}px, 0)`,
            width: `${elementWidth}px`,
            height: `${elementHeight}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            border: '2px dashed rgb(59, 130, 246)',
            borderRadius: '8px',
            opacity: 0.8,
            pointerEvents: 'none',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 30,
          }}
          className="element-duplicate-ghost"
        >
          <div style={{ opacity: 0.7 }}>
            {element.type === 'book' && element.bookData ? (
              <div className="w-full h-full" style={{ opacity: 0.85 }}>
                {/* Simple book preview */}
                <div className="text-center px-2 py-1 text-sm truncate">
                  {element.bookData.title}
                </div>
              </div>
            ) : (
              <div className="text-center px-2 py-1 text-sm truncate" style={{ pointerEvents: 'none' }}>
                <ReactMarkdown components={{
                  p: ({ children }) => <span style={{ pointerEvents: 'none' }}>{children}</span>,
                  strong: ({ children }) => <strong style={{ pointerEvents: 'none' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ pointerEvents: 'none' }}>{children}</em>
                }}>
                  {text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Resize handles in a separate container outside the draggable element */}
      {isSelected && !isBook && (
        <div 
          className="resize-handles-container"
          style={{
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            width: `${elementWidth}px`,
            height: `${elementHeight}px`,
            pointerEvents: 'none',
            zIndex: 30,
            transform: transform ? `translate3d(${transform.x / scale}px, ${transform.y / scale}px, 0)` : undefined,
          }}
        >
          {/* Corner resize handles - KEEPING THESE but hiding when resizing */}
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize" 
            style={{ top: '-8px', left: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
          />
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nesw-resize" 
            style={{ top: '-8px', right: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
          />
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nesw-resize" 
            style={{ bottom: '-8px', left: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
          />
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize" 
            style={{ bottom: '-8px', right: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
          />
          
          {/* Edge resize areas - replacing small dots with full edge areas */}
          <div 
            className="absolute h-2 cursor-ns-resize" 
            style={{ top: '-4px', left: '8px', right: '8px', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
          />
          <div 
            className="absolute w-2 cursor-ew-resize" 
            style={{ top: '8px', right: '-4px', bottom: '8px', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
          />
          <div 
            className="absolute h-2 cursor-ns-resize" 
            style={{ bottom: '-4px', left: '8px', right: '8px', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
          />
          <div 
            className="absolute w-2 cursor-ew-resize" 
            style={{ top: '8px', left: '-4px', bottom: '8px', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
          />
        </div>
      )}
    </>
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

const SearchModal = ({ onClose, onBookSubmit }: { 
  onClose: () => void;
  onBookSubmit: (bookData: BookSearchResult) => void;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [activeApi, setActiveApi] = useState<'openlib' | 'google' | 'alphy'>('openlib');
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [confirmedBook, setConfirmedBook] = useState<BookSearchResult | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [displayAll, setDisplayAll] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFlibustaSearching, setIsFlibustaSearching] = useState(false);
  const [flibustaResults, setFlibustaResults] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [showFlibustaResults, setShowFlibustaResults] = useState(false);
  const [flibustaError, setFlibustaError] = useState<string | null>(null);
  const resultsPerPage = 10;
  const searchCache = useRef<{[key: string]: { timestamp: number; results: any }}>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedResults = (cacheKey: string): { combinedResults: BookSearchResult[]; total: number } | null => {
    const cached = searchCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.results;
    }
    return null;
  };

  const setCachedResults = (cacheKey: string, results: { combinedResults: BookSearchResult[]; total: number }) => {
    searchCache.current[cacheKey] = {
      timestamp: Date.now(),
      results
    };
  };

  const handleParallelSearch = async (page = 1) => {
    console.log('handleParallelSearch called with:', {
      activeApi,
      isLoading,
      searchTerm,
      displayAll,
      page
    });
    
    if (isLoading) {
      console.log('Search blocked due to isLoading');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Only reset search results if this is a new search (page 1)
    // For pagination, we'll append results instead
    const isNewSearch = page === 1;
    if (isNewSearch) {
      setSearchResults([]);
      setHasSearched(true);
    }
    
    // Update the current page
    setCurrentPage(page);

    try {
      console.log('Starting search with API:', activeApi);
      if (activeApi === 'alphy') {
        if (!searchTerm.trim() && !displayAll) {
          setIsLoading(false);
          setSearchResults([]);
          setTotalResults(0);
          return;
        }
        const result = await handleAlphySearch(page);
        console.log('Alphy search completed:', result);
        
        // Append results if loading more pages, otherwise replace
        if (page > 1) {
          setSearchResults(prevResults => [...prevResults, ...result.books]);
        } else {
          setSearchResults(result.books);
        }
        
        setTotalResults(result.total);
      } else if (searchTerm.trim()) {
        console.log('External API search starting');
        const cacheKey = `${activeApi}-${searchTerm}-${page}`;
        const cachedResults = getCachedResults(cacheKey);

        if (cachedResults) {
          console.log('Using cached results');
          
          // Append results if loading more pages, otherwise replace
          if (page > 1) {
            setSearchResults(prevResults => [...prevResults, ...cachedResults.combinedResults]);
          } else {
            setSearchResults(cachedResults.combinedResults);
          }
          
          setTotalResults(cachedResults.total);
        } else {
          // For page 1, we need both database and external results
          // For page > 1, we only need additional external results
          let databaseResults: BookSearchResult[] = [];
          
          if (page === 1) {
            databaseResults = await searchDatabase(searchTerm);
          }
          
          const externalResults = await (activeApi === 'openlib' ? 
            handleOpenLibSearch : handleGoogleSearch)(page);
          
          // Filter out books that already exist in the database
          const filteredExternalResults = externalResults.books.filter((externalBook: BookSearchResult) => {
            const externalAuthor = Array.isArray(externalBook.author_name) 
              ? externalBook.author_name[0] 
              : externalBook.author_name;
              
            return !databaseResults.some((dbBook: BookSearchResult) => 
              dbBook.title.toLowerCase() === externalBook.title.toLowerCase() &&
              dbBook.author_name?.[0]?.toLowerCase() === externalAuthor?.toLowerCase()
            );
          });

          // Prepare combined results
          const newResults = page === 1 
            ? [...databaseResults, ...filteredExternalResults] 
            : filteredExternalResults;
          
          // Cache the results for this page
          setCachedResults(cacheKey, {
            combinedResults: newResults,
            total: externalResults.total
          });

          // Update state - append for page > 1, replace for page 1
          if (page > 1) {
            setSearchResults(prevResults => [...prevResults, ...newResults]);
          } else {
            setSearchResults(newResults);
          }
          
          setTotalResults(externalResults.total);
        }
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      if (page === 1) {
        setSearchResults([]);
        setTotalResults(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleParallelSearch(1);
    }
  };

  // Memoize book filtering logic
  const filteredResults = useMemo(() => {
    return searchResults.map((book, index) => {
      const isFirstExternalResult = index > 0 && 
        searchResults[index - 1].source === 'alphy' && 
        book.source !== 'alphy' &&
        activeApi !== 'alphy';

      return {
        book,
        isFirstExternalResult,
        hasDbResults: searchResults.some(b => b.source === 'alphy')
      };
    });
  }, [searchResults, activeApi]);

  const GOOGLE_BOOKS_API_KEY = 'AIzaSyB2DtSUPFGE0aV_ehA6M9Img7XqO8sr8-Y';

  const fetchOpenLibraryDetails = async (key: string) => {
    try {
      const response = await fetch(`https://openlibrary.org${key}.json`);
      if (!response.ok) throw new Error('Failed to fetch book details from Open Library');
      const data = await response.json();
      return data.description?.value || data.description || null;
    } catch (error) {
      console.error('Error fetching Open Library details:', error);
      return null;
    }
  };

  const fetchGoogleBooksDetails = async (id: string) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${id}?key=${GOOGLE_BOOKS_API_KEY}`
      );
      if (!response.ok) throw new Error('Failed to fetch book details from Google Books');
      const data = await response.json();
      return data.volumeInfo?.description || null;
    } catch (error) {
      console.error('Error fetching Google Books details:', error);
      return null;
    }
  };

  const handleOpenLibSearch = async (page = 1): Promise<{ books: BookSearchResult[]; total: number }> => {
    const offset = (page - 1) * resultsPerPage;
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}&offset=${offset}&limit=${resultsPerPage}`
      );
      if (!response.ok) throw new Error('Failed to fetch from Open Library');
      const data = await response.json();
      return {
        books: data.docs.map((doc: any) => ({
          key: doc.key,
          title: doc.title,
          author_name: doc.author_name,
          first_publish_year: doc.first_publish_year,
          thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : undefined,
          highResThumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
          source: 'openlib' as const
        })),
        total: data.numFound
      };
    } catch (error) {
      throw new Error('Error fetching from Open Library. Please try again.');
    }
  };

  const handleGoogleSearch = async (page = 1): Promise<{ books: BookSearchResult[]; total: number }> => {
    const startIndex = (page - 1) * resultsPerPage;
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&startIndex=${startIndex}&maxResults=${resultsPerPage}&key=${GOOGLE_BOOKS_API_KEY}`
      );
      if (!response.ok) throw new Error('Failed to fetch from Google Books');
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Error fetching from Google Books');
      }

      return {
        books: data.items?.map((item: any) => {
          // Get the base image URL without zoom parameter
          const baseImageUrl = item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:')?.split('&zoom=')[0];
          
          return {
            key: item.id,
            title: item.volumeInfo.title,
            author_name: item.volumeInfo.authors,
            first_publish_year: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate) : undefined,
            thumbnail: baseImageUrl ? `${baseImageUrl}&zoom=1` : undefined, // zoom=1 for small thumbnail
            highResThumbnail: baseImageUrl ? `${baseImageUrl}&zoom=2` : undefined, // zoom=2 for higher resolution
            source: 'google' as const
          };
        }) || [],
        total: data.totalItems || 0
      };
    } catch (error) {
      throw new Error('Error fetching from Google Books. Please try again.');
    }
  };

  const handleAlphySearch = async (page = 1): Promise<{ books: BookSearchResult[]; total: number }> => {
    try {
      const endpoint = displayAll 
        ? `/api/books?page=${page}&limit=${resultsPerPage}` 
        : `/api/books?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${resultsPerPage}`;

      const response = await api.get(endpoint);
      const data = response.data;
      
      const books = data.books.map((book: any) => ({
        key: book._id,
        _id: book._id,
        title: book.title,
        author_name: [book.author],
        thumbnail: book.coverImage,
        description: book.description,
        source: 'alphy' as const,
        publishedYear: book.publishedYear,
        flibustaStatus: book.flibustaStatus,
        flibustaVariants: book.flibustaVariants
      }));

      return {
        books,
        total: data.pagination.total
      };
    } catch (error) {
      throw new Error('Error fetching from Alphy database');
    }
  };

  const searchDatabase = async (searchTerm: string): Promise<BookSearchResult[]> => {
    try {
      const response = await api.get(`/api/books?search=${encodeURIComponent(searchTerm)}&limit=5`);
      const data = response.data;
      
      return data.books.map((book: any) => ({
        key: book._id,
        _id: book._id,
        title: book.title,
        author_name: [book.author],
        thumbnail: book.coverImage,
        description: book.description,
        source: 'alphy' as const,
        publishedYear: book.publishedYear,
        inDatabase: true,
        flibustaStatus: book.flibustaStatus,
        flibustaVariants: book.flibustaVariants
      }));
    } catch (error) {
      console.error('Error searching database:', error);
      return [];
    }
  };

  const handleBookClick = async (book: BookSearchResult) => {
    if (selectedBook?.key === book.key) {
      if (book.source === 'alphy') {
        // If it's an Alphy book, create map element directly
        onBookSubmit(book);
        onClose();
        return;
      }

      setIsLoadingDetails(true);
      try {
        const description = await (book.source === 'openlib' 
          ? fetchOpenLibraryDetails(book.key)
          : fetchGoogleBooksDetails(book.key));
        
        setConfirmedBook({
          ...book,
          description
        });
      } catch (error) {
        console.error('Error fetching book details:', error);
        setConfirmedBook(book);
      } finally {
        setIsLoadingDetails(false);
      }
    } else {
      setSelectedBook(book);
    }
  };

  const handleBackToSearch = () => {
    setConfirmedBook(null);
    setSelectedBook(null);
  };

  const handleRequestDownloadLinks = async () => {
    if (!confirmedBook) return;
    
    setIsFlibustaSearching(true);
    setFlibustaError(null);
    setShowFlibustaResults(true);

    try {
      const response = await api.get(`/api/books/flibusta/search?query=${encodeURIComponent(confirmedBook.title)}`);
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

  const handleFinalSubmit = async () => {
    if (!confirmedBook) return;

    try {
      // Step 1: Save book to database (without download links)
      const response = await api.post('/api/books', {
        title: confirmedBook.title,
        author: Array.isArray(confirmedBook.author_name) 
          ? confirmedBook.author_name.join(', ') 
          : confirmedBook.author_name || 'Unknown',
        description: confirmedBook.description || '',
        coverImage: confirmedBook.thumbnail || '',
        publishedYear: confirmedBook.first_publish_year,
        flibustaStatus: 'not_checked' // Start with not_checked status
      });

      const savedBook = response.data;
      console.log('Book saved successfully:', savedBook);
      
      // Step 2: If we have selected variant, save download links
      if (selectedVariant && savedBook._id) {
        console.log('Saving download links for book:', savedBook._id);
        console.log('Selected variant data:', selectedVariant);
        
        try {
          // Use the save-flibusta endpoint to save download links
          const linkResponse = await api.post(`/api/books/${savedBook._id}/save-flibusta`, {
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
          });
          
          console.log('Download links saved successfully:', linkResponse.data);
          
          // Update the bookData with flibustaVariants and status from the response
          const bookData: BookSearchResult = {
            ...confirmedBook,
            _id: linkResponse.data._id,
            flibustaStatus: 'uploaded',
            flibustaVariants: linkResponse.data.flibustaVariants
          };

          onBookSubmit(bookData);
          onClose();
          toast.success('Book saved with download links!');
          return;
        } catch (linkError) {
          console.error('Error saving download links:', linkError);
          toast.error('Book saved but failed to save download links');
        }
      }
      
      // If we didn't save download links or it failed, just use the saved book data
      const bookData: BookSearchResult = {
        ...confirmedBook,
        _id: savedBook._id,
        flibustaStatus: savedBook.flibustaStatus,
        flibustaVariants: savedBook.flibustaVariants
      };

      onBookSubmit(bookData);
      onClose();
      toast.success('Book saved successfully!');
    } catch (error) {
      console.error('Error saving book:', error);
      toast.error('Failed to save book. Please try again.');
    }
  };

  useEffect(() => {
    console.log('API changed to:', activeApi);
    handleParallelSearch(1);
  }, [activeApi, displayAll]);

  if (confirmedBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={onClose}></div>
        
        <div 
          className="bg-black border border-gray-800 rounded-xl w-[800px] h-[85vh] relative flex flex-col overflow-hidden"
          style={{
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
            background: 'linear-gradient(to bottom right, #0a0a0a, #000000)'
          }}
        >
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <button
                onClick={handleBackToSearch}
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
                <span>Back to search</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-12">
              {/* Book cover */}
              <div className="w-full md:w-64 flex-shrink-0">
                <div className="relative group">
                  {confirmedBook.thumbnail ? (
                    <img 
                      src={confirmedBook.highResThumbnail || confirmedBook.thumbnail} 
                      alt={confirmedBook.title}
                      className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                      onError={(e) => {
                        if (e.currentTarget.src !== confirmedBook.thumbnail) {
                          e.currentTarget.src = confirmedBook.thumbnail || '';
                        }
                      }}
                    />
                  ) : (
                    <div 
                      className="w-full h-96 bg-gray-900 flex items-center justify-center shadow-lg" 
                      style={{ 
                        borderRadius: '4px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <span className="text-gray-600">No cover</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                </div>
              </div>

              {/* Book details */}
              <div className="flex-1 mt-4 md:mt-0">
                <h2 className="text-3xl font-bold text-white mb-3">{confirmedBook.title}</h2>
                {confirmedBook.author_name && (
                  <p className="text-lg text-gray-300 mb-6 font-light">
                    {Array.isArray(confirmedBook.author_name) 
                      ? confirmedBook.author_name.join(', ') 
                      : confirmedBook.author_name}
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
                  <h3 className="text-gray-200 text-lg font-medium mb-3">About this book</h3>
                  {isEditingDescription ? (
                    <div>
                      <textarea
                        value={confirmedBook.description || ''}
                        onChange={(e) => {
                          setConfirmedBook({
                            ...confirmedBook,
                            description: e.target.value
                          });
                        }}
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
                  ) : confirmedBook.description ? (
                    <div>
                      <p className="text-gray-400 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                        {showFullDescription 
                          ? confirmedBook.description
                          : confirmedBook.description.slice(0, 420)}
                      </p>
                      {confirmedBook.description.length > 420 && (
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
                  <h3 className="text-gray-200 text-lg font-medium mb-4">Download options</h3>
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
                        onClick={handleFinalSubmit}
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
                      <button
                        onClick={handleFinalSubmit}
                        className="mt-4 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700"
                      >
                        Save Book Without Links
                      </button>
                    </div>
                  )}

                  {/* Flibusta search results dropdown */}
                  {showFlibustaResults && flibustaResults.length > 0 && (
                    <div className="mt-4 border border-gray-800 rounded-md shadow-lg bg-gray-900 max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="p-3 bg-gray-800 border-b border-gray-700">
                        <h4 className="text-sm font-medium text-white">Select a book variant:</h4>
                      </div>
                      {flibustaResults.map((result: any) => (
                        <button
                          key={result.id}
                          onClick={() => handleVariantSelect(result)}
                          className="w-full p-3 text-left hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-sm text-white">{result.title}</div>
                          <div className="text-xs text-gray-400">{result.author}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Available formats: {result.formats.map((f: any) => f.format.toUpperCase()).join(', ')}
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
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div 
        className="bg-black rounded-lg w-[800px] h-[800px] relative flex flex-col border border-gray-800 overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #0a0a0a, #000000)',
          boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="p-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDisplayAll(false);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter book name...."
              className="flex-1 px-4 py-2 rounded-md bg-[#080808] border border-gray-800 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={() => handleParallelSearch(1)}
              className="px-6 py-2 rounded-md bg-[#080808] text-white text-base font-medium hover:bg-gray-900 border border-gray-800"
            >
              Search
            </button>
          </div>
          
          {/* API Toggle */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                console.log('OpenLib button clicked');
                setActiveApi('openlib');
                setDisplayAll(false);
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'openlib'
                  ? 'bg-white text-black'
                  : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
              }`}
            >
              Openlibrary
            </button>
            <button
              onClick={() => {
                console.log('Google button clicked');
                setActiveApi('google');
                setDisplayAll(false);
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'google'
                  ? 'bg-white text-black'
                  : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
              }`}
            >
              Google Books
            </button>
            
            {/* Combined Alphy button with Display all */}
            <div className="flex items-stretch">
              <button
                onClick={() => {
                  setActiveApi('alphy');
                  setDisplayAll(false);
                  setSearchResults([]);
                  setHasSearched(false);
                }}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  activeApi === 'alphy'
                    ? 'bg-white text-black'
                    : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
                } ${activeApi === 'alphy' ? 'rounded-l-md border-r-0' : 'rounded-md'}`}
              >
                Alphy
              </button>
              {activeApi === 'alphy' && (
                <button
                  onClick={() => {
                    const newDisplayAll = !displayAll;
                    setDisplayAll(newDisplayAll);
                    setSearchTerm('');
                    setSearchResults([]);
                  }}
                  className={`px-3 py-1 text-sm font-medium transition-colors rounded-r-md ${
                    displayAll
                      ? 'bg-white text-black border border-white'
                      : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800'
                  }`}
                >
                  All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content area with class for scroll position management */}
        <div className="flex-1 px-6 overflow-y-auto search-results-container custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-center">{error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map(({ book, isFirstExternalResult, hasDbResults }) => (
                <div key={book.key}>
                  {isFirstExternalResult && hasDbResults && (
                    <div className="border-t border-gray-800 my-4 pt-2" />
                  )}
                  <div
                    className={`p-3 hover:bg-gray-900 cursor-pointer border-b border-gray-800 flex gap-3 ${
                      selectedBook?.key === book.key ? 'bg-gray-900' : ''
                    }`}
                    onClick={() => handleBookClick(book)}
                  >
                    {book.thumbnail ? (
                      <img 
                        src={book.thumbnail} 
                        alt={book.title}
                        className="w-12 h-auto object-cover"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-gray-800 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No cover</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {book.title}
                        {book.source === 'alphy' && (
                          <span className="ml-2 text-xs text-green-500 font-normal">
                            In database
                          </span>
                        )}
                      </h3>
                      {book.author_name && (
                        <p className="text-sm text-gray-400">
                          by {Array.isArray(book.author_name) ? book.author_name.join(', ') : book.author_name}
                          {book.first_publish_year && ` (${book.first_publish_year})`}
                        </p>
                      )}
                      {selectedBook?.key === book.key && (
                        <p className="text-sm text-blue-400 mt-1">Click again to confirm selection</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Suggestions for different APIs */}
              {searchTerm.trim() && hasSearched && searchResults.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-600">
                  {(activeApi === 'openlib' || activeApi === 'alphy') && (
                    "Haven't found what you were looking for? Switch to Google Books."
                  )}
                </div>
              )}

              {/* Pagination */}
              {searchResults.length > 0 && currentPage * resultsPerPage < totalResults && (
                <div className="flex justify-center py-3">
                  <button
                    onClick={() => handleParallelSearch(currentPage + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm bg-gray-800 text-gray-400 hover:text-gray-200 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        Load more results
                        <svg 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 9l-7 7-7-7" 
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(20, 20, 20, 0.8);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(80, 80, 80, 0.8);
            border-radius: 3px;
            transition: background 0.3s;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 100, 100, 0.9);
          }
        `}</style>

        {/* Bottom buttons */}
        <div className="flex mt-auto">
          {confirmedBook ? (
            <>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 py-4 text-base font-medium bg-gray-300 hover:bg-gray-400 rounded-br-lg text-gray-900"
              >
                {selectedVariant ? 'Save book with download links' : 'Save book'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-4 text-base font-medium bg-gray-800 hover:bg-gray-700 border-t border-gray-700 text-gray-300 rounded-b-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
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
        <h2 className="text-2xl font-bold mb-4">Add Link</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2" htmlFor="url">
              URL (required)
            </label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
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

// Wrap everything in a Suspense boundary
export default function MapsPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>}>
      <MapsPageContent />
    </Suspense>
  );
}

// Client component with the search params
function MapsPageContent(): JSX.Element {
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
  const searchParams = useSearchParams();
  
  // ... rest of the implementation ...
  
  // Return the JSX that was previously in MapsPage
  return (
    <div>
      {/* Your existing JSX here */}
      <div>Implementation moved to MapsPageContent</div>
    </div>
  );
}