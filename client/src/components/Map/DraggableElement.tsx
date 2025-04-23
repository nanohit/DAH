'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import ReactMarkdown from 'react-markdown';

// Define MapElement here or import from a shared types file
// Ensure this interface matches the one used in page.tsx
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
    completed?: boolean;
    flibustaVariants?: Array<any>; // Simplified for example
    bookmarks?: Array<any>; // Simplified for example
  };
  imageData?: {
    url: string;
    alt: string;
  };
  linkData?: {
    url: string;
    title?: string;
    previewUrl?: string;
    description?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    image?: string;
    youtubeVideoId?: string;
  };
  // lineData is not directly used in DraggableElement
}

interface DraggableElementProps {
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
  scale: number;
  onResizeStateChange?: (isResizing: boolean) => void;
  isAltPressed?: boolean;
  isDuplicating?: boolean;
  children?: React.ReactNode;
}

const DraggableElement: React.FC<DraggableElementProps> = ({ 
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
  scale, 
  onResizeStateChange,
  isAltPressed,
  isDuplicating,
  children,
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
    const elementNode = document.getElementById(id);
    if (!elementNode) return;

    // Store the original element's position before any resize changes
    const rect = elementNode.getBoundingClientRect();

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
      elementNode.style.width = `${newWidth}px`;
      elementNode.style.height = `${newHeight}px`;
      elementNode.style.left = `${newLeft}px`;
      elementNode.style.top = `${newTop}px`;
      // Remove transform during resize to prevent conflicts
      elementNode.style.transform = 'none';
      
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
      elementNode.dispatchEvent(resizeEvent);
    };

    const handleResizeMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the final dimensions and position
      const finalWidth = parseFloat(elementNode.style.width);
      const finalHeight = parseFloat(elementNode.style.height);
      const finalLeft = parseFloat(elementNode.style.left);
      const finalTop = parseFloat(elementNode.style.top);

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
        elementNode.dispatchEvent(event);
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
    const elementNode = document.getElementById(id);
    if (!elementNode) return;
    
    // Use the actual rendered size and position
    const renderedWidth = parseFloat(elementNode.style.width) || elementWidth;
    const renderedHeight = parseFloat(elementNode.style.height) || elementHeight;
    
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
    e.stopPropagation();
    e.preventDefault(); // Prevent default text selection
    
    if (isEditing || isResizing) {
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
        data-type={element.type} // Keep data-type attribute if needed elsewhere
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
          backgroundImage: isSelected && element.type === 'book' && element.bookData?.thumbnail ? `url(${element.bookData.thumbnail})` : 'none', // Adjusted background image logic
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
            
            {/* Reference element for author bottom connection (used by parent) */}
            {element.type === 'book' && (
              <div
                id={`${id}-author-bottom`}
                ref={authorBottomRef}
                style={{
                  position: 'absolute',
                  bottom: '-8px', // Position needs to be adjusted based on actual layout
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '1px',
                  height: '1px',
                  pointerEvents: 'none' // Should not interfere with interaction
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
          {/* Corner resize handles */}
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize" 
            style={{ top: '-8px', left: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
            onTouchStart={(e) => {
              e.preventDefault();
              const mouseEvent = new MouseEvent('mousedown', {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
              });
              handleResizeMouseDown(mouseEvent as unknown as React.MouseEvent<Element, MouseEvent>, 'top-left');
            }}
          />
          <div 
            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-nesw-resize" 
            style={{ top: '-8px', right: '-8px', pointerEvents: 'auto', opacity: isResizing ? 0 : 1 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
            onTouchStart={(e) => {
              e.preventDefault();
              const mouseEvent = new MouseEvent('mousedown', {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
              });
              handleResizeMouseDown(mouseEvent as unknown as React.MouseEvent<Element, MouseEvent>, 'top-right');
            }}
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
            onTouchStart={(e) => {
              e.preventDefault();
              const mouseEvent = new MouseEvent('mousedown', {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
              });
              handleResizeMouseDown(mouseEvent as unknown as React.MouseEvent<Element, MouseEvent>, 'bottom-right');
            }}
          />
          
          {/* Edge resize areas */}
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

export default DraggableElement; 