'use client';

import { useState, useRef, useEffect } from 'react';
import FormatToolbar from './FormatToolbar';
import { sanitizeHtml } from '@/utils/html';

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  buttonText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
  showFormatToolbar?: boolean;
  setShowFormatToolbar?: (show: boolean) => void;
  inputRef?: React.RefObject<HTMLDivElement>;
  showSubmitButton?: boolean;
}

export default function CommentInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write a comment... (Tab for formatting)',
  buttonText = 'Post',
  disabled = false,
  readOnly = false,
  onClick,
  isLoading = false,
  showFormatToolbar: propShowFormatToolbar,
  setShowFormatToolbar: propSetShowFormatToolbar,
  inputRef: propInputRef,
  showSubmitButton = true,
}: CommentInputProps) {
  const [localShowFormatToolbar, setLocalShowFormatToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const localInputRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const showFormatToolbar = propShowFormatToolbar !== undefined ? propShowFormatToolbar : localShowFormatToolbar;
  const setShowFormatToolbar = propSetShowFormatToolbar || setLocalShowFormatToolbar;
  const inputRef = propInputRef || localInputRef;

  useEffect(() => {
    if (inputRef.current && inputRef.current.innerHTML !== value) {
      inputRef.current.innerHTML = value || '';
    }
  }, [value, inputRef]);

  const handleInput = () => {
    const rawHtml = inputRef.current?.innerHTML || '';
    const sanitized = sanitizeHtml(rawHtml);
    onChange(sanitized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setShowFormatToolbar(true);
    } else if (e.key === 'Escape') {
      setShowFormatToolbar(false);
    }
  };

  const handleToolbarAction = (action: 'bold' | 'italic' | 'link' | 'clear') => {
    const el = inputRef.current;
    if (!el || readOnly || disabled) return;

    el.focus();

    if (action === 'link') {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || 'link';
      const url = prompt('Enter URL:', selection?.toString() || 'https://');
      if (!url) return;

      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${selectedText}</a>`);
      handleInput();
      return;
    }

    if (action === 'clear') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
        return;
      }

      const fragment = range.cloneContents();
      const temp = document.createElement('div');
      temp.appendChild(fragment);

      temp.querySelectorAll('strong, b, em, i, a').forEach((node) => {
        const parent = node.parentNode;
        while (node.firstChild) {
          parent?.insertBefore(node.firstChild, node);
        }
        parent?.removeChild(node);
      });

      document.execCommand('insertHTML', false, temp.innerHTML);
      handleInput();
      return;
    }

    const command = action === 'bold' ? 'bold' : action === 'italic' ? 'italic' : undefined;
    if (command) {
      document.execCommand(command);
      handleInput();
    }
  };

  const isContentEmpty = !value || value
    .replace(/<p><br><\/p>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<br\s*\/?>(\s*)/gi, '')
    .replace(/&nbsp;/gi, '')
    .trim() === '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-stretch relative">
        <div
          ref={inputRef}
          contentEditable={!readOnly && !disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            const relatedTarget = e.relatedTarget as Node | null;
            if (!e.currentTarget.contains(relatedTarget) && (!showSubmitButton || !buttonRef.current?.contains(relatedTarget))) {
              setIsFocused(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onClick={onClick}
          className={`flex-grow p-2 ${showSubmitButton ? 'pr-[100px]' : 'pr-2'} border-none focus:outline-none text-[#000000] placeholder:text-gray-400 min-h-[40px] whitespace-pre-wrap break-words`}
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline="true"
        />
        {isContentEmpty && !isFocused && !value && (
          <span className="pointer-events-none absolute left-2 top-2 text-gray-400 select-none">
            {placeholder}
          </span>
        )}
        {showSubmitButton && (
          <button
            ref={buttonRef}
            onClick={(e) => {
              onSubmit(e as any);
              setIsFocused(false);
            }}
            className={`absolute right-0 top-0 bottom-0 px-6 bg-gray-600 text-white hover:bg-gray-700
              ${!isFocused ? 'opacity-0 pointer-events-none transition-opacity duration-0' : 
                isLoading ? 'opacity-50 transition-opacity duration-200' : 'opacity-100 transition-opacity duration-200'
              }`}
            disabled={disabled || isLoading}
          >
            {isLoading ? 'Posting...' : buttonText}
          </button>
        )}
        <FormatToolbar
          inputRef={inputRef}
          isVisible={showFormatToolbar}
          onClose={() => setShowFormatToolbar(false)}
          onFormat={(type) => handleToolbarAction(type)}
        />
      </div>
    </div>
  );
} 