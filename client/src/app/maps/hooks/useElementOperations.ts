'use client';

import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { MapElement, BookSearchResult, Connection } from '../types';
import { DEFAULT_ELEMENT_TEXT, isDefaultText } from '../utils';

interface UseElementOperationsArgs {
  elements: MapElement[];
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  selectedElement: string | null;
  setSelectedElement: (id: string | null) => void;
  getViewportCenterInCanvas: () => { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement>;
  openFullscreenImage: (image: { url: string; alt?: string }) => void;
  setBookDetailsModal: (modal: any) => void;
  openTextEditModal: (id: string, text: string, selectDefault?: boolean) => void;
}

export const useElementOperations = ({
  elements,
  setElements,
  connections,
  setConnections,
  selectedElement,
  setSelectedElement,
  getViewportCenterInCanvas,
  containerRef,
  openFullscreenImage,
  setBookDetailsModal,
  openTextEditModal,
}: UseElementOperationsArgs) => {

  const handleAddElement = useCallback((orientation: 'horizontal' | 'vertical' = 'horizontal', viewportCenter?: { x: number; y: number }) => {
    if (!containerRef.current) return;

    const elementWidth = orientation === 'horizontal' ? 160 : 140;
    const elementHeight = orientation === 'horizontal' ? 128 : 200;

    const center = viewportCenter ?? getViewportCenterInCanvas();

    const left = center.x - (elementWidth / 2);
    const top = center.y - (elementHeight / 2);

    const canvasWidth = 2700;
    const canvasHeight = 2700;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'element',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
      width: elementWidth,
      height: elementHeight,
      text: DEFAULT_ELEMENT_TEXT,
      orientation,
    };

    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [containerRef, getViewportCenterInCanvas, setElements, setSelectedElement]);

  const handleBookSubmit = useCallback((bookData: BookSearchResult) => {
    if (!containerRef.current) return;

    const elementWidth = 140;
    const elementHeight = 220;

    const viewportCenter = getViewportCenterInCanvas();

    const left = viewportCenter.x - (elementWidth / 2);
    const top = viewportCenter.y - (elementHeight / 2);

    const canvasWidth = 2700;
    const canvasHeight = 2700;

    const newElement: MapElement = {
      id: `element-${Date.now()}`,
      type: 'book',
      left: Math.max(0, Math.min(left, canvasWidth - elementWidth)),
      top: Math.max(0, Math.min(top, canvasHeight - elementHeight)),
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
      }
    };

    setElements(prev => [...prev, newElement]);
  }, [containerRef, getViewportCenterInCanvas, setElements]);

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
      }
    };

    setElements(prev => [...prev, newElement]);
  }, [getViewportCenterInCanvas, setElements]);

  const handleDeleteElement = useCallback(() => {
    if (!selectedElement) return;

    setElements(prev => prev.filter(el => el.id !== selectedElement));
    setConnections(prev => prev.filter(conn =>
      conn.start !== selectedElement && conn.end !== selectedElement
    ));
    setSelectedElement(null);
  }, [selectedElement, setElements, setConnections, setSelectedElement]);

  const handleClearConnections = useCallback(() => {
    if (!selectedElement) return;

    setConnections(prev => prev.filter(conn =>
      conn.start !== selectedElement && conn.end !== selectedElement
    ));
  }, [selectedElement, setConnections]);

  const handleTextChange = useCallback((elementId: string, newText: string) => {
    setElements(prev => prev.map(element =>
      element.id === elementId ? { ...element, text: newText } : element
    ));
  }, [setElements]);

  const handleElementDoubleClick = useCallback((element: MapElement) => {
    if (element.type === 'book') {
      setBookDetailsModal(element);
    } else if (element.type === 'image' && element.imageData) {
      openFullscreenImage({
        url: element.imageData.url,
        alt: element.imageData.alt || 'Image',
      });
    } else if (element.type === 'link' && element.linkData) {
      window.open(element.linkData.url, '_blank');
    } else {
      openTextEditModal(element.id, isDefaultText(element.text) ? '' : element.text, !isDefaultText(element.text));
    }
  }, [openFullscreenImage, setBookDetailsModal, openTextEditModal]);

  const handleSaveText = useCallback((modal: { id: string; text: string } | null) => {
    if (!modal) return;

    setElements((prev) =>
      prev.map((element) =>
        element.id === modal.id
          ? { ...element, text: modal.text }
          : element,
      ),
    );
  }, [setElements]);

  const toggleBookCompleted = useCallback((elementId: string) => {
    const element = elements.find(el => el.id === elementId);

    if (!element || element.type !== 'book' || !element.bookData) {
      console.warn('[DEBUG] Cannot toggle completed - invalid element or missing bookData');
      return;
    }

    const newCompletedState = !element.bookData.completed;

    setElements(prev => {
      const updatedElements = prev.map(element => {
        if (element.id === elementId && element.type === 'book' && element.bookData) {
          const newBookData = {
            ...element.bookData,
            completed: newCompletedState
          };
          return {
            ...element,
            bookData: newBookData
          };
        }
        return element;
      });

      const completedCount = updatedElements.filter(
        (el: any) => el.type === 'book' && el.bookData && el.bookData.completed === true
      ).length;

      console.log(`[DEBUG] After update: ${completedCount} books marked as completed`);

      return updatedElements;
    });

    toast.success(newCompletedState ? 'Marked as completed' : 'Marked as not completed', {
      duration: 1500,
      position: 'bottom-center',
      style: {
        backgroundColor: newCompletedState ? '#000' : '#fff',
        color: newCompletedState ? '#fff' : '#000',
        border: newCompletedState ? 'none' : '1px solid #e5e7eb'
      }
    });
  }, [elements, setElements]);

  return {
    handleAddElement,
    handleBookSubmit,
    handleAddLine,
    handleDeleteElement,
    handleClearConnections,
    handleTextChange,
    handleElementDoubleClick,
    handleSaveText,
    toggleBookCompleted,
  };
};
