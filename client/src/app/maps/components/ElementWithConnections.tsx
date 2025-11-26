'use client';

import { useCallback, useMemo, useState, memo, MutableRefObject, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import DraggableElement from '@/components/Map/DraggableElement';
import { MapElement } from '../types';
import { getDefaultDimensions } from '../utils';

interface ElementWithConnectionsProps {
  element: MapElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartConnection: (
    elementId: string,
    point: 'top' | 'right' | 'bottom' | 'left',
    e: React.MouseEvent,
  ) => void;
  transformsRef: MutableRefObject<Record<string, { x: number; y: number } | null>>;
  onTextChange: (id: string, newText: string) => void;
  onDoubleClick: (element: MapElement) => void;
  scale: number;
  isAltPressed?: boolean;
  isDuplicating?: boolean;
  onToggleCompleted?: (elementId: string) => void;
  onDragStart: (elementId: string, context: { altKey: boolean }) => void;
  onDragMove: (elementId: string, delta: { x: number; y: number }) => void;
  onDragEnd: (elementId: string, delta: { x: number; y: number }, context: { altKey: boolean }) => void;
}

export const ElementWithConnections = ({
  element,
  isSelected,
  onSelect,
  onStartConnection,
  onTextChange,
  onDoubleClick,
  scale,
  isAltPressed,
  isDuplicating,
  onToggleCompleted,
  transformsRef,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ElementWithConnectionsProps) => {
  const [dragTransform, setDragTransform] = useState<{ x: number; y: number } | null>(transformsRef.current[element.id] || null);
  const transform = dragTransform || transformsRef.current[element.id] || null;
  const [liveTransform, setLiveTransform] = useState<{ x: number; y: number } | null>(null);
  const effectiveTransform = liveTransform ?? transform;

  useEffect(() => {
    setDragTransform(transformsRef.current[element.id] || null);
  }, [element.id, transformsRef]);
  const [isElementResizing, setIsElementResizing] = useState(false);

  const handleCompletedButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleCompleted) {
        onToggleCompleted(element.id);
      }
      return false;
    },
    [element.id, onToggleCompleted],
  );

  const handleTransformChange = useCallback(
    (newTransform: { x: number; y: number } | null) => {
      transformsRef.current[element.id] = newTransform;
      setLiveTransform(newTransform);
      setDragTransform((prev) => {
        if (
          (prev && newTransform && prev.x === newTransform.x && prev.y === newTransform.y) ||
          (!prev && !newTransform)
        ) {
          return prev;
        }
        if (!newTransform) {
          return null;
        }
        return { x: newTransform.x, y: newTransform.y };
      });
    },
    [element.id, transformsRef],
  );

  const handleResizeStateChange = useCallback((isResizing: boolean) => {
    setIsElementResizing(isResizing);
  }, []);

  const defaults = getDefaultDimensions(element);
  const elementWidth = element.width || defaults.width;
  const elementHeight = element.height || defaults.height;
  const crossOffset = element.type === 'book' ? 36 : 24;

  const positions = useMemo(() => {
    if (element.type === 'book') {
      return {
        top: {
          left:
            element.left +
            elementWidth / 2 +
            (effectiveTransform?.x ?? 0),
          top: element.top + (effectiveTransform?.y ?? 0),
        },
        right: {
          left:
            element.left +
            elementWidth +
            (effectiveTransform?.x ?? 0),
          top:
            element.top +
            elementHeight / 2 +
            (effectiveTransform?.y ?? 0),
        },
        bottom: {
          left:
            element.left +
            elementWidth / 2 +
            (effectiveTransform?.x ?? 0),
          top:
            element.top +
            elementHeight +
            (effectiveTransform?.y ?? 0),
        },
        left: {
          left: element.left + (effectiveTransform?.x ?? 0),
          top:
            element.top +
            elementHeight / 2 +
            (effectiveTransform?.y ?? 0),
        },
      };
    }

    return {
      top: {
        left:
          element.left +
          elementWidth / 2 +
          (effectiveTransform?.x ?? 0),
        top:
          element.top - crossOffset / scale + (effectiveTransform?.y ?? 0),
      },
      right: {
        left:
          element.left +
          elementWidth +
          crossOffset / scale +
          (effectiveTransform?.x ?? 0),
        top:
          element.top +
          elementHeight / 2 +
          (effectiveTransform?.y ?? 0),
      },
      bottom: {
        left:
          element.left +
          elementWidth / 2 +
          (effectiveTransform?.x ?? 0),
        top:
          element.top +
          elementHeight +
          crossOffset / scale +
          (effectiveTransform?.y ?? 0),
      },
      left: {
        left:
          element.left - crossOffset / scale + (effectiveTransform?.x ?? 0),
        top:
          element.top +
          elementHeight / 2 +
          (effectiveTransform?.y ?? 0),
      },
    };
  }, [element.left, element.top, effectiveTransform, element.type, elementHeight, elementWidth, crossOffset, scale]);

  const handleLinkDoubleClick = useCallback(() => {
    if (element.type === 'link' && element.linkData?.url) {
      window.open(element.linkData.url, '_blank');
    }
    onDoubleClick(element);
  }, [element, onDoubleClick]);

  const hasMedia =
    (element.type === 'image' && element.imageData) ||
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
        liveTransform={liveTransform}
        onResizeStateChange={handleResizeStateChange}
        isAltPressed={isAltPressed}
        isDuplicating={isDuplicating}
        onDragStart={(context) => onDragStart(element.id, context)}
        onDragMove={(delta) => onDragMove(element.id, delta)}
        onDragEnd={(delta, context) => onDragEnd(element.id, delta, context)}
      >
        {element.type === 'book' && element.bookData ? (
          <div className="w-full h-full flex flex-col relative">
            {(isSelected || element.bookData.completed) && (
              <div
                className="book-completed-badge cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleCompletedButtonClick(e);
                }}
              >
                <div
                  className={`flex items-center justify-center text-xs font-semibold py-1 px-2 ${element.bookData.completed ? 'active' : ''}`}
                >
                  Completed
                </div>
              </div>
            )}
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
            <div className="absolute left-1/2 transform -translate-x-1/2" style={{ width: 'max-content', maxWidth: '180px', top: '150px' }}>
              <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 break-words text-center whitespace-normal">
                  {element.bookData.title}
                </div>
              </div>
              <div className="flex justify-center">
                <div
                  className="author-segment bg-white px-3 py-1 border border-gray-200 shadow-sm rounded-lg"
                  style={{ maxWidth: '180px', width: 'fit-content' }}
                >
                  <div className="text-xs text-gray-600 whitespace-nowrap">
                    {Array.isArray(element.bookData.author)
                      ? element.bookData.author
                          .map((author) => {
                            const names = author.split(' ');
                            return names.length > 1 ? `${names[0][0]}. ${names.slice(1).join(' ')}` : author;
                          })
                          .join(', ')
                      : element.bookData.author}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : element.type === 'image' && element.imageData ? (
          <div className="w-full h-full overflow-hidden flex items-center justify-center bg-white">
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
                  alt={element.linkData.title || 'Link preview'}
                  className="w-full h-full"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div className="w-full h-2/5 bg-gray-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </div>
            )}
            <div className="p-2 flex-1 flex flex-col">
              <div className="font-medium text-gray-800 line-clamp-2 text-sm flex items-center">
                <span className="flex-1">
                  {element.linkData.title ||
                    element.linkData.displayUrl ||
                    (element.linkData.url
                      ? new URL(element.linkData.url).hostname.replace('www.', '')
                      : '')}
                </span>
              </div>
              {element.linkData.description && (
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">{element.linkData.description}</div>
              )}
              <div className="flex items-center mt-auto pt-1 text-xs text-gray-500">
                {element.linkData.favicon && (
                  <img src={element.linkData.favicon} alt="" className="w-4 h-4 mr-1" />
                )}
                <span className="truncate">
                  {element.linkData.displayUrl ||
                    (element.linkData.url
                      ? new URL(element.linkData.url).hostname.replace('www.', '')
                      : '')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="text-gray-800 px-2" style={{ fontSize: '16px', pointerEvents: 'none' }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <span style={{ pointerEvents: 'none', color: '#1f2937' }}>{children}</span>,
                strong: ({ children }) => <strong style={{ pointerEvents: 'none', color: '#1f2937' }}>{children}</strong>,
                em: ({ children }) => <em style={{ pointerEvents: 'none', color: '#1f2937' }}>{children}</em>,
                a: ({ href, children }) => (
                  <span style={{ pointerEvents: 'none', color: '#1f2937', textDecoration: 'underline' }}>{children}</span>
                ),
              }}
            >
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

