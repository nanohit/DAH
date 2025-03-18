'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Xarrow, { Xwrapper } from 'react-xarrows';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadMapViewOnly, MapElement, Connection } from '@/utils/mapUtils';
import ReactMarkdown from 'react-markdown';

// ScaledXarrow component - EXACTLY copied from main editor
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

// Simple view-only component based on the main editor
export default function ViewMapPage() {
  // State for map data
  const [elements, setElements] = useState<MapElement[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mapName, setMapName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  
  // Canvas position and panning state
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Modal states - EXACT SAME as main editor
  const [bookDetailsModal, setBookDetailsModal] = useState<MapElement | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; alt: string } | null>(null);
  const [textEditModal, setTextEditModal] = useState<{ id: string; text: string } | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  // Function to get connection references - EXACTLY copied from main editor
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

  // Load map data when component mounts
  useEffect(() => {
    const mapId = searchParams.get('id');
    console.log('View-only page loaded with map ID:', mapId);
    
    if (mapId) {
      loadMapData(mapId);
    } else {
      console.log('No map ID provided, redirecting to saved maps');
      toast.error('No map ID provided');
      router.push('/saved-maps');
    }
  }, [searchParams, router]);

  // Add body class for consistent styling
  useEffect(() => {
    document.body.classList.add('maps-view-page');
    return () => {
      document.body.classList.remove('maps-view-page');
    };
  }, []);

  // Debug effect - log when elements or connections change
  useEffect(() => {
    console.log('Elements updated:', elements.length, elements);
    console.log('Connections updated:', connections.length, connections);
  }, [elements, connections]);

  // Function to load map data
  const loadMapData = async (mapId: string) => {
    try {
      setIsLoading(true);
      const mapData = await loadMapViewOnly(mapId);
      
      if (!mapData) {
        toast.error('Failed to load map data');
        router.push('/saved-maps');
        return;
      }
      
      // Correctly access the data from the SavedMap structure
      setMapName(mapData.name);
      setElements(mapData.elements);
      setConnections(mapData.connections);
      
      // Calculate initial position to center the content
      if (containerRef.current && mapData.elements.length > 0) {
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight - 56; // Minus the header height
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        // Find the boundaries of all elements
        mapData.elements.forEach((element) => {
          const width = element.width || (element.orientation === 'horizontal' ? 160 : 140);
          const height = element.height || (element.orientation === 'horizontal' ? 128 : 200);
          
          minX = Math.min(minX, element.left);
          minY = Math.min(minY, element.top);
          maxX = Math.max(maxX, element.left + width);
          maxY = Math.max(maxY, element.top + height);
        });
        
        // If we have elements, center the view on them
        if (minX !== Infinity) {
          const contentCenterX = (minX + maxX) / 2;
          const contentCenterY = (minY + maxY) / 2;
          
          const initialX = (containerWidth / 2) - (contentCenterX * scale);
          const initialY = (containerHeight / 2) - (contentCenterY * scale);
          
          setCanvasPosition({ x: initialX, y: initialY });
        } else {
          // Default position if no elements
          setCanvasPosition({ x: containerWidth / 4, y: containerHeight / 4 });
        }
      } else if (mapData.canvasPosition) {
        // Use saved canvas position if available
        setCanvasPosition(mapData.canvasPosition);
        setScale(mapData.scale || 1);
      }
      
      console.log('Map data loaded successfully:', {
        elements: mapData.elements.length,
        connections: mapData.connections.length
      });
    } catch (error) {
      console.error('Error loading map:', error);
      toast.error('Failed to load map');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for zooming and panning
  const handleWheel = useCallback((e: WheelEvent) => {
    // Prevent zooming when a modal is open
    if (bookDetailsModal || fullscreenImage || textEditModal) return;
    
    e.preventDefault();
    
    const ZOOM_SENSITIVITY = 0.001;
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    
    // Calculate new scale with limits
    const newScale = Math.max(0.25, Math.min(2, scale * (1 + delta)));
    
    // Calculate cursor position relative to the viewport
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Mouse position relative to the viewport
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // The point on the canvas where the mouse is pointing
    const pointX = (mouseX - canvasPosition.x) / scale;
    const pointY = (mouseY - canvasPosition.y) / scale;
    
    // New position that keeps the point under the mouse
    const newX = mouseX - pointX * newScale;
    const newY = mouseY - pointY * newScale;
    
    setScale(newScale);
    setCanvasPosition({ x: newX, y: newY });
  }, [scale, canvasPosition, bookDetailsModal, fullscreenImage, textEditModal]);

  // Panning handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only start panning on left-click
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
    
    // Prevent default text selection behavior
    e.preventDefault();
  }, [canvasPosition]);
  
  const handlePanMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;
    
    setCanvasPosition({ x: newX, y: newY });
    
    // Prevent default text selection behavior
    e.preventDefault();
  }, [isPanning, panStart]);
  
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle element DOUBLE CLICK to show details - EXACT SAME as main editor
  const handleElementDoubleClick = (element: MapElement) => {
    if (element.type === 'book') {
      setBookDetailsModal(element);
    } else if (element.type === 'image' && element.imageData) {
      setFullscreenImage({
        url: element.imageData.url,
        alt: element.imageData.alt || 'Image'
      });
    } else if (element.type === 'link' && element.linkData) {
      // For link elements, open the URL in a new tab
      window.open(element.linkData.url, '_blank');
    } else {
      // For regular text elements
      setTextEditModal({
        id: element.id,
        text: element.text
      });
    }
  };

  // Exit view-only mode
  const handleExit = () => {
    router.push('/saved-maps');
  };

  // Set up event listeners for panning and zooming
  useEffect(() => {
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handlePanMove, handlePanEnd, handleWheel]);

  // Line renderer for line elements
  const renderLine = (element: MapElement) => {
    if (element.type !== 'line' || !element.lineData) return null;
    
    // Correctly use the property names from the lineData structure
    const { startX, startY, endX, endY } = element.lineData;
    
    return (
      <g key={element.id}>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#333"
          strokeWidth="2"
        />
      </g>
    );
  };

  // Function to render different element types - EXACTLY THE SAME as in the main editor
  const renderElement = (element: MapElement) => {
    if (element.type === 'line') return null; // Lines are handled separately
    
    // Use same default sizes as main editor
    const defaultWidth = element.type === 'book' ? 140 : 
      element.type === 'image' ? 200 :
      element.type === 'link' ? 240 :
      (element.orientation === 'horizontal' ? 160 : 140);
    
    const defaultHeight = element.type === 'book' ? 220 : 
      element.type === 'image' ? 150 :
      element.type === 'link' ? 160 :
      (element.orientation === 'horizontal' ? 128 : 200);
    
    // Use element widths and heights if provided, otherwise use defaults
    const width = element.width || defaultWidth;
    const height = element.height || defaultHeight;

    // Create a wrapper element with the exact same styles as in the main editor
    let content;
    if (element.type === 'book' && element.bookData) {
      // EXACT SAME book element as in main editor
      content = (
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
          <div className="absolute left-1/2 transform -translate-x-1/2" style={{ width: 'max-content', maxWidth: '180px', top: '144px' }}>
            <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-md">
              <div className="text-sm font-semibold text-gray-900 break-words text-center whitespace-normal">
                {element.bookData.title}
              </div>
            </div>
            {/* Author segment - directly under title */}
            <div className="flex justify-center mt-2">
              <div className="author-segment bg-white px-3 py-1 border border-gray-200 shadow-md rounded-lg" style={{ maxWidth: '180px', width: 'fit-content' }}>
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
      );
    } else if (element.type === 'image' && element.imageData) {
      // EXACT SAME image element as in main editor
      content = (
        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-white" style={{ padding: 0 }}>
          <img 
            src={element.imageData.url} 
            alt={element.imageData.alt || 'Image'} 
            className="w-full h-full"
            style={{ 
              objectFit: 'contain',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            onError={(e) => {
              console.error('Image failed to load:', element.imageData?.url);
              e.currentTarget.src = 'https://via.placeholder.com/200x150?text=Image+Error';
            }}
          />
        </div>
      );
    } else if (element.type === 'link' && element.linkData) {
      // EXACT SAME link element as in main editor
      content = (
        <div className="w-full h-full flex flex-col overflow-hidden rounded-md relative" style={{ padding: 0 }}>
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
          ) : element.linkData.image ? (
            <div className="w-full h-3/5 bg-gray-100 overflow-hidden">
              <img 
                src={element.linkData.image} 
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
      );
    } else {
      // EXACT SAME default text element as in main editor
      content = (
        <div className="w-full h-full flex items-center justify-center">
          <span 
            className="text-gray-800 px-2" 
            style={{ fontSize: '14px', pointerEvents: 'none', lineHeight: '1.4' }}
          >
            <ReactMarkdown components={{
              p: ({ children }) => <span style={{ pointerEvents: 'none' }}>{children}</span>,
              strong: ({ children }) => <strong style={{ pointerEvents: 'none', fontWeight: 'bold' }}>{children}</strong>,
              em: ({ children }) => <em style={{ pointerEvents: 'none', fontStyle: 'italic' }}>{children}</em>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" style={{ pointerEvents: 'auto' }}>{children}</a>
            }}>
              {element.text}
            </ReactMarkdown>
          </span>
        </div>
      );
    }

    return (
      <div
        key={element.id}
        id={element.id}
        data-type={element.type}
        className="map-element"
        style={{
          position: 'absolute',
          left: `${element.left}px`,
          top: `${element.top}px`,
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: 'white',
          border: element.type === 'book' ? '1px solid rgb(209, 213, 219)' : '1px solid #ccc',
          borderRadius: '8px',
          padding: '0',
          boxShadow: element.type === 'book' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          zIndex: 10,
          transition: 'border-color 0.2s',
          overflow: element.type === 'book' ? 'visible' : 'hidden'
        }}
        onDoubleClick={() => handleElementDoubleClick(element)}
      >
        {content}
      </div>
    );
  };

  // If still loading, show loading spinner
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white" style={{ top: '60px' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ top: '60px', bottom: 0, left: 0, right: 0 }}>
      {/* Map container with explicit containment below header */}
      <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
        <div 
          ref={containerRef}
          className="map-container with-grid"
          style={{
            width: '2700px',
            height: '2700px',
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            cursor: isPanning ? 'grabbing' : 'grab',
            position: 'absolute',
            top: 0,
            left: 0,
            border: '2px solid rgb(229, 231, 235)',
            borderRadius: '0.5rem',
            backgroundColor: 'rgb(249, 250, 251)',
            backgroundImage: 'radial-gradient(circle, #c5c7cb 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: 'center center',
            overflow: 'visible',
            willChange: 'transform',
            transition: 'cursor 0.2s'
          }}
          onMouseDown={handlePanStart}
        >
          {/* Lines */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 5, pointerEvents: 'none' }}
          >
            {elements.map((element) => (
              element.type === 'line' ? renderLine(element) : null
            ))}
          </svg>

          <Xwrapper>
            {/* Elements */}
            {elements.map((element) => (
              element.type !== 'line' ? renderElement(element) : null
            ))}

            {/* Connections */}
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
          </Xwrapper>
        </div>

        {/* Back navigation UI element */}
        <div className="fixed top-[90px] left-4 z-[101]">
          <div 
            className="flex items-center bg-white px-5 py-3 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            onClick={handleExit}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 text-gray-800 mr-3" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span className="text-gray-800 font-medium text-base">{mapName}</span>
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">View only</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="fixed bottom-4 right-4 bg-white text-gray-700 rounded-lg shadow-lg p-1 flex items-center gap-2 z-[100]" style={{ minWidth: "150px" }}>
          <button 
            onClick={() => setScale(prev => Math.max(prev - 0.1, 0.25))}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg font-medium w-10 h-10 flex items-center justify-center"
          >
            -
          </button>
          <span className="flex-grow text-center font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(prev => Math.min(prev + 0.25, 2))}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg font-medium w-10 h-10 flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      {/* EXACTLY THE SAME MODALS as in main editor */}
      {/* Book Details Modal - EXACT copy from main editor */}
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
              </div>
              
              <div className="flex flex-col md:flex-row gap-12">
                {/* Book cover */}
                <div className="w-full md:w-64 flex-shrink-0">
                  <div className="relative">
                    <div className="w-full">
                      {bookDetailsModal.bookData?.thumbnail ? (
                        <img 
                          src={bookDetailsModal.bookData.highResThumbnail || bookDetailsModal.bookData.thumbnail} 
                          alt={bookDetailsModal.bookData.title}
                          className="w-full h-auto object-cover bg-gray-900 shadow-lg"
                          style={{ 
                            borderRadius: '4px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
                    </div>
                    
                    {bookDetailsModal.bookData?.description ? (
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
                  {bookDetailsModal.bookData?.flibustaStatus === 'uploaded' && bookDetailsModal.bookData.flibustaVariants && (
                    <div className="mt-8">
                      <h3 className="text-gray-200 text-lg font-medium mb-4">Download options</h3>
                      
                      <div>
                        {/* Saved download buttons */}
                        <div className="flex flex-wrap gap-3 pt-3">
                          {bookDetailsModal.bookData.flibustaVariants[0]?.formats
                            .filter(format => format.format !== 'mobi' && format.format !== 'read')
                            .map((format) => (
                            <a
                              key={format.format}
                              href={`${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${bookDetailsModal?.bookData?.flibustaVariants?.[0]?.sourceId}/${format.format}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-900 text-white hover:bg-gray-800 border border-gray-700"
                            >
                              {`.${format.format}`}
                            </a>
                          ))}
                          
                          {bookDetailsModal.bookData.flibustaVariants[0]?.formats.length > 0 && (
                            <a
                              href={`https://flibusta.is/b/${bookDetailsModal.bookData.flibustaVariants[0].sourceId}/read`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                            >
                              Read online (VPN)
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Edit Modal - EXACT copy from main editor */}
      {textEditModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setTextEditModal(null)}></div>
          <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
            <div className="text-gray-900 text-base">
              {textEditModal.text}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal - EXACT copy from main editor */}
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
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
} 