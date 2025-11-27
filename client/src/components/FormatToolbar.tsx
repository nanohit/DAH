'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type FormatType = 'bold' | 'italic' | 'clear';

export type SelectionRange = { start: number; end: number } | undefined;

interface FormatToolbarProps {
  onFormat: (type: FormatType, selection?: SelectionRange) => void;
  inputRef: React.RefObject<HTMLElement | null>;
  isVisible: boolean;
  onClose: () => void;
}

const STYLE_PROPERTIES = [
  'boxSizing',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'textTransform',
  'textAlign',
  'textIndent',
  'lineHeight',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

type StyleProperty = (typeof STYLE_PROPERTIES)[number];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(/ /g, '&nbsp;');

const computeTextareaSelectionMetrics = (input: HTMLTextAreaElement, start: number, end: number) => {
  const style = window.getComputedStyle(input);
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'hidden';
  mirror.style.width = `${input.clientWidth}px`;

  STYLE_PROPERTIES.forEach((prop) => {
    const value = style[prop];
    if (value) {
      mirror.style[prop] = value;
    }
  });

  const normalizedStart = Math.max(0, Math.min(start, input.value.length));
  const normalizedEnd = Math.max(0, Math.min(end, input.value.length));
  const before = input.value.substring(0, normalizedStart);
  const selected = input.value.substring(normalizedStart, Math.max(normalizedEnd, normalizedStart));
  const after = input.value.substring(Math.max(normalizedEnd, normalizedStart));

  mirror.innerHTML = `${escapeHtml(before)}<span data-selection>${escapeHtml(selected || ' ')}</span>${escapeHtml(after)}`;
  document.body.appendChild(mirror);

  const selectionSpan = mirror.querySelector('span[data-selection]');
  const spanRect = selectionSpan?.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();

  let metrics = {
    top: inputRect.top - input.scrollTop + window.scrollY,
    left: inputRect.left - input.scrollLeft + window.scrollX,
    width: 0,
  };

  if (spanRect) {
    metrics = {
      top: inputRect.top + (spanRect.top - mirrorRect.top) - input.scrollTop + window.scrollY,
      left: inputRect.left + (spanRect.left - mirrorRect.left) - input.scrollLeft + window.scrollX,
      width: spanRect.width,
    };
  }

  document.body.removeChild(mirror);
  return metrics;
};

const getSelectionMetrics = (input: HTMLElement) => {
  if (input instanceof HTMLTextAreaElement) {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    return computeTextareaSelectionMetrics(input, start, end);
  }

  const selection = window.getSelection();
  const fallbackRect = input.getBoundingClientRect();

  if (!selection || selection.rangeCount === 0) {
    return fallbackRect;
  }

  const range = selection.getRangeAt(0);
  const { startContainer, endContainer } = range;

  if (!input.contains(startContainer) || !input.contains(endContainer)) {
    return fallbackRect;
  }

  const rect = range.getBoundingClientRect();

  if (rect && rect.width === 0 && rect.height === 0) {
    const cloned = range.cloneRange();
    const marker = document.createElement('span');
    marker.appendChild(document.createTextNode('\u200b'));
    cloned.collapse(false);
    cloned.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);

    if (markerRect) {
      return markerRect;
    }
  }

  return rect || fallbackRect;
};

const getSelectionRange = (input: HTMLElement): SelectionRange => {
  if (input instanceof HTMLTextAreaElement) {
    return {
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? input.selectionStart ?? 0,
    };
  }
  return undefined;
};

export default function FormatToolbar({ onFormat, inputRef, isVisible, onClose }: FormatToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const rect = getSelectionMetrics(input);
    const selectionWidth = Math.max(rect.width, 1);
    const centerX = rect.left + selectionWidth / 2;
    const clampedLeft = Math.min(Math.max(centerX, 24), window.innerWidth - 24);
    const clampedTop = Math.max(rect.top - 12, 24);

    setPosition({ top: clampedTop + window.scrollY, left: clampedLeft + window.scrollX });
  }, [inputRef]);

  const handleToolbarMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const input = inputRef.current;
      if (!input) return;

      if (input instanceof HTMLTextAreaElement) {
        const selection = getSelectionRange(input);
        input.focus({ preventScroll: true });
        if (selection) {
          requestAnimationFrame(() => {
            input.setSelectionRange(selection.start, selection.end);
          });
        }
      } else {
        input.focus({ preventScroll: true });
      }
      updatePosition();
    },
    [inputRef, updatePosition],
  );

  const handleFormat = useCallback(
    (type: FormatType) => {
      const input = inputRef.current;
      const selection = input ? getSelectionRange(input) : undefined;
      onFormat(type, selection);
      requestAnimationFrame(() => updatePosition());
    },
    [onFormat, updatePosition, inputRef],
  );

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    updatePosition();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => updatePosition();

    const handleSelectionChange = () => updatePosition();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isVisible, onClose, updatePosition]);

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-white shadow-lg rounded-lg border border-gray-200 p-2 flex space-x-2"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -120%)',
      }}
    >
      <button
        type="button"
        onMouseDown={handleToolbarMouseDown}
        onClick={() => handleFormat('bold')}
        className="p-1 hover:bg-gray-100 rounded text-black"
        title="Bold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        </svg>
      </button>
      <button
        type="button"
        onMouseDown={handleToolbarMouseDown}
        onClick={() => handleFormat('italic')}
        className="p-1 hover:bg-gray-100 rounded text-black"
        title="Italic"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="4" x2="10" y2="4"></line>
          <line x1="14" y1="20" x2="5" y2="20"></line>
          <line x1="15" y1="4" x2="9" y2="20"></line>
        </svg>
      </button>
      <button
        type="button"
        onMouseDown={handleToolbarMouseDown}
        onClick={() => handleFormat('clear')}
        className="p-1 hover:bg-gray-100 rounded text-black"
        title="Clear Formatting"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
} 