'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragMoveEvent, Modifier } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import Xarrow, { Xwrapper } from 'react-xarrows';
import Link from 'next/link';
import api from '@/services/api';

interface MapElement {
  id: string;
  type: 'element' | 'book';
  left: number;
  top: number;
  text: string;
  orientation: 'horizontal' | 'vertical';
  bookData?: {
    key: string;
    title: string;
    author: string[];
    thumbnail?: string;
    highResThumbnail?: string;
    description?: string;
    source: 'openlib' | 'google' | 'alphy';
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
}

const ConnectionPoint = ({ position, elementId, isSelected, onStartConnection }: {
  position: 'top' | 'right' | 'bottom' | 'left';
  elementId: string;
  isSelected: boolean;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
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

  const positionStyles = {
    top: { top: '-24px', left: '50%', transform: 'translateX(-50%)' },
    right: { top: '50%', right: '-24px', transform: 'translateY(-50%) rotate(90deg)' },
    bottom: { bottom: '-24px', left: '50%', transform: 'translateX(-50%) rotate(180deg)' },
    left: { top: '50%', left: '-24px', transform: 'translateY(-50%) rotate(270deg)' },
  };

  return (
    <div
      className="connection-point"
      style={{
        ...positionStyles[position],
        position: 'absolute',
        width: '20px',
        height: '20px',
        backgroundColor: '#4A90E2',
        borderRadius: '50%',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '14px',
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
}) => {
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    setIsDragStarted(false);
    if (listeners?.onMouseDown) {
      listeners.onMouseDown(e);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragStarted) {
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

  return (
    <div
      ref={setNodeRef}
      id={id}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        opacity: isDragging ? 0.5 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        width: orientation === 'horizontal' ? '160px' : '128px',
        height: orientation === 'horizontal' ? '128px' : '160px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '8px',
        cursor: isEditing ? 'text' : 'move',
        userSelect: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        backgroundImage: isSelected && text.includes('book') ? `url(${text})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className={`map-element ${isSelected ? 'selected' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
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
          {element.type === 'book' && element.bookData ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 relative">
                {element.bookData.thumbnail ? (
                  <img 
                    src={element.bookData.thumbnail} 
                    alt={element.bookData.title}
                    className="w-full h-full object-cover"
                    style={{ borderRadius: 0 }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400">No cover</span>
                  </div>
                )}
              </div>
              <div className="p-2 bg-white">
                <div className="text-sm font-semibold truncate">{element.bookData.title}</div>
                <div className="text-xs text-gray-600 truncate">
                  {Array.isArray(element.bookData.author) 
                    ? element.bookData.author.join(', ') 
                    : element.bookData.author}
                </div>
              </div>
            </div>
          ) : (
            <span 
              className="text-gray-800 px-2" 
              style={{ fontSize: '16px' }}
            >
              {text}
            </span>
          )}
        </>
      )}
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
}: {
  element: MapElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartConnection: (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onTransformChange: (transform: { x: number; y: number } | null) => void;
  onTextChange: (id: string, newText: string) => void;
  onDoubleClick: (element: MapElement) => void;
}) => {
  const [transform, setTransform] = useState<{ x: number; y: number } | null>(null);
  
  const handleTransformChange = useCallback((newTransform: { x: number; y: number } | null) => {
    if (JSON.stringify(transform) !== JSON.stringify(newTransform)) {
      setTransform(newTransform);
      onTransformChange(newTransform);
    }
  }, [transform, onTransformChange]);

  // Calculate the center points for each side
  const elementWidth = 160; // Width of the element
  const elementHeight = 128; // Height of the element
  const crossOffset = 12; // Distance of dots from the element

  const positions = useMemo(() => ({
    top: { 
      left: element.left + elementWidth / 2 + (transform?.x || 0), 
      top: element.top - crossOffset + (transform?.y || 0)
    },
    right: { 
      left: element.left + elementWidth + crossOffset + (transform?.x || 0), 
      top: element.top + elementHeight / 2 + (transform?.y || 0)
    },
    bottom: { 
      left: element.left + elementWidth / 2 + (transform?.x || 0), 
      top: element.top + elementHeight + crossOffset + (transform?.y || 0)
    },
    left: { 
      left: element.left - crossOffset + (transform?.x || 0), 
      top: element.top + elementHeight / 2 + (transform?.y || 0)
    },
  }), [element.left, element.top, transform]);

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
        onDoubleClick={() => onDoubleClick(element)}
        element={element}
      />
      {isSelected && (
        <>
          {Object.entries(positions).map(([position, coords]) => (
            <div
              key={position}
              style={{
                position: 'absolute',
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              <ConnectionPoint 
                position={position as 'top' | 'right' | 'bottom' | 'left'} 
                elementId={element.id} 
                isSelected={true} 
                onStartConnection={onStartConnection}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
};

const TempConnection = ({ start, startPoint, end }: { 
  start: string; 
  startPoint: 'top' | 'right' | 'bottom' | 'left';
  end: { x: number; y: number; }; 
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.style.left = `${end.x}px`;
      endRef.current.style.top = `${end.y}px`;
    }
  }, [end.x, end.y]);

  return (
    <>
      <div
        ref={endRef}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          pointerEvents: 'none',
        }}
      />
      <Xarrow
        start={start}
        end={endRef}
        startAnchor={startPoint}
        color="#666"
        strokeWidth={2}
        path="smooth"
        showHead={true}
      />
    </>
  );
};

const snapToGrid = (args: SnapToGridArgs) => {
  const { transform, active, draggingElement, elements } = args;
  if (!active || !draggingElement) return transform;

  const activeElement = elements.find(el => el.id === active.id);
  if (!activeElement) return transform;

  const elementWidth = 160;
  const elementHeight = 128;
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

    // Center alignment
    const activeCenter = currentLeft + elementWidth / 2;
    const targetCenter = element.left + elementWidth / 2;
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
    const rightDiff = Math.abs(currentLeft + elementWidth - (element.left + elementWidth));
    if (rightDiff < minDistanceX) {
      minDistanceX = rightDiff;
      bestSnapX = (element.left + elementWidth) - (activeElement.left + elementWidth);
    }

    // Vertical center alignment
    const activeCenterY = currentTop + elementHeight / 2;
    const targetCenterY = element.top + elementHeight / 2;
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
    const bottomDiff = Math.abs(currentTop + elementHeight - (element.top + elementHeight));
    if (bottomDiff < minDistanceY) {
      minDistanceY = bottomDiff;
      bestSnapY = (element.top + elementHeight) - (activeElement.top + elementHeight);
    }
  });

  // Only apply snapping if within threshold
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
      displayAll
    });
    
    if (isLoading) {
      console.log('Search blocked due to isLoading');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setCurrentPage(1);
    setHasSearched(true);

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
        setSearchResults(result.books);
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
        ? `/books?page=${page}&limit=${resultsPerPage}` 
        : `/books?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${resultsPerPage}`;

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
        publishedYear: book.publishedYear
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
      const response = await api.get(`/books?search=${encodeURIComponent(searchTerm)}&limit=5`);
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
        inDatabase: true
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

  const handleSubmit = async () => {
    if (confirmedBook) {
      try {
        // Save book to database
        const response = await api.post('/books', {
          title: confirmedBook.title,
          author: Array.isArray(confirmedBook.author_name) 
            ? confirmedBook.author_name.join(', ') 
            : confirmedBook.author_name || 'Unknown',
          description: confirmedBook.description || '',
          coverImage: confirmedBook.thumbnail || '',
          publishedYear: confirmedBook.first_publish_year
        });

        const savedBook = response.data;
        
        // Create map element
        const newElement: MapElement = {
          id: `element-${Date.now()}`,
          type: 'book',
          left: 100,
          top: 100,
          text: confirmedBook.title,
          orientation: 'vertical',
          bookData: {
            key: savedBook._id,
            title: confirmedBook.title,
            author: Array.isArray(confirmedBook.author_name) ? confirmedBook.author_name : [confirmedBook.author_name || 'Unknown'],
            thumbnail: confirmedBook.thumbnail,
            description: confirmedBook.description,
            source: confirmedBook.source
          }
        };

        onBookSubmit(confirmedBook);
        onClose();
      } catch (error) {
        console.error('Error saving book:', error);
      }
    }
  };

  useEffect(() => {
    console.log('API changed to:', activeApi);
    handleParallelSearch(1);
  }, [activeApi, displayAll]);

  if (confirmedBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={onClose}></div>
        
        <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <button
                onClick={handleBackToSearch}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to search
              </button>
            </div>

            <div className="flex gap-8">
              {/* Book cover */}
              <div className="w-64 flex-shrink-0">
                {confirmedBook.thumbnail ? (
                  <img 
                    src={confirmedBook.highResThumbnail || confirmedBook.thumbnail} 
                    alt={confirmedBook.title}
                    className="w-full h-auto object-cover bg-gray-100"
                    style={{ borderRadius: 0 }}
                    onError={(e) => {
                      // Fallback to thumbnail if high-res fails to load
                      if (e.currentTarget.src !== confirmedBook.thumbnail) {
                        e.currentTarget.src = confirmedBook.thumbnail || '';
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-80 bg-gray-200 flex items-center justify-center" style={{ borderRadius: 0 }}>
                    <span className="text-gray-400">No cover</span>
                  </div>
                )}
              </div>

              {/* Book details */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-bold text-gray-900 rounded-sm">{confirmedBook.title}</h2>
                  <button className="text-sm text-blue-500 hover:text-blue-700">edit</button>
                </div>
                
                {confirmedBook.author_name && (
                  <p className="text-lg text-gray-700 mt-1">
                    {Array.isArray(confirmedBook.author_name) 
                      ? confirmedBook.author_name.join(', ') 
                      : confirmedBook.author_name}
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex">
                    {[1,2,3,4,5].map((star) => (
                      <span key={star} className="text-gray-300">★</span>
                    ))}
                  </div>
                  <span className="text-gray-500">n/a</span>
                </div>

                {/* Description */}
                <div className="mt-6">
                  <div className="flex justify-between items-start mb-2">
                    <button 
                      onClick={() => setIsEditingDescription(true)}
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      edit
                    </button>
                  </div>
                  {isLoadingDetails ? (
                    <div className="text-gray-500">Loading description...</div>
                  ) : isEditingDescription ? (
                    <div className="space-y-2">
                      <textarea
                        value={confirmedBook.description || ''}
                        onChange={(e) => setConfirmedBook(prev => ({
                          ...prev!,
                          description: e.target.value
                        }))}
                        className="w-full h-32 p-2 border rounded-md text-gray-700 text-sm"
                        placeholder="Enter book description..."
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditingDescription(false)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : confirmedBook.description ? (
                    <div>
                      <p className="text-gray-700 text-sm">
                        {showFullDescription 
                          ? confirmedBook.description
                          : confirmedBook.description.slice(0, 420)}
                      </p>
                      {confirmedBook.description.length > 420 && (
                        <button
                          onClick={() => setShowFullDescription(!showFullDescription)}
                          className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                        >
                          {showFullDescription ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">No description available</span>
                  )}
                </div>

                {/* Download links button */}
                <button
                  className="mt-8 px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Request download links
                </button>
              </div>
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="flex mt-auto">
            {confirmedBook ? (
              <>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-4 text-base font-medium bg-gray-300 hover:bg-gray-400 rounded-br-lg text-gray-900"
                >
                  Everything is correct - submit
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
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={onClose}></div>
      
      <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
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
              className="flex-1 px-4 py-2 rounded-md bg-gray-100 border-0 text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={() => handleParallelSearch(1)}
              className="px-6 py-2 rounded-md bg-gray-200 text-gray-900 text-base font-medium hover:bg-gray-300"
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
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Google Books
            </button>
            <button
              onClick={() => {
                setActiveApi('alphy');
                setDisplayAll(false);
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeApi === 'alphy'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
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
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  displayAll
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Display all from Alphy
              </button>
            )}
          </div>
        </div>

        {/* Content area with class for scroll position management */}
        <div className="flex-1 px-6 overflow-y-auto search-results-container">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
                    <div className="border-t-2 border-gray-300 my-4 pt-2" />
                  )}
                  <div
                    className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex gap-3 ${
                      selectedBook?.key === book.key ? 'bg-blue-50' : ''
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
                      <div className="w-12 h-16 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No cover</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {book.title}
                        {book.source === 'alphy' && (
                          <span className="ml-2 text-xs text-green-600 font-normal">
                            In database
                          </span>
                        )}
                      </h3>
                      {book.author_name && (
                        <p className="text-sm text-gray-600">
                          by {Array.isArray(book.author_name) ? book.author_name.join(', ') : book.author_name}
                          {book.first_publish_year && ` (${book.first_publish_year})`}
                        </p>
                      )}
                      {selectedBook?.key === book.key && (
                        <p className="text-sm text-blue-600 mt-1">Click again to confirm selection</p>
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
                    className="flex items-center gap-1 px-3 py-1 text-sm text-gray-900 hover:text-blue-600"
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

        {/* Bottom buttons */}
        <div className="flex mt-auto">
          {confirmedBook ? (
            <>
              <button
                onClick={handleSubmit}
                className="flex-1 py-4 text-base font-medium bg-gray-300 hover:bg-gray-400 rounded-br-lg text-gray-900"
              >
                Everything is correct - submit
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

export default function MapsPage() {
  const [elements, setElements] = useState<MapElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; point: 'top' | 'right' | 'bottom' | 'left' } | null>(null);
  const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);
  const [elementTransforms, setElementTransforms] = useState<Record<string, { x: number; y: number } | null>>({});
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [bookDetailsModal, setBookDetailsModal] = useState<MapElement | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const { setNodeRef } = useDroppable({
    id: 'droppable',
  });

  const calculateAlignmentGuides = useCallback((activeId: string, x: number, y: number) => {
    const THRESHOLD = 5; // Pixels threshold for alignment
    const guides: AlignmentGuide[] = [];
    const activeElement = elements.find(el => el.id === activeId);
    if (!activeElement) return guides;

    elements.forEach(element => {
      if (element.id === activeId) return;

      // Check for left/right edges alignment
      if (Math.abs(x - element.left) < THRESHOLD) {
        guides.push({ position: element.left, type: 'vertical' });
      }
      if (Math.abs((x + 160) - (element.left + 160)) < THRESHOLD) {
        guides.push({ position: element.left + 160, type: 'vertical' });
      }

      // Check for top/bottom edges alignment
      if (Math.abs(y - element.top) < THRESHOLD) {
        guides.push({ position: element.top, type: 'horizontal' });
      }
      if (Math.abs((y + 128) - (element.top + 128)) < THRESHOLD) {
        guides.push({ position: element.top + 128, type: 'horizontal' });
      }
    });

    return guides;
  }, [elements]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
    setAlignmentGuides([]);
  }, []);

  const moveElement = useCallback((id: string, left: number, top: number) => {
    setElements(prev => 
      prev.map(element => 
        element.id === id ? { ...element, left, top } : element
      )
    );
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active } = event;
    if (!active) return;

    const elementId = String(active.id);
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Get the current transform from the event
    const currentTransform = {
      x: event.delta.x,
      y: event.delta.y
    };

    // Calculate new position including the transform
    const newLeft = element.left + currentTransform.x;
    const newTop = element.top + currentTransform.y;

    // Calculate and show guides
    const guides = calculateAlignmentGuides(elementId, newLeft, newTop);
    setAlignmentGuides(guides);
  }, [elements, calculateAlignmentGuides]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    if (!active || !delta || !containerRef.current) return;

    const elementId = String(active.id);
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const elementWidth = 160;
    const elementHeight = 128;
    const MAGNETIC_THRESHOLD = 10; // Increased threshold for better snapping

    // Calculate new position including the transform
    let newLeft = element.left + delta.x;
    let newTop = element.top + delta.y;

    // Calculate final guides for snapping
    const guides = calculateAlignmentGuides(elementId, newLeft, newTop);

    // Apply snapping if close to guides
    guides.forEach(guide => {
      if (guide.type === 'vertical') {
        // Check center alignment
        const elementCenterX = newLeft + elementWidth / 2;
        if (Math.abs(elementCenterX - guide.position) < MAGNETIC_THRESHOLD) {
          newLeft = guide.position - elementWidth / 2;
        }
        // Check left edge alignment
        else if (Math.abs(newLeft - guide.position) < MAGNETIC_THRESHOLD) {
          newLeft = guide.position;
        }
        // Check right edge alignment
        else if (Math.abs(newLeft + elementWidth - guide.position) < MAGNETIC_THRESHOLD) {
          newLeft = guide.position - elementWidth;
        }
      } else {
        // Check center alignment
        const elementCenterY = newTop + elementHeight / 2;
        if (Math.abs(elementCenterY - guide.position) < MAGNETIC_THRESHOLD) {
          newTop = guide.position - elementHeight / 2;
        }
        // Check top edge alignment
        else if (Math.abs(newTop - guide.position) < MAGNETIC_THRESHOLD) {
          newTop = guide.position;
        }
        // Check bottom edge alignment
        else if (Math.abs(newTop + elementHeight - guide.position) < MAGNETIC_THRESHOLD) {
          newTop = guide.position - elementHeight;
        }
      }
    });

    // Ensure element stays within bounds
    newLeft = Math.max(0, Math.min(newLeft, containerRect.width - elementWidth));
    newTop = Math.max(0, Math.min(newTop, containerRect.height - elementHeight));

    moveElement(elementId, newLeft, newTop);
    setIsDragging(false);
    setAlignmentGuides([]);
  }, [elements, calculateAlignmentGuides, moveElement]);

  const handleAddElement = useCallback((orientation: 'horizontal' | 'vertical' = 'horizontal') => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const elementWidth = orientation === 'horizontal' ? 160 : 128;
    const elementHeight = orientation === 'horizontal' ? 128 : 160;

    const left = (rect.width / 2) - (elementWidth / 2);
    const top = (rect.height / 2) - (elementHeight / 2);

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'element',
      left: Math.max(0, Math.min(left, rect.width - elementWidth)),
      top: Math.max(0, Math.min(top, rect.height - elementHeight)),
      text: `Element ${elements.length + 1}`,
      orientation,
    };

    setElements(prev => [...prev, newElement]);
  }, [elements.length]);

  useEffect(() => {
    if (containerRef.current) {
      setNodeRef(containerRef.current);
    }
  }, [setNodeRef]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (connectingFrom && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTempConnection({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });

        // Check if we're over any element
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const targetElement = elements.find(el => el.classList.contains('map-element'));
        
        if (targetElement && targetElement.id !== connectingFrom.elementId) {
          // Determine which side of the element we're closest to
          const targetRect = targetElement.getBoundingClientRect();
          const center = {
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2
          };

          // Calculate distances to each side
          const distances = {
            left: Math.abs(e.clientX - targetRect.left),
            right: Math.abs(e.clientX - targetRect.right),
            top: Math.abs(e.clientY - targetRect.top),
            bottom: Math.abs(e.clientY - targetRect.bottom)
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
  }, [connectingFrom]);

  const handleStartConnection = (elementId: string, point: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => {
    setConnectingFrom({ elementId, point });
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTempConnection({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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
      />
    );
  }, [connectingFrom, tempConnection]);

  const modifiers = useMemo(() => {
    return [
      restrictToParentElement,
      ((args: any) => snapToGrid({ ...args, elements, draggingElement: elements.find(el => el.id === args.active?.id) })) as Modifier
    ];
  }, [elements]);

  const handleTextChange = useCallback((elementId: string, newText: string) => {
    setElements(prev => prev.map(element => 
      element.id === elementId ? { ...element, text: newText } : element
    ));
  }, []);

  const handleBookSubmit = (bookData: BookSearchResult) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const elementWidth = 128; // vertical element width
    const elementHeight = 160; // vertical element height

    const left = (rect.width / 2) - (elementWidth / 2);
    const top = (rect.height / 2) - (elementHeight / 2);

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'book',
      left: Math.max(0, Math.min(left, rect.width - elementWidth)),
      top: Math.max(0, Math.min(top, rect.height - elementHeight)),
      text: bookData.title,
      orientation: 'vertical',
      bookData: {
        key: bookData.key,
        title: bookData.title,
        author: bookData.author_name || [],
        thumbnail: bookData.thumbnail,
        highResThumbnail: bookData.highResThumbnail,
        description: bookData.description,
        source: bookData.source
      }
    };

    setElements(prev => [...prev, newElement]);
  };

  const handleElementDoubleClick = (element: MapElement) => {
    if (element.type === 'book') {
      setBookDetailsModal(element);
    }
  };

  return (
    <DndContext 
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      <div className="h-[calc(100vh-4rem)] bg-white">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex gap-4">
            <h1 className="text-2xl font-bold">Maps</h1>
          </div>
          <div className="space-x-4">
            <button
              onClick={() => handleAddElement('horizontal')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Add Horizontal Element
            </button>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Add Vertical Element
            </button>
            {selectedElement && (
              <>
                <button
                  onClick={handleDeleteElement}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                >
                  Delete Element
                </button>
                <button
                  onClick={handleClearConnections}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
                >
                  Clear Connections
                </button>
              </>
            )}
          </div>
        </div>
        
        <div
          ref={containerRef}
          className="map-container with-grid"
          style={{ touchAction: 'none' }}
          onClick={handleContainerClick}
        >
          <Xwrapper>
            {elements.map((element) => (
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
              />
            ))}
            
            {connections.map((connection) => (
              <Xarrow
                key={connection.id}
                start={connection.start}
                end={connection.end}
                startAnchor={connection.startPoint}
                endAnchor={connection.endPoint}
                color="#666"
                strokeWidth={2}
                path="smooth"
                showHead={true}
              />
            ))}

            {TempConnectionMemo}

            {/* Alignment Guides */}
            {isDragging && alignmentGuides.map((guide, index) => (
              <div
                key={`${guide.type}-${guide.position}-${index}`}
                style={{
                  position: 'absolute',
                  backgroundColor: '#FF9675',
                  ...(guide.type === 'vertical'
                    ? {
                        width: '1px',
                        height: '100%',
                        left: `${guide.position}px`,
                        top: 0
                      }
                    : {
                        width: '100%',
                        height: '1px',
                        top: `${guide.position}px`,
                        left: 0
                      }),
                  zIndex: 1000,
                  pointerEvents: 'none'
                }}
              />
            ))}
          </Xwrapper>
        </div>

        {isSearchModalOpen && (
          <SearchModal 
            onClose={() => setIsSearchModalOpen(false)} 
            onBookSubmit={handleBookSubmit}
          />
        )}

        {bookDetailsModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={() => {
              setBookDetailsModal(null);
              setIsEditingDescription(false);
              setShowFullDescription(false);
            }}></div>
            <div className="bg-white rounded-lg w-[800px] h-[800px] relative flex flex-col">
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <button
                    onClick={() => {
                      setBookDetailsModal(null);
                      setIsEditingDescription(false);
                      setShowFullDescription(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Back to map
                  </button>
                </div>

                <div className="flex gap-8">
                  {/* Book cover */}
                  <div className="w-64 flex-shrink-0">
                    {bookDetailsModal.bookData?.thumbnail ? (
                      <img 
                        src={bookDetailsModal.bookData.highResThumbnail || bookDetailsModal.bookData.thumbnail} 
                        alt={bookDetailsModal.bookData.title}
                        className="w-full h-auto object-cover bg-gray-100"
                        style={{ borderRadius: 0 }}
                        onError={(e) => {
                          // Fallback to thumbnail if high-res fails to load
                          if (e.currentTarget.src !== bookDetailsModal.bookData?.thumbnail) {
                            e.currentTarget.src = bookDetailsModal.bookData?.thumbnail || '';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-80 bg-gray-200 flex items-center justify-center" style={{ borderRadius: 0 }}>
                        <span className="text-gray-400">No cover</span>
                      </div>
                    )}
                  </div>

                  {/* Book details */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{bookDetailsModal.bookData?.title}</h2>
                    <p className="text-lg text-gray-700 mb-4">
                      {Array.isArray(bookDetailsModal.bookData?.author) 
                        ? bookDetailsModal.bookData?.author.join(', ') 
                        : bookDetailsModal.bookData?.author}
                    </p>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mt-4 mb-6">
                      <div className="flex">
                        {[1,2,3,4,5].map((star) => (
                          <span key={star} className="text-gray-300">★</span>
                        ))}
                      </div>
                      <span className="text-gray-500">n/a</span>
                    </div>

                    {/* Description */}
                    <div className="mt-6">
                      <div className="flex justify-between items-start mb-2">
                        <button 
                          onClick={() => setIsEditingDescription(true)}
                          className="text-sm text-blue-500 hover:text-blue-700"
                        >
                          edit
                        </button>
                      </div>
                      {isLoadingDetails ? (
                        <div className="text-gray-500">Loading description...</div>
                      ) : isEditingDescription ? (
                        <div className="space-y-2">
                          <textarea
                            value={bookDetailsModal.bookData?.description || ''}
                            onChange={(e) => {
                              setBookDetailsModal(prev => prev ? {
                                ...prev,
                                bookData: {
                                  ...prev.bookData!,
                                  description: e.target.value
                                }
                              } : null);
                            }}
                            className="w-full h-32 p-2 border rounded-md text-gray-700 text-sm"
                            placeholder="Enter book description..."
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setIsEditingDescription(false)}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : bookDetailsModal.bookData?.description ? (
                        <div>
                          <p className="text-gray-700 text-sm">
                            {showFullDescription 
                              ? bookDetailsModal.bookData.description
                              : bookDetailsModal.bookData.description.slice(0, 420)}
                          </p>
                          {bookDetailsModal.bookData.description.length > 420 && (
                            <button
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                            >
                              {showFullDescription ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No description available</span>
                      )}
                    </div>

                    {/* Download links button */}
                    <button
                      className="mt-8 px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Request download links
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
} 