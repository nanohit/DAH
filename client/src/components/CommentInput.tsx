'use client';

import { useState, useRef, useEffect } from 'react';
import FormatToolbar from './FormatToolbar';

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  buttonText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}

export default function CommentInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write a comment... (Tab for formatting)',
  buttonText = 'Post',
  disabled = false,
  readOnly = false,
  onClick
}: CommentInputProps) {
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Adjust height on value change
  useEffect(() => {
    adjustTextareaHeight();
  }, [value]);

  const handleFormat = (type: string, selection: { start: number; end: number }) => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const currentText = input.value;
    let newText = currentText;
    let newCursorPos = selection.end;

    switch (type) {
      case 'bold':
        newText = currentText.slice(0, selection.start) + `**${currentText.slice(selection.start, selection.end)}**` + currentText.slice(selection.end);
        newCursorPos += 2;
        break;
      case 'italic':
        newText = currentText.slice(0, selection.start) + `*${currentText.slice(selection.start, selection.end)}*` + currentText.slice(selection.end);
        newCursorPos += 1;
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          const selectedText = currentText.slice(selection.start, selection.end);
          const linkText = selectedText || 'link';
          newText = currentText.slice(0, selection.start) + `[${linkText}](${url})` + currentText.slice(selection.end);
          newCursorPos = selection.start + newText.length;
        }
        break;
      case 'clear':
        newText = currentText.slice(selection.start, selection.end)
          .replace(/\*\*/g, '')  // Remove bold
          .replace(/\*/g, '')    // Remove italic
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
        newText = currentText.slice(0, selection.start) + newText + currentText.slice(selection.end);
        break;
    }

    onChange(newText);
    input.value = newText;
    input.focus();
    input.setSelectionRange(newCursorPos, newCursorPos);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-stretch relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustTextareaHeight();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            // Don't unfocus if clicking inside the component or the button
            const relatedTarget = e.relatedTarget as Node;
            if (!e.currentTarget.contains(relatedTarget) && !buttonRef.current?.contains(relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as any);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              setShowFormatToolbar(true);
            } else if (e.key === 'Escape') {
              setShowFormatToolbar(false);
            }
          }}
          placeholder={placeholder}
          className="flex-grow p-2 pr-[100px] border-none focus:outline-none text-[#000000] placeholder:text-gray-400 resize-none min-h-[40px] overflow-hidden"
          rows={1}
          readOnly={readOnly}
          onClick={onClick}
        />
        <button
          ref={buttonRef}
          onClick={(e) => {
            onSubmit(e as any);
            setIsFocused(false);
          }}
          className={`absolute right-0 top-0 bottom-0 px-6 bg-gray-600 text-white hover:bg-gray-700 transition-all duration-200 ${
            isFocused ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          disabled={disabled}
        >
          {buttonText}
        </button>
        <FormatToolbar
          inputRef={inputRef}
          isVisible={showFormatToolbar}
          onClose={() => setShowFormatToolbar(false)}
          onFormat={handleFormat}
        />
      </div>
    </div>
  );
} 