interface ScaledConnectionPointProps {
  position: 'top' | 'right' | 'bottom' | 'left';
  elementId: string;
  isSelected: boolean;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  scale: number;
  left: number;
  top: number;
}

const ScaledConnectionPoint = ({
  position,
  elementId,
  isSelected,
  onStartConnection,
  scale,
  left,
  top,
}: ScaledConnectionPointProps) => {
  if (!isSelected) return null;

  const getRotation = (direction: string) => {
    switch (direction) {
      case 'right':
        return 'rotate(90deg)';
      case 'bottom':
        return 'rotate(180deg)';
      case 'left':
        return 'rotate(270deg)';
      default:
        return 'rotate(0deg)';
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
          transform: `scale(${1 / scale})`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '24px',
            height: '24px',
            backgroundColor: '#4A90E2',
            borderRadius: '50%',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            transform: `translate(-50%, -50%) ${getRotation(position)}`,
            pointerEvents: 'all',
            transition: 'transform 0.2s, background-color 0.2s',
            userSelect: 'none',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStartConnection(elementId, position, e);
          }}
          onMouseOver={(e) => {
            const target = e.target as HTMLDivElement;
            target.style.transform = `translate(-50%, -50%) scale(1.2) ${getRotation(position)}`;
            target.style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLDivElement;
            target.style.transform = `translate(-50%, -50%) ${getRotation(position)}`;
            target.style.backgroundColor = '#4A90E2';
          }}
        >
          ↑
        </div>
      </div>
    </div>
  );
};

export default memo(ElementWithConnections);

