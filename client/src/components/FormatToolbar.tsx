'use client';

import { useEffect, useState } from 'react';

interface FormatToolbarProps {
  onFormat: (type: string, selection: { start: number; end: number }) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isVisible: boolean;
  onClose: () => void;
}

export default function FormatToolbar({ onFormat, inputRef, isVisible, onClose }: FormatToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (!isVisible || !inputRef.current) return;

    const input = inputRef.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    setSelection({ start, end });

    // Calculate position above the selection
    const inputRect = input.getBoundingClientRect();
    const selectionCoords = getSelectionCoordinates(input);

    setPosition({
      top: selectionCoords.top - 40, // 40px above selection
      left: selectionCoords.left
    });
  }, [isVisible, inputRef]);

  const getSelectionCoordinates = (input: HTMLTextAreaElement) => {
    const start = input.selectionStart ?? 0;
    const value = input.value;
    const textBeforeSelection = value.substring(0, start);
    
    // Create a temporary element to measure text dimensions
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'pre-wrap';
    temp.style.font = window.getComputedStyle(input).font;
    temp.textContent = textBeforeSelection;
    document.body.appendChild(temp);

    const inputRect = input.getBoundingClientRect();
    const { width } = temp.getBoundingClientRect();
    document.body.removeChild(temp);

    return {
      top: inputRect.top + window.scrollY,
      left: inputRect.left + Math.min(width, inputRect.width - 150) // Ensure toolbar doesn't go off-screen
    };
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed z-50 bg-white shadow-lg rounded-lg border border-gray-200 p-2 flex space-x-2"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
      }}
    >
      <button
        onClick={() => onFormat('bold', selection)}
        className="p-1 hover:bg-gray-100 rounded"
        title="Bold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        </svg>
      </button>
      <button
        onClick={() => onFormat('italic', selection)}
        className="p-1 hover:bg-gray-100 rounded"
        title="Italic"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="4" x2="10" y2="4"></line>
          <line x1="14" y1="20" x2="5" y2="20"></line>
          <line x1="15" y1="4" x2="9" y2="20"></line>
        </svg>
      </button>
      <button
        onClick={() => onFormat('link', selection)}
        className="p-1 hover:bg-gray-100 rounded"
        title="Add Link"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </button>
      <button
        onClick={() => onFormat('clear', selection)}
        className="p-1 hover:bg-gray-100 rounded"
        title="Clear Formatting"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
} 