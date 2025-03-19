'use client';

import { useState, useRef, useCallback, useEffect, useMemo, useContext } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragMoveEvent, Modifier } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import Xarrow, { Xwrapper } from 'react-xarrows';
import Link from 'next/link';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

interface MapElement {
  id: string;
  type: 'element' | 'book' | 'line' | 'image' | 'link';
  left: number;
  top: number;
  width?: number;
  height?: number;
  text: string;
  orientation: 'horizontal' | 'vertical';
  isMediaCollapsed?: boolean; // Add property to track if media is collapsed
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
    // Check if the event originated from a control element
    if (e.target instanceof Element) {
      const isControlElement = e.target.closest('[data-control]');
      if (isControlElement) {
        e.stopPropagation();
        return; // Don't handle the mousedown if it came from a control
      }
    }
    
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
    // Check if the event originated from a control element
    if (e.target instanceof Element) {
      const isControlElement = e.target.closest('[data-control]');
      if (isControlElement) {
        return; // Don't select element if click was on a control
      }
    }
    
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
        onClick={handleClick}
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
                style={{ fontSize: '16px' }}
              >
                {text}
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
              <div className="text-center px-2 py-1 text-sm truncate">
                {text}
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
}) => {
  const [transform, setTransform] = useState<{ x: number; y: number } | null>(null);
  const [isElementResizing, setIsElementResizing] = useState(false);
  
  // Handle media collapse state
  const toggleMediaCollapse = (e: React.MouseEvent) => {
    // Ensure the event doesn't propagate to parent elements
    e.stopPropagation();
    e.preventDefault();
    
    // Make sure to stop immediate propagation as well
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
      e.nativeEvent.stopPropagation();
    }
    
    // Update the element in the elements array
    const event = new CustomEvent('toggle-media-collapse', {
      detail: {
        id: element.id
      },
      bubbles: true
    });
    document.dispatchEvent(event);
  };
  
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
          <div className="image-element" style={{ width: '100%', height: '100%' }}>
            <img 
              src={element.imageData.url} 
              alt={element.imageData.alt || 'Uploaded image'}
              className="w-full h-full object-cover"
              style={{ 
                borderRadius: '4px',
                pointerEvents: 'none' // Prevents image from capturing mouse events
              }}
            />
          </div>
        ) : element.type === 'link' && element.linkData ? (
          <div className="w-full h-full flex flex-col overflow-hidden rounded-md relative">
            {/* Collapse/Expand button */}
            {hasMedia && (
              <div 
                className="absolute z-20"
                style={{ 
                  right: '6px', 
                  top: element.isMediaCollapsed ? '50%' : '6px', 
                  transform: element.isMediaCollapsed ? 'translateY(-50%)' : 'none',
                  pointerEvents: 'auto',
                  isolation: 'isolate', // Ensures the element is isolated from parent
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  // Prevent selection by immediately dispatching the event
                  const event = new CustomEvent('toggle-media-collapse', {
                    detail: { id: element.id },
                    bubbles: false
                  });
                  document.dispatchEvent(event);
                  
                  return false;
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  return false;
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  return false;
                }}
                data-control="media-collapse-toggle"
              >
                <div
                  className="hover:bg-blue-50 transition-colors"
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="text-gray-600"
                    style={{ 
                      transform: element.isMediaCollapsed ? 'rotate(-90deg)' : 'rotate(90deg)',
                      transition: 'transform 0.3s ease-in-out'
                    }}
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            )}

            {/* Media content - conditionally rendered based on collapse state */}
            {!element.isMediaCollapsed && (
              <>
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
                      className="w-full h-full object-cover"
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
              </>
            )}

            {/* Text content */}
            <div className={`p-2 flex-1 flex flex-col ${element.isMediaCollapsed ? 'h-full' : ''}`}>
              <div className="font-medium text-gray-800 line-clamp-2 text-sm flex items-center">
                <span className="flex-1">{element.linkData.title || element.linkData.url || "Link"}</span>
              </div>
              {element.linkData.description && !element.isMediaCollapsed && (
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
            style={{ fontSize: '16px' }}
          >
            {element.text}
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
              isSelected={true} 
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

  const getCachedResults = (cacheKey: string) => {
    const cached = searchCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.results;
    }
    return null;
  };

  const setCachedResults = (cacheKey: string, results: any) => {
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
          setSearchResults([]);
          setTotalResults(0);
          return;
        }
        const result = await handleAlphySearch(page);
        console.log('Alphy search completed:', result);
        
        // Append results if loading more pages, otherwise replace
        if (page > 1) {
          setSearchResults(prev => [...prev, ...result.books]);
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
          setSearchResults(cachedResults.combinedResults);
          setTotalResults(cachedResults.total);
        } else {
          const [databaseResults, externalResults] = await Promise.all([
            searchDatabase(searchTerm),
            (activeApi === 'openlib' ? handleOpenLibSearch : handleGoogleSearch)(page)
          ]);

          const filteredExternalResults = externalResults.books.filter((externalBook: BookSearchResult) => {
            const externalAuthor = Array.isArray(externalBook.author_name) 
              ? externalBook.author_name[0] 
              : externalBook.author_name;
              
            return !databaseResults.some((dbBook: BookSearchResult) => 
              dbBook.title.toLowerCase() === externalBook.title.toLowerCase() &&
              dbBook.author_name?.[0]?.toLowerCase() === externalAuthor?.toLowerCase()
            );
          });

          const combinedResults = [...databaseResults, ...filteredExternalResults];
          
          setCachedResults(cacheKey, {
            combinedResults,
            total: externalResults.total
          });

          setSearchResults(combinedResults);
          setTotalResults(externalResults.total);
        }
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const handleOpenLibSearch = async (page = 1) => {
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

  const handleGoogleSearch = async (page = 1) => {
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

  const handleAlphySearch = async (page = 1) => {
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

  const searchDatabase = async (searchTerm: string) => {
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
    console.log('Selected variant:', variant);
    const originalVariant = {
      id: variant.id,
      title: variant.title,
      author: variant.author,
      formats: variant.formats.map((format: any) => ({
        format: format.format,
        url: `/api/books/flibusta/download/${variant.id}/${format.format}`
      }))
    };
    console.log('Processed variant:', originalVariant);

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
          // Update savedBook with the new data that includes download links
          savedBook.flibustaStatus = 'uploaded';
          savedBook.flibustaVariants = linkResponse.data.flibustaVariants;
        } catch (linkError) {
          console.error('Error saving download links:', linkError);
          toast.error('Book saved but failed to save download links');
        }
      }
      
      // Create map element with the saved book data
      const bookData: BookSearchResult = {
        ...confirmedBook,
        _id: savedBook._id,
        flibustaStatus: savedBook.flibustaStatus,
        flibustaVariants: savedBook.flibustaVariants
      };

      onBookSubmit(bookData);
        onClose();
      
      // Show success message
      if (selectedVariant && savedBook.flibustaStatus === 'uploaded') {
        toast.success('Book saved with download links!');
      } else {
        toast.success('Book saved successfully!');
      }
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

                                if (!selectedVariant?.id) {
                                  console.error('Selected variant ID not found');
                                  toast.error('Download link not available');
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
            <div className="flex rounded-md overflow-hidden">
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
                    : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800 border-r-0'
                }`}
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
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
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    displayAll
                      ? 'bg-white text-black'
                      : 'bg-[#080808] text-white hover:bg-gray-900 border border-gray-800 border-l-0'
                  }`}
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                >
                  Display all from Alphy
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
                    className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-800 text-gray-400 hover:text-gray-200 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
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
              className="flex-1 py-4 text-base font-medium bg-gray-200 hover:bg-gray-300 rounded-b-lg text-gray-900"
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
    if (!isSelected) {
      onSelect(element.id);
      return;
    }
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
          title: title || processedUrl,
          displayUrl: displayUrl,
          youtubeVideoId
        });
      }
      onClose();
    } catch (error) {
      console.error('Error fetching link preview:', error);
      // Use basic data on error
      onLinkSubmit({
        url: url,
        title: title || url,
        displayUrl: url.replace(/^https?:\/\/(?:www\.)?/i, '')
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
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

export default function MapsPage() {
  const [elements, setElements] = useState<MapElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; point: 'top' | 'right' | 'bottom' | 'left' } | null>(null);
  const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);
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
    const canvasWidth = 1800;
    const canvasHeight = 1800;
    
    return {
      x: (viewportWidth - canvasWidth) / 2,
      y: (viewportHeight - canvasHeight) / 2
    };
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    const canvasWidth = 1800;
    const canvasHeight = 1800;
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
    const canvasWidth = 1800;
    const canvasHeight = 1800;
    
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
    const canvasWidth = 1800;
    const canvasHeight = 1800;

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
            id: `connection-${Date.now()}`,
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
      const canvasWidth = 1800;
      const canvasHeight = 1800;

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
    const canvasWidth = 1800;
    const canvasHeight = 1800;

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
        flibustaVariants: bookData.flibustaVariants
      }
    };

    setElements(prev => [...prev, newElement]);
  };

  const handleElementDoubleClick = (element: MapElement) => {
    if (element.type === 'book') {
      setBookDetailsModal(element);
    } else if (element.type === 'element') {
      setTextEditModal({ id: element.id, text: element.text });
    } else if (element.type === 'image' && element.imageData) {
      setFullscreenImage({
        url: element.imageData.url,
        alt: element.imageData.alt || 'Image'
      });
    } else if (element.type === 'link' && element.linkData) {
      // Open link in a new tab
      window.open(element.linkData.url, '_blank');
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
      const response = await api.get(`/api/books/flibusta/search?query=${encodeURIComponent(bookDetailsModal.bookData.title)}`);
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
          const bookResponse = await api.get(`/api/books/by-key/${bookDetailsModal.bookData.key}`);
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
            
            // Also update the modal
            setBookDetailsModal(prev => {
              if (!prev) return null;
              return {
                ...prev,
                bookData: {
                  ...prev.bookData!,
                  _id: bookId
                }
              };
            });
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
      
      // Update the book in the database using the correct endpoint
      const response = await api.post(`/api/books/${bookId}/save-flibusta`, {
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
    // Remove the control key requirement
    e.preventDefault();
    
    const ZOOM_SENSITIVITY = 0.001;
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    
    setScaleState(prevScale => {
      const newScale = Math.min(Math.max(0.35, prevScale + delta), 2);
      
      // Adjust position to zoom towards cursor
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newX = canvasPosition.x - (mouseX * (newScale - prevScale));
        const newY = canvasPosition.y - (mouseY * (newScale - prevScale));
        
        setCanvasPosition({ x: newX, y: newY });
      }
      
      return newScale;
    });
  }, [canvasPosition]);

  // Add keyboard shortcut handler for zooming
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setScaleState(prevScale => Math.min(prevScale + 0.35, 2));
      } else if (e.key === '-') {
        e.preventDefault();
        setScaleState(prevScale => Math.max(prevScale - 0.1, 0.1));
      }
    }
    
    // Track Alt key for element duplication (handle both key formats)
    if (e.key === 'Alt' || e.key === 'Meta' || e.altKey) {
      e.preventDefault(); // Prevent browser's default behavior
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
  }, [isPanning]);

  // Handle key up for Alt key
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt' || e.key === 'Meta' || e.altKey) {
      e.preventDefault(); // Prevent browser's default behavior
      setIsAltKeyPressed(false);
      
      // Restore cursor based on panning state using CSS class
      if (containerRef.current) {
        containerRef.current.className = containerRef.current.className.replace('cursor-copy', '');
        containerRef.current.className = `map-container with-grid absolute ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`;
      }
    }
  }, [isPanning]);

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

  // Handle 3D tilt effect for book cover
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bookCoverRef.current) return;
    
    const { left, top, width, height } = bookCoverRef.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the element
    const x = e.clientX - left;
    const y = e.clientY - top;
    
    // Convert to percentage (-50 to 50)
    const xPercent = ((x / width) - 0.5) * 100;
    const yPercent = ((y / height) - 0.5) * 100;
    
    // Reverse Y direction for natural tilt feel
    setTilt({ x: -yPercent / 5, y: xPercent / 5 });
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
    const canvasWidth = 1800;
    const canvasHeight = 1800;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'link',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: linkData.title || linkData.url,
      orientation: 'horizontal',
      isMediaCollapsed: !linkData.image && !linkData.previewUrl, // Hide media by default if there's no image
      linkData: {
        url: linkData.url,
        title: linkData.title,
        previewUrl: linkData.image,
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
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=dea282c8a3ed6b4d82eed4ea65ab3826`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setUploadedImageUrl(data.data.display_url);
        handleAddImageElement(data.data.display_url);
        setIsImageModalOpen(false);
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  // Function to add an image element to the canvas
  const handleAddImageElement = useCallback((imageUrl: string) => {
    if (!containerRef.current) return;

    const elementWidth = 200; // Default width for image elements
    const elementHeight = 150; // Default height for image elements

    // Get the center of the user's view in canvas coordinates
    const viewportCenter = getViewportCenterInCanvas();
    
    // Calculate the position so element is centered on the viewport center
    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    // Canvas bounds
    const canvasWidth = 1800;
    const canvasHeight = 1800;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'image',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: '', // Empty text for image elements
      orientation: 'horizontal',
      imageData: {
        url: imageUrl,
        alt: `Image ${elements.length + 1}`
      }
    };

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
  const [fullscreenImage, setFullscreenImage] = useState<{url: string, alt: string} | null>(null);

  // Add event listener for media collapse toggle
  useEffect(() => {
    const handleMediaCollapse = (e: CustomEvent) => {
      // Get the id from the event detail
      const { id } = e.detail;
      
      // Stop any further propagation
      e.stopPropagation();
      
      // Immediately update the element without selecting it
      setElements(prev => prev.map(element => {
        if (element.id === id) {
          return {
            ...element,
            isMediaCollapsed: !element.isMediaCollapsed
          };
        }
        return element;
      }));
    };

    // Use capture phase to handle the event before it reaches other handlers
    document.addEventListener('toggle-media-collapse', handleMediaCollapse as EventListener, true);
    return () => {
      document.removeEventListener('toggle-media-collapse', handleMediaCollapse as EventListener, true);
    };
  }, []);


  return (
    <DndContext 
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      {/* Fixed position container to prevent scrolling and account for top toolbar */}
      <div className="fixed inset-0 top-[60px] bg-white">
        {/* Floating Toolbar */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 flex items-center gap-2 z-50">
          <button
            onClick={() => handleAddElement('horizontal')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
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
          <div className="w-px h-6 bg-gray-200"></div>
          <button
            onClick={handleAddLine}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Line"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-200"></div>
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
          <div className="w-px h-6 bg-gray-200"></div>
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
                onClick={handleClearConnections}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
                title="Clear Connections"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
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
              width: '1800px',
              height: '1800px',
              transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
            onMouseDown={handlePanStart}
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
              >
                {element.type === 'book' && element.bookData ? (
                  <div className="w-full h-full flex flex-col relative">
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
                  <div className="image-element" style={{ width: '100%', height: '100%' }}>
                    <img 
                      src={element.imageData.url} 
                      alt={element.imageData.alt || 'Uploaded image'}
                      className="w-full h-full object-cover"
                      style={{ 
                        borderRadius: '4px',
                        pointerEvents: 'none' // Prevents image from capturing mouse events
                      }}
                    />
                  </div>
                ) : element.type === 'link' && element.linkData ? (
                  <div className="w-full h-full flex flex-col overflow-hidden rounded-md">
                    {element.linkData.previewUrl || element.linkData.image ? (
                      <div className="w-full h-3/5 bg-gray-100 overflow-hidden">
                        <img 
                          src={element.linkData.previewUrl || element.linkData.image} 
                          alt={element.linkData.title || "Link preview"} 
                          className="w-full h-full object-cover"
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
                    <div className="p-2 flex-1 flex flex-col">
                      <div className="font-medium text-gray-800 line-clamp-2 text-sm">
                        {element.linkData.title || element.linkData.url || "Link"}
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
                    style={{ fontSize: '16px' }}
                  >
                    {element.text}
                  </span>
                )}
              </ElementWithConnections>
              ) : null
            ))}
            
              {/* Arrows */}
            {connections.map((connection) => (
                <ScaledXarrow
                key={connection.id}
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
            onClick={() => setScaleState(prev => Math.max(prev - 0.1, 0.35))}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg font-medium w-10 h-10 flex items-center justify-center"
          >
            -
          </button>
          <span className="flex-grow text-center font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScaleState(prev => Math.min(prev + 0.35, 2))}
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
        />
      )}

      {bookDetailsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" onClick={() => setBookDetailsModal(null)}></div>
          
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
                      {/* Remove the darkening gradient overlay */}
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

                                  if (!selectedVariant?.id) {
                                    console.error('Selected variant ID not found');
                                    toast.error('Download link not available');
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
                          {bookDetailsModal.bookData.flibustaVariants?.map((variant, index) => (
                            variant.formats.filter(format => format.format !== 'mobi' && format.format !== 'read').map((format) => (
                              <button
                                key={`${variant.sourceId}-${format.format}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    if (format.format === 'read') {
                                      window.open(format.url, '_blank');
                                      return;
                                    }
                                    
                                    // Direct access to Cloudflare worker URL
                                    window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${variant.sourceId}/${format.format}`;
                                  } catch (err) {
                                    console.error('Error getting download link:', err);
                                    toast.error('Failed to get download link. Please try again.');
                                  }
                                }}
                                className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-900 text-white hover:bg-gray-800 border border-gray-700"
                              >
                                .{format.format}
                              </button>
                            ))
                          ))}
                          
                          {bookDetailsModal.bookData.flibustaVariants?.[0]?.formats.some(format => format.format === 'read') && (
                            <button
                              onClick={() => {
                                const readFormat = bookDetailsModal.bookData?.flibustaVariants?.[0].formats.find(format => format.format === 'read');
                                if (readFormat) {
                                  window.open(readFormat.url, '_blank');
                                }
                              }}
                              className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                            >
                              Read online (VPN)
                            </button>
                          )}
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
                        <div className="flex flex-wrap gap-4">
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
                        
                        {!isFlibustaSearching && showFlibustaResults && flibustaResults.length === 0 && (
                          <div className="mt-4 text-gray-400">
                            Not found.
                          </div>
                        )}
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
      )}

      {textEditModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setTextEditModal(null)}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
            <textarea
              value={textEditModal.text}
              onChange={(e) => setTextEditModal({...textEditModal, text: e.target.value})}
              className="w-full p-2 border border-gray-400 rounded mb-4 h-32 text-black"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText(); if (e.key === 'Escape') setTextEditModal(null); }}
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setTextEditModal(null)} 
                className="px-4 py-2 border border-gray-400 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveText} 
                className="px-4 py-2 bg-gray-800 text-white rounded shadow-sm text-sm font-medium hover:bg-gray-900"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="absolute inset-0 bg-black bg-opacity-90 backdrop-blur-sm" 
            onClick={() => setFullscreenImage(null)}
          ></div>
          <div className="relative max-w-4xl max-h-[90vh] w-auto h-auto">
            <button 
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors z-10"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img 
              src={fullscreenImage.url} 
              alt={fullscreenImage.alt}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* Add the Link Modal */}
      {isLinkModalOpen && (
        <LinkModal
          onClose={() => setIsLinkModalOpen(false)}
          onLinkSubmit={handleAddLinkElement}
        />
      )}

      {/* Fullscreen Image View */}
      {fullscreenImage && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="absolute inset-0 bg-black bg-opacity-90 backdrop-blur-sm" 
            onClick={() => setFullscreenImage(null)}
          ></div>
          <div className="relative max-w-4xl max-h-[90vh] w-auto h-auto">
            <button 
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors z-10"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img 
              src={fullscreenImage.url} 
              alt={fullscreenImage.alt}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </DndContext>
  );
} 