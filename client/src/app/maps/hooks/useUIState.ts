'use client';

import { useState, useCallback, useRef } from 'react';

export const useUIState = () => {
  // Drag and interaction states
  const [isDragging, setIsDragging] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false);

  // Line handle dragging state
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState<{
    elementId: string;
    handle: 'start' | 'end';
  } | null>(null);

  // Autosave state
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);

  // Bookmark hover state
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  // Refs for managing input width
  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const hiddenTextRef = useRef<HTMLSpanElement>(null);

  // Helper functions for common UI state patterns
  const setDragState = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  const setDuplicationState = useCallback((duplicating: boolean) => {
    setIsDuplicating(duplicating);
  }, []);

  const setAltKeyState = useCallback((pressed: boolean) => {
    setIsAltKeyPressed(pressed);
  }, []);

  const setLineHandleDragState = useCallback((state: { elementId: string; handle: 'start' | 'end' } | null) => {
    setIsDraggingLineHandle(state);
  }, []);

  const setAutosaveState = useCallback((enabled: boolean) => {
    setIsAutosaveEnabled(enabled);
  }, []);

  const setBookmarkHoverState = useCallback((hovered: boolean) => {
    setIsBookmarkHovered(hovered);
  }, []);

  // Function to adjust input width based on content (extracted from main component)
  const adjustInputWidth = useCallback(() => {
    if (hiddenTextRef.current && mapNameInputRef.current) {
      const width = hiddenTextRef.current.offsetWidth + 12;
      const calculatedWidth = Math.max(Math.min(width, 420), 40);
      mapNameInputRef.current.style.width = `${calculatedWidth}px`;
    }
  }, []);

  return {
    // States
    isDragging,
    isDuplicating,
    isAltKeyPressed,
    isDraggingLineHandle,
    isAutosaveEnabled,
    isBookmarkHovered,

    // Refs
    mapNameInputRef,
    hiddenTextRef,

    // State setters
    setIsDragging,
    setIsDuplicating,
    setIsAltKeyPressed,
    setIsDraggingLineHandle,
    setIsAutosaveEnabled,
    setIsBookmarkHovered,

    // Helper functions
    setDragState,
    setDuplicationState,
    setAltKeyState,
    setLineHandleDragState,
    setAutosaveState,
    setBookmarkHoverState,
    adjustInputWidth,
  };
};
