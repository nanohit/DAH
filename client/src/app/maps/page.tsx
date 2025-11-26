'use client';

import { useEffect, useRef, useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import MapToolbar from './components/Toolbar/MapToolbar';
import MapCanvas from './components/MapCanvas';
import { LinkModal, TextEditModal, FullscreenImageModal, TextEditModalState } from './components/MapModals';
import { SearchModal } from '@/components/Search/SearchModal';
import { calculateAlignmentGuides as calculateAlignmentGuidesUtil, DEFAULT_ELEMENT_TEXT, isDefaultText } from './utils';
import { MapElement } from './types';
import { usePanAndZoom } from './hooks/usePanAndZoom';
import { useCanvasState } from './hooks/useCanvasState';
import { useAutosave } from './hooks/useAutosave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useBookDetails } from './hooks/useBookDetails';
import { useConnections, getElementDimensions } from './hooks/useConnections';
import { useLinkModal } from './hooks/useLinkModal';
import { useImageModal } from './hooks/useImageModal';
import { useFullscreenImage } from './hooks/useFullscreenImage';
import { useMapHistory } from './hooks/useMapHistory';
import { saveMap, loadMap, deleteMap } from '@/utils/mapUtils';

const CANVAS_BOUNDS = 2700;

function MapsContent() {
  const {
    elements,
    setElements,
    connections,
    setConnections,
    selectedElement,
    setSelectedElement,
    alignmentGuides,
    setAlignmentGuides,
    updateElement,
    getAlignmentGuides,
    getSnapTransform,
    transformsRef,
  } = useCanvasState();

  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const mapId = searchParams.get('id');

  const [mapName, setMapName] = useState('Untitled Map');
  const [savedMapId, setSavedMapId] = useState<string | null>(null);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [textEditModal, setTextEditModal] = useState<TextEditModalState | null>(null);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);

  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const hiddenTextRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const connectionMadeRef = useRef(false);
  const pendingConnectionRef = useRef<{
    startId: string;
    startPoint: 'top' | 'right' | 'bottom' | 'left';
    targetId: string;
    targetAnchor: 'top' | 'right' | 'bottom' | 'left';
  } | null>(null);
  const isHistoryBatchingRef = useRef(false);
  
  const {
    scale,
    setScale,
    canvasPosition,
    setCanvasPosition,
    isPanning,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
  } = usePanAndZoom({
    isModalOpen: () => isSearchModalOpen || !!textEditModal || isLinkModalOpen || !!bookDetailsModal,
    containerRef,
  });

  const { undo, redo, resetBaseline, prepareExternalUpdate, beginBatch, endBatch } = useMapHistory({
    elements,
    connections,
    setElements,
    setConnections,
  });

  const resetBaselineRef = useRef(resetBaseline);
  const prepareExternalUpdateRef = useRef(prepareExternalUpdate);
  const beginBatchRef = useRef(beginBatch);
  const endBatchRef = useRef(endBatch);

  useEffect(() => {
    resetBaselineRef.current = resetBaseline;
  }, [resetBaseline]);

  useEffect(() => {
    prepareExternalUpdateRef.current = prepareExternalUpdate;
  }, [prepareExternalUpdate]);

  useEffect(() => {
    beginBatchRef.current = beginBatch;
  }, [beginBatch]);

  useEffect(() => {
    endBatchRef.current = endBatch;
  }, [endBatch]);

  const isCreatingConnectionRef = useRef(false);

  const getViewportCenterInCanvas = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 60;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const canvasCenterX = (viewportCenterX - canvasPosition.x) / scale;
    const canvasCenterY = (viewportCenterY - canvasPosition.y) / scale;

    return {
      x: Math.max(0, Math.min(canvasCenterX, CANVAS_BOUNDS)),
      y: Math.max(0, Math.min(canvasCenterY, CANVAS_BOUNDS)),
    };
  }, [canvasPosition.x, canvasPosition.y, scale]);

  const { fullscreenImage, openFullscreenImage, closeFullscreenImage } = useFullscreenImage();

  const {
    isLinkModalOpen,
    openLinkModal,
    closeLinkModal,
    isLoadingLinkPreview,
    handleLinkSubmit,
  } = useLinkModal({ containerRef, getViewportCenterInCanvas, setElements });

  const { openImageModal, isUploadingImage } = useImageModal({ containerRef, getViewportCenterInCanvas, setElements });

  const {
    bookDetailsModal,
    setBookDetailsModal,
    updateBookElement,
    isLoadingDetails,
    setIsLoadingDetails,
    isEditingDescription,
    setIsEditingDescription,
    showFullDescription,
    setShowFullDescription,
    openBookDetails,
    closeBookDetails,
    handleRequestDownloadLinks,
    handleVariantSelect,
    handleSaveDownloadLinks,
    isFlibustaSearching,
    setIsFlibustaSearching,
    flibustaResults,
    setFlibustaResults,
    selectedVariant,
    setSelectedVariant,
    showFlibustaResults,
    setShowFlibustaResults,
    flibustaError,
    setFlibustaError,
  } = useBookDetails({ onUpdateElement: updateElement });

  const {
    connectingFrom,
    tempConnection,
    setTempConnection,
    handleStartConnection,
    clearTempConnection,
    resolveClosestAnchorForElement,
    projectAnchorPositionForElement,
    getAnchorPositionForElement,
  } = useConnections({
    elements,
    scale,
    containerRef,
  });

  useEffect(() => {
    if (!mapId) {
      resetBaselineRef.current();
      return;
    }

    let isActive = true;

    loadMap(mapId)
      .then((data) => {
        if (!isActive) return;
        if (!data) {
          resetBaselineRef.current();
          return;
        }

        prepareExternalUpdateRef.current?.();
        setElements(data.elements ?? []);
        setConnections(data.connections ?? []);
        setCanvasPosition(data.canvasPosition ?? { x: 0, y: 0 });
        setScale(typeof data.scale === 'number' ? data.scale : 1);
        setMapName(data.name ?? 'Untitled Map');
        setIsPrivate(Boolean(data.isPrivate));
        setSavedMapId(data._id ?? null);

        requestAnimationFrame(() => resetBaselineRef.current());
      })
      .catch((err) => {
        if (!isActive) return;
        console.error('Failed to load map', err);
        toast.error('Error loading map');
      });

    return () => {
      isActive = false;
    };
  }, [mapId, setCanvasPosition, setConnections, setElements, setScale]);

  useEffect(() => {
    type ResizeEventDetail = {
      id: string;
      left: number;
      top: number;
      width: number;
      height: number;
    };

    const ensureBatch = () => {
      if (!isHistoryBatchingRef.current) {
        beginBatchRef.current?.();
        isHistoryBatchingRef.current = true;
      }
    };

    const handleResizeStart: EventListener = () => {
      ensureBatch();
    };

    const handleResizeProgress: EventListener = () => {
      ensureBatch();
    };

    const handleResizeEnd: EventListener = () => {
      if (!isHistoryBatchingRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        if (isHistoryBatchingRef.current) {
          endBatchRef.current?.();
          isHistoryBatchingRef.current = false;
        }
      });
    };

    document.addEventListener('element-resize-start', handleResizeStart);
    document.addEventListener('element-resize-progress', handleResizeProgress);
    document.addEventListener('element-resized', handleResizeEnd);

    return () => {
      document.removeEventListener('element-resize-start', handleResizeStart);
      document.removeEventListener('element-resize-progress', handleResizeProgress);
      document.removeEventListener('element-resized', handleResizeEnd);
      if (isHistoryBatchingRef.current) {
        endBatchRef.current?.();
        isHistoryBatchingRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!savedMapId) return;
    document.title = mapName ? `${mapName} - Alphy` : 'Alphy';
  }, [mapName, savedMapId]);

  const performSaveRef = useRef<() => Promise<boolean>>(async () => false);

  const performSave = useCallback(async (overrideIsPrivate?: boolean) => {
    if (!mapName.trim()) return false;

    const mapData = {
      name: mapName,
      elements,
      connections,
      canvasPosition,
      scale,
      canvasWidth: containerRef.current?.clientWidth ?? 1000,
      canvasHeight: containerRef.current?.clientHeight ?? 800,
      isPrivate: typeof overrideIsPrivate === 'boolean' ? overrideIsPrivate : isPrivate,
    };

    const saved = await saveMap(mapData, savedMapId ?? undefined);
    if (saved) {
      if (!savedMapId) {
        setSavedMapId(saved._id);
        window.history.pushState({}, '', `/maps?id=${saved._id}`);
      }
      if ('isPrivate' in saved) {
        setIsPrivate(Boolean(saved.isPrivate));
      }
    }
    return Boolean(saved);
  }, [mapName, elements, connections, canvasPosition, scale, isPrivate, savedMapId]);

  useEffect(() => {
    performSaveRef.current = () => performSave();
  }, [performSave]);

  useAutosave({
    elements,
    connections,
    canvasPosition,
    scale,
    mapName,
    savedMapId,
    isAutosaveEnabled,
    isPrivate,
    container: containerRef.current,
    performSaveRef,
    isAutoSaving,
    setIsAutoSaving,
  });

  const handleSaveMap = useCallback(async () => {
    setIsAutoSaving(true);
    try {
      return await performSave();
    } finally {
      setIsAutoSaving(false);
    }
  }, [performSave]);

  const handleSaveAndExit = useCallback(async () => {
    const saved = await handleSaveMap();
    if (saved) {
      router.push('/');
    }
  }, [handleSaveMap, router]);

  const handleToolbarSave = useCallback(async () => {
    await handleSaveMap();
  }, [handleSaveMap]);

  const handleDeleteMap = useCallback(async () => {
    if (!savedMapId) return;
    const success = await deleteMap(savedMapId);
    if (success) {
      toast.success('Map deleted successfully');
      router.push('/saved-maps');
    }
  }, [router, savedMapId]);

  const handleCopyShareLink = useCallback(() => {
    const shareUrl = window.location.href;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy link'));
  }, []);

  useEffect(() => {
    const adjustInputWidth = () => {
      if (!hiddenTextRef.current || !mapNameInputRef.current) return;
      const width = hiddenTextRef.current.offsetWidth + 12;
      const calculatedWidth = Math.max(Math.min(width, 420), 40);
      mapNameInputRef.current.style.width = `${calculatedWidth}px`;
    };

    adjustInputWidth();

    const resizeHandler = () => adjustInputWidth();
    window.addEventListener('resize', resizeHandler);
    const timeout = setTimeout(adjustInputWidth, 100);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      clearTimeout(timeout);
    };
  }, [mapName]);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
  }, []);

  useEffect(() => {
    document.body.classList.add('maps-page');
    return () => {
      document.body.classList.remove('maps-page');
    };
  }, []);

  const calculateAlignmentGuides = useCallback(
    (activeId: string, x: number, y: number) => calculateAlignmentGuidesUtil(elements, activeId, x, y),
    [elements],
  );

  const handleDragStart = useCallback(
    (_elementId: string, { altKey }: { altKey: boolean }) => {
      setAlignmentGuides([]);
      setIsDuplicating(altKey);
    },
    [setAlignmentGuides],
  );

  const moveElement = useCallback(
    (id: string, left: number, top: number) => {
    updateElement(id, (element) => ({ ...element, left, top }));
    },
    [updateElement],
  );

  const handleDragMove = useCallback(
    (elementId: string, delta: { x: number; y: number }) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      const transform = transformsRef.current[elementId];
      const deltaX = transform?.x ?? delta.x;
      const deltaY = transform?.y ?? delta.y;

      const newLeft = element.left + deltaX;
      const newTop = element.top + deltaY;

      const guides = getAlignmentGuides(elementId, newLeft, newTop);
      setAlignmentGuides(guides);
    },
    [elements, getAlignmentGuides, setAlignmentGuides, transformsRef],
  );

  const handleDragEnd = useCallback(
    (elementId: string, delta: { x: number; y: number }, { altKey }: { altKey: boolean }) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      const fallback = {
        x: delta.x,
        y: delta.y,
      };

      const dragTransform = transformsRef.current[elementId] ?? fallback;

      const snappedTransform = getSnapTransform({
        transform: dragTransform,
        active: { id: elementId },
        draggingElement: element,
        elements,
      });

      const newLeft = element.left + snappedTransform.x;
      const newTop = element.top + snappedTransform.y;

      transformsRef.current[elementId] = null;

      if (isDuplicating || altKey) {
        const duplicate: MapElement = {
          ...element,
          id: `element-${Date.now()}`,
          left: newLeft,
          top: newTop,
        };
        setElements((prev) => [...prev, duplicate]);
        setSelectedElement(duplicate.id);
      } else {
        moveElement(elementId, newLeft, newTop);
      }

      setAlignmentGuides([]);
      setIsDuplicating(false);
    },
    [elements, getSnapTransform, isDuplicating, moveElement, setElements, setAlignmentGuides, setSelectedElement, transformsRef],
  );

  const handleAddElement = useCallback(
    (orientation: 'horizontal' | 'vertical' = 'horizontal') => {
      if (!containerRef.current) return;

      const elementWidth = orientation === 'horizontal' ? 160 : 140;
      const elementHeight = orientation === 'horizontal' ? 128 : 200;

      const viewportCenter = getViewportCenterInCanvas();
      const left = viewportCenter.x - elementWidth / 2;
      const top = viewportCenter.y - elementHeight / 2;

      const newElement: MapElement = {
        id: `element-${Date.now()}`,
        type: 'element',
        left: Math.max(0, Math.min(left, CANVAS_BOUNDS - elementWidth)),
        top: Math.max(0, Math.min(top, CANVAS_BOUNDS - elementHeight)),
        width: elementWidth,
        height: elementHeight,
        text: DEFAULT_ELEMENT_TEXT,
        orientation,
      };

      setElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    },
    [containerRef, getViewportCenterInCanvas, setElements, setSelectedElement],
  );

  const handleBackgroundPointerDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | SVGElement | null;
      if (!target) return;

      const isInteractiveTarget =
        !!(target as HTMLElement).closest?.('.map-element') ||
        !!(target as HTMLElement).closest?.('[data-element-id]') ||
        !!(target as HTMLElement).closest?.('.line-handle') ||
        !!(target as HTMLElement).closest?.('.resize-handle');

      if (isInteractiveTarget) {
        return;
      }

      setSelectedElement(null);
      setAlignmentGuides([]);
    },
    [setAlignmentGuides, setSelectedElement],
  );

  const handleBackgroundDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (textEditModal || isSearchModalOpen || isLinkModalOpen || bookDetailsModal) {
        return;
      }

      if (!containerRef.current) {
        return;
      }

      const target = event.target as HTMLElement | SVGElement | null;
      if (target) {
        const isInteractive =
          (target as HTMLElement).closest?.('.map-element') ||
          (target as HTMLElement).closest?.('[data-element-id]') ||
          (target as HTMLElement).closest?.('.line-handle') ||
          (target as HTMLElement).closest?.('.resize-handle');
        if (isInteractive) {
          return;
        }
      }

      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (event.clientX - rect.left) / scale;
      const canvasY = (event.clientY - rect.top) / scale;

      const elementWidth = 160;
      const elementHeight = 128;

      const left = Math.max(0, Math.min(canvasX - elementWidth / 2, CANVAS_BOUNDS - elementWidth));
      const top = Math.max(0, Math.min(canvasY - elementHeight / 2, CANVAS_BOUNDS - elementHeight));

      const newElement: MapElement = {
        id: `element-${Date.now()}`,
        type: 'element',
        left,
        top,
        width: elementWidth,
        height: elementHeight,
        text: DEFAULT_ELEMENT_TEXT,
        orientation: 'horizontal',
      };

      setElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
      setAlignmentGuides([]);
      setTextEditModal({ id: newElement.id, text: '', selectDefault: true });
      setShowFormatToolbar(false);
    },
    [bookDetailsModal, containerRef, isLinkModalOpen, isSearchModalOpen, scale, setElements, setAlignmentGuides, setSelectedElement, setShowFormatToolbar, textEditModal],
  );

  const handleElementDoubleClick = useCallback(
    (element: MapElement) => {
      if (element.type === 'book') {
        setBookDetailsModal(element);
        return;
      }
      if (element.type === 'image' && element.imageData) {
        openFullscreenImage({ url: element.imageData.url, alt: element.imageData.alt || 'Image' });
        return;
      }
      if (element.type === 'link' && element.linkData) {
        window.open(element.linkData.url, '_blank');
        return;
      }

      const defaultText = isDefaultText(element.text);
      setShowFormatToolbar(false);
      setTextEditModal({ id: element.id, text: defaultText ? '' : element.text, selectDefault: !defaultText });
    },
    [openFullscreenImage, setBookDetailsModal, setShowFormatToolbar],
  );

  const shouldIgnoreShortcuts = useCallback(() => {
    if (textEditModal || isSearchModalOpen || isLinkModalOpen || bookDetailsModal) {
      return true;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement) {
      return false;
    }

    if (activeElement.closest('#textEditModal')) {
      return true;
    }

    const tag = activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || activeElement.getAttribute('contenteditable') === 'true') {
      return true;
    }

    return false;
  }, [bookDetailsModal, isLinkModalOpen, isSearchModalOpen, textEditModal]);

  const handleSpaceCreateElement = useCallback(() => {
    handleAddElement('horizontal');
  }, [handleAddElement]);

  const handleSpaceOpenSelected = useCallback(() => {
    if (!selectedElement) {
      return;
    }

    const element = elements.find((el) => el.id === selectedElement);
    if (!element) {
      return;
    }

    handleElementDoubleClick(element);
  }, [elements, handleElementDoubleClick, selectedElement]);

  const handleUndo = useCallback(() => {
    const undone = undo();
    if (undone) {
      setSelectedElement(null);
      setAlignmentGuides([]);
      setShowFormatToolbar(false);
      setTextEditModal(null);
    }
  }, [setAlignmentGuides, setSelectedElement, setShowFormatToolbar, setTextEditModal, undo]);

  const handleRedo = useCallback(() => {
    const redone = redo();
    if (redone) {
      setSelectedElement(null);
      setAlignmentGuides([]);
      setShowFormatToolbar(false);
      setTextEditModal(null);
    }
  }, [redo, setAlignmentGuides, setSelectedElement, setShowFormatToolbar, setTextEditModal]);

  useKeyboardShortcuts({
    onSave: handleSaveMap,
    onDeleteSelected: () => {
      if (!selectedElement) return;
      setElements((prev) => prev.filter((el) => el.id !== selectedElement));
      setConnections((prev) => prev.filter((conn) => conn.start !== selectedElement && conn.end !== selectedElement));
      setSelectedElement(null);
      setShowFormatToolbar(false);
      setTextEditModal(null);
    },
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSpace: handleSpaceCreateElement,
    onSpaceWithSelection: handleSpaceOpenSelected,
    selectedElement,
    setIsAltKeyPressed,
    setIsDuplicating,
    shouldIgnoreShortcuts,
  });

  const handleBookSubmit = useCallback(
    (bookData: any) => {
    if (!containerRef.current) return;

      const elementWidth = 140;
      const elementHeight = 220;
    const viewportCenter = getViewportCenterInCanvas();
    
      const left = viewportCenter.x - elementWidth / 2;
      const top = viewportCenter.y - elementHeight / 2;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'book',
        left: Math.max(0, Math.min(left, CANVAS_BOUNDS - elementWidth)),
        top: Math.max(0, Math.min(top, CANVAS_BOUNDS - elementHeight)),
        width: elementWidth,
        height: elementHeight,
      text: bookData.title,
      orientation: 'vertical',
      bookData: {
        key: bookData.key,
          _id: bookData._id,
        title: bookData.title,
        author: bookData.author_name || [],
        thumbnail: bookData.thumbnail,
        highResThumbnail: bookData.highResThumbnail,
        description: bookData.description,
        source: bookData.source,
        flibustaStatus: bookData.flibustaStatus,
        flibustaVariants: bookData.flibustaVariants,
          completed: false,
        },
      };

      setElements((prev) => [...prev, newElement]);
    },
    [containerRef, getViewportCenterInCanvas, setElements],
  );

  const handleAddLine = useCallback(() => {
    if (!containerRef.current) return;

    const viewportCenter = getViewportCenterInCanvas();
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
      },
    };

    setElements((prev) => [...prev, newElement]);
  }, [getViewportCenterInCanvas, setElements]);

  const handleDeleteElement = useCallback(() => {
    if (!selectedElement) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedElement));
    setConnections((prev) => prev.filter((conn) => conn.start !== selectedElement && conn.end !== selectedElement));
    setSelectedElement(null);
  }, [selectedElement, setConnections, setElements, setSelectedElement]);

  const handleClearConnections = useCallback(() => {
    if (!selectedElement) return;
    setConnections((prev) => prev.filter((conn) => conn.start !== selectedElement && conn.end !== selectedElement));
  }, [selectedElement, setConnections]);

  const handleTextChange = useCallback(
    (elementId: string, newText: string) => {
      setElements((prev) =>
        prev.map((element) => (element.id === elementId ? { ...element, text: newText } : element)),
      );
    },
    [setElements],
  );

  const handleSaveText = useCallback(() => {
    if (!textEditModal) return;

    setElements((prev) =>
      prev.map((element) =>
        element.id === textEditModal.id
          ? {
              ...element,
              text: textEditModal.text,
            }
          : element,
      ),
    );
    setShowFormatToolbar(false);
    setTextEditModal(null);
  }, [setElements, setShowFormatToolbar, textEditModal]);

  const toggleBookCompleted = useCallback(
    (elementId: string) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element || element.type !== 'book' || !element.bookData) return;

      const newCompleted = !element.bookData.completed;
      setElements((prev) =>
        prev.map((el) =>
          el.id === elementId && el.type === 'book' && el.bookData
            ? { ...el, bookData: { ...el.bookData, completed: newCompleted } }
            : el,
        ),
      );

      toast.success(newCompleted ? 'Marked as completed' : 'Marked as not completed');
    },
    [elements, setElements],
  );

  useEffect(() => {
    if (!connectingFrom || !containerRef.current) {
      connectionMadeRef.current = false;
      pendingConnectionRef.current = null;
      return;
    }

    connectionMadeRef.current = false;
    pendingConnectionRef.current = null;

    const updateTemp = (event: MouseEvent) => {
      if (!containerRef.current) return { canvasX: 0, canvasY: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (event.clientX - rect.left) / scale;
      const canvasY = (event.clientY - rect.top) / scale;

      setTempConnection((prev) =>
        prev
          ? { ...prev, x: canvasX, y: canvasY }
          : { x: canvasX, y: canvasY, targetElementId: null, targetAnchor: null },
      );

      return { canvasX, canvasY };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (connectionMadeRef.current || !containerRef.current) {
        return;
      }

      const { canvasX, canvasY } = updateTemp(event);

      const hoveredElements = document.elementsFromPoint(event.clientX, event.clientY);
      const targetElementNode = hoveredElements.find(
        (el) => el.classList.contains('map-element') && el.id !== connectingFrom.elementId,
      ) as HTMLElement | undefined;

      if (!targetElementNode) {
        pendingConnectionRef.current = null;
        setTempConnection((prev) => (prev ? { ...prev, targetElementId: null, targetAnchor: null } : prev));
        return;
      }

      const targetElement = elements.find((el) => el.id === targetElementNode.id);
      if (!targetElement) {
        pendingConnectionRef.current = null;
        setTempConnection((prev) => (prev ? { ...prev, targetElementId: null, targetAnchor: null } : prev));
        return;
      }

      const previousAnchor =
        pendingConnectionRef.current && pendingConnectionRef.current.targetId === targetElement.id
          ? pendingConnectionRef.current.targetAnchor
          : null;

      const targetAnchor = resolveClosestAnchorForElement(targetElement.id, canvasX, canvasY, previousAnchor);
      if (!targetAnchor) {
        pendingConnectionRef.current = null;
        setTempConnection((prev) => (prev ? { ...prev, targetElementId: null, targetAnchor: null } : prev));
        return;
      }

      const anchorPosition = projectAnchorPositionForElement(
        targetElement.id,
        targetAnchor,
        canvasX,
        canvasY,
      ) ?? getAnchorPositionForElement(targetElement.id, targetAnchor);
      if (anchorPosition) {
        const { width: targetWidth, height: targetHeight } = getElementDimensions(targetElement);
        const surfacePadding = 6;

        const clamped = { x: anchorPosition.x, y: anchorPosition.y };

        switch (targetAnchor) {
          case 'left':
            clamped.x = Math.min(anchorPosition.x, targetElement.left + surfacePadding);
            clamped.y = Math.min(Math.max(anchorPosition.y, targetElement.top), targetElement.top + targetHeight);
            break;
          case 'right':
            clamped.x = Math.max(anchorPosition.x, targetElement.left + targetWidth - surfacePadding);
            clamped.y = Math.min(Math.max(anchorPosition.y, targetElement.top), targetElement.top + targetHeight);
            break;
          case 'top':
            clamped.y = Math.min(anchorPosition.y, targetElement.top + surfacePadding);
            clamped.x = Math.min(Math.max(anchorPosition.x, targetElement.left), targetElement.left + targetWidth);
            break;
          case 'bottom':
            clamped.y = Math.max(anchorPosition.y, targetElement.top + targetHeight - surfacePadding);
            clamped.x = Math.min(Math.max(anchorPosition.x, targetElement.left), targetElement.left + targetWidth);
            break;
          default:
            break;
        }

        setTempConnection((prev) => ({
          x: clamped.x,
          y: clamped.y,
          targetElementId: targetElement.id,
          targetAnchor,
        }));
      }

      pendingConnectionRef.current = {
        startId: connectingFrom.elementId,
        startPoint: connectingFrom.point,
        targetId: targetElement.id,
        targetAnchor,
      };
    };

    const handleMouseUp = () => {
      if (connectionMadeRef.current || !pendingConnectionRef.current) {
        connectionMadeRef.current = false;
        pendingConnectionRef.current = null;
        clearTempConnection();
        return;
      }

      const { startId, startPoint, targetAnchor, targetId } = pendingConnectionRef.current;
      setConnections((prev) => [
        ...prev,
        {
          id: `connection-${Date.now()}`,
          start: startId,
          end: targetId,
          startPoint,
          endPoint: targetAnchor,
        },
      ]);

      connectionMadeRef.current = true;
      pendingConnectionRef.current = null;
      clearTempConnection();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, { once: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    connectingFrom,
    elements,
    scale,
    setConnections,
    clearTempConnection,
    resolveClosestAnchorForElement,
    getAnchorPositionForElement,
    setTempConnection,
  ]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      if (!target.classList.contains('line-handle')) return;

      const elementId = target.getAttribute('data-element-id');
      const handle = target.getAttribute('data-handle');
      if (!elementId || !handle) return;

      e.stopPropagation();
      e.preventDefault();

      const mouseMove = (moveEvent: MouseEvent) => {
    if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left;
        const y = moveEvent.clientY - rect.top;

        setElements((prev) =>
          prev.map((element) => {
            if (element.id !== elementId || !element.lineData) return element;
          return { 
            ...element, 
              lineData: {
                ...element.lineData,
                ...(handle === 'start'
                  ? { startX: x, startY: y }
                  : { endX: x, endY: y }),
              },
            };
          }),
        );
      };

      const mouseUp = () => {
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
      };

      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseUp);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setElements]);

  const handleMapNameBlur = useCallback(async () => {
    if (!savedMapId || !mapName.trim()) return;
    await handleSaveMap();
  }, [handleSaveMap, mapName, savedMapId]);

  const handlePrivacyChange = useCallback(
    async (next: boolean) => {
      setIsPrivate(next);
    if (savedMapId) {
        await performSave(next);
      }
    },
    [performSave, savedMapId],
  );

  const handleAddLink = useCallback(() => openLinkModal(), [openLinkModal]);

  const handleTextModalFormat = useCallback(
    (type: string, selection: { start: number; end: number }) => {
      setTextEditModal((current) => {
        if (!current) {
          return current;
        }

        const { start, end } = selection;
        const text = current.text;
        const selectionLength = end - start;
        const before = text.slice(0, start);
        const selected = text.slice(start, end);
        const after = text.slice(end);

        const wrapSelection = (
          wrapStart: string,
          wrapEnd: string,
          placeholder: string,
        ): { formatted: string; selection: { start: number; end: number } } => {
          if (selectionLength === 0) {
            const insertion = `${wrapStart}${placeholder}${wrapEnd}`;
            return {
              formatted: `${before}${insertion}${after}`,
              selection: {
                start: start + wrapStart.length,
                end: start + wrapStart.length + placeholder.length,
              },
            };
          }

          return {
            formatted: `${before}${wrapStart}${selected}${wrapEnd}${after}`,
            selection: {
              start: start + wrapStart.length,
              end: end + wrapStart.length,
            },
          };
        };

        let result: { formatted: string; selection: { start: number; end: number } } | null = null;

        switch (type) {
          case 'bold': {
            result = wrapSelection('**', '**', 'bold text');
            break;
          }
          case 'italic': {
            result = wrapSelection('*', '*', 'italic text');
            break;
          }
          case 'link': {
            if (selectionLength === 0) {
              const placeholder = 'link text';
              const urlPlaceholder = 'https://';
              const linkMarkup = `[${placeholder}](${urlPlaceholder})`;
              const formatted = `${before}${linkMarkup}${after}`;
              const urlStart = start + placeholder.length + 3; // 3 chars for "[]("
              result = {
                formatted,
                selection: { start: urlStart, end: urlStart + urlPlaceholder.length },
              };
            } else {
              const urlPlaceholder = 'https://';
              const linkMarkup = `[${selected}](${urlPlaceholder})`;
              const formatted = `${before}${linkMarkup}${after}`;
              const urlStart = start + selected.length + 3;
              result = {
                formatted,
                selection: { start: urlStart, end: urlStart + urlPlaceholder.length },
              };
            }
            break;
          }
          case 'clear': {
            const cleaned = selected
              .replace(/\*\*/g, '')
              .replace(/\*/g, '')
              .replace(/_/g, '')
              .replace(/`/g, '')
              .replace(/\[(.*?)\]\((.*?)\)/g, '$1');
            const formatted = `${before}${cleaned}${after}`;
            result = {
              formatted,
              selection: { start, end: start + cleaned.length },
            };
            break;
          }
          default:
            return current;
        }

        if (!result) {
          return current;
        }

        return {
          ...current,
          text: result.formatted,
          selection: result.selection,
          selectDefault: false,
        };
      });
    },
    [],
  );

  return (
    <>
      <div className="fixed inset-0 top-[60px] bg-white">
        <MapToolbar
          mapName={mapName}
          onChangeMapName={setMapName}
          onBlurMapName={handleMapNameBlur}
          onSave={handleToolbarSave}
          onSaveAndExit={handleSaveAndExit}
          isAutosaveEnabled={isAutosaveEnabled}
          onToggleAutosave={() => setIsAutosaveEnabled((prev) => !prev)}
          isAutoSaving={isAutoSaving}
          onSetPrivacy={handlePrivacyChange}
          isPrivate={isPrivate}
          onCopyShareLink={handleCopyShareLink}
          linkCopied={linkCopied}
          onDeleteMap={handleDeleteMap}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          dropdownRef={dropdownRef}
          mapNameInputRef={mapNameInputRef}
          hiddenTextRef={hiddenTextRef}
          canDelete={Boolean(savedMapId)}
        />

        <div className="absolute md:top-5 md:left-1/2 md:-translate-x-1/2 top-60 left-2 bg-white rounded-lg shadow-lg p-2 md:flex md:items-center md:flex-row flex-col items-start gap-2 z-50 md:h-14">
                          <button 
            onClick={() => handleAddElement('horizontal')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
          </button>
          <button
            onClick={handleAddLine}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Line"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
          </button>
          <button
            onClick={handleAddLink}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <button
            onClick={openImageModal}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
            title="Add Book"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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

        <div className="h-full w-full overflow-hidden relative">
  <MapCanvas
    elements={elements}
                    setElements={setElements}
    connections={connections}
    setConnections={setConnections}
    selectedElement={selectedElement}
    setSelectedElement={setSelectedElement}
    alignmentGuides={alignmentGuides}
    setAlignmentGuides={setAlignmentGuides}
    isDuplicating={isDuplicating}
    setIsDuplicating={setIsDuplicating}
    isAltKeyPressed={isAltKeyPressed}
                    containerRef={containerRef}
    canvasPosition={canvasPosition}
                    scale={scale}
    isPanning={isPanning}
    handlePanStart={handlePanStart}
    handlePanMove={handlePanMove}
    handlePanEnd={handlePanEnd}
    handleDragStart={handleDragStart}
    handleDragMove={handleDragMove}
    handleDragEnd={handleDragEnd}
    handleContainerClick={(e) => {
      handleBackgroundPointerDown(e as ReactMouseEvent<HTMLDivElement>);
    }}
    handleBackgroundPointerDown={handleBackgroundPointerDown}
    handleBackgroundDoubleClick={handleBackgroundDoubleClick}
    handleStartConnection={handleStartConnection}
    connectingFrom={connectingFrom}
    tempConnection={tempConnection}
            handleElementClick={setSelectedElement}
    handleTextChange={handleTextChange}
    handleDoubleClick={handleElementDoubleClick}
            handleToggleCompleted={toggleBookCompleted}
    drawConnections
    drawAlignmentGuides
    transformsRef={transformsRef}
  />
        </div>
        </div>

      {textEditModal && (
        <TextEditModal
          modalState={textEditModal}
          setModalState={setTextEditModal}
          onSave={handleSaveText}
          showFormatToolbar={showFormatToolbar}
          setShowFormatToolbar={setShowFormatToolbar}
          onFormat={handleTextModalFormat}
        />
      )}

      {isLinkModalOpen && (
          <LinkModal
          onClose={closeLinkModal}
          onSubmit={handleLinkSubmit}
          isLoading={isLoadingLinkPreview}
          />
      )}

      {fullscreenImage && (
        <FullscreenImageModal image={fullscreenImage} onClose={closeFullscreenImage} />
      )}

      {isSearchModalOpen && (
        <SearchModal
          onClose={() => setIsSearchModalOpen(false)}
          onBookSubmit={handleBookSubmit}
        />
      )}
    </>
  );
}

export default MapsContent;
