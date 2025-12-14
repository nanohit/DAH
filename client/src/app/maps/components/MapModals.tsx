'use client';

import {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import FormatToolbar, { FormatType, SelectionRange } from '@/components/FormatToolbar';
import ReactMarkdown from 'react-markdown';

export interface TextEditModalState {
  id: string;
  text: string;
  selectDefault?: boolean;
  selection?: { start: number; end: number };
}

interface TextEditModalProps {
  modalState: TextEditModalState | null;
  setModalState: Dispatch<SetStateAction<TextEditModalState | null>>;
  onSave: () => void;
  showFormatToolbar: boolean;
  setShowFormatToolbar: (value: boolean) => void;
  onFormat: (type: FormatType | 'link', selection?: SelectionRange) => void;
}

export const TextEditModal = ({
  modalState,
  setModalState,
  onSave,
  showFormatToolbar,
  setShowFormatToolbar,
  onFormat,
}: TextEditModalProps) => {
  const textEditRef = useRef<HTMLTextAreaElement>(null);
  const updateSelectionRange = useCallback(() => {
    const textarea = textEditRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    setShowFormatToolbar(end > start);
  }, [setShowFormatToolbar]);

  useEffect(() => {
    if (!modalState || !textEditRef.current) {
      return;
    }

    if (modalState.selectDefault) {
      requestAnimationFrame(() => {
        if (!textEditRef.current) return;
        textEditRef.current.focus();
        textEditRef.current.select();
        updateSelectionRange();
        setModalState((prev) => (prev ? { ...prev, selectDefault: false } : null));
      });
      return;
    }

    if (modalState.selection) {
      const { start, end } = modalState.selection;
      requestAnimationFrame(() => {
        if (!textEditRef.current) return;
        textEditRef.current.focus();
        textEditRef.current.setSelectionRange(start, end);
        updateSelectionRange();
        setModalState((prev) => (prev ? { ...prev, selection: undefined } : null));
      });
    }
  }, [modalState, setModalState, updateSelectionRange]);

  if (!modalState) return null;

  const handleRequestClose = () => {
    setShowFormatToolbar(false);
    setModalState(null);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setModalState({ ...modalState, text: event.target.value });
    requestAnimationFrame(updateSelectionRange);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSave();
      return;
    }

    if (event.key === 'Escape') {
      handleRequestClose();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'k') {
        event.preventDefault();
        const textarea = textEditRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? start;
        const formatType = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'link';
        onFormat(formatType, { start, end });
        requestAnimationFrame(updateSelectionRange);
      }
    }
  };

  return (
    <div id="textEditModal" className="fixed inset-0 flex items-center justify-center z-50" onWheel={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleRequestClose}></div>
      <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
        <div className="relative mb-4">
          <div
            className="pointer-events-none absolute inset-0 px-3 py-2 text-gray-900 whitespace-pre-wrap break-words"
            aria-hidden
          >
            {modalState.text.trim() ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <span className="block" style={{ pointerEvents: 'none' }}>{children}</span>,
                  strong: ({ children }) => <strong style={{ pointerEvents: 'none', color: '#111827' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ pointerEvents: 'none', color: '#111827' }}>{children}</em>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      style={{ pointerEvents: 'none', textDecoration: 'underline', color: '#111827' }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {modalState.text}
              </ReactMarkdown>
            ) : (
              <span className="text-gray-400">Start typing…</span>
            )}
          </div>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-transparent text-transparent caret-black selection:bg-gray-900/10 selection:text-transparent relative"
            rows={6}
            value={modalState.text}
            onChange={handleChange}
            autoFocus
            ref={textEditRef}
            onKeyDown={handleKeyDown}
            onSelect={updateSelectionRange}
            onKeyUp={updateSelectionRange}
            onMouseUp={updateSelectionRange}
            onInput={updateSelectionRange}
            onBlur={() => setShowFormatToolbar(false)}
            onFocus={updateSelectionRange}
            spellCheck
          />
        </div>
        <FormatToolbar
          onFormat={onFormat}
          inputRef={textEditRef}
          isVisible={showFormatToolbar}
          onClose={() => setShowFormatToolbar(false)}
        />
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleRequestClose}
            className="border border-gray-400/50 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="border border-gray-400/50 text-white bg-gray-800 hover-bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

interface LinkModalProps {
  onClose: () => void;
  onSubmit: (url: string, title?: string) => Promise<void> | void;
  isLoading: boolean;
}

export const LinkModal = ({ onClose, onSubmit, isLoading }: LinkModalProps) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    await onSubmit(normalizedUrl, title?.trim());
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onWheel={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Add Link</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com/article"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="border border-gray-400/50 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-800 disabled:opacity-50" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 0 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Add Link'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ImageUploadModalProps {
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
  isUploading: boolean;
}

export const ImageUploadModal = ({ onClose, onSubmit, isUploading }: ImageUploadModalProps) => {
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await onSubmit(file);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onWheel={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="bg-white rounded-lg p-6 shadow-xl relative max-w-md w-full">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Upload Image</h2>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="border border-gray-400/50 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface FullscreenImageModalProps {
  image: { url: string; alt?: string };
  onClose: () => void;
}

export const FullscreenImageModal = ({ image, onClose }: FullscreenImageModalProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={onClose}>
    <button
      onClick={onClose}
      className="absolute top-6 right-6 text-white hover:text-gray-200 transition-colors"
      aria-label="Close fullscreen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    <img
      src={image.url}
      alt={image.alt || 'Fullscreen image'}
      className="max-w-full max-h-[calc(100vh-8rem)] object-contain mx-auto shadow-xl"
    />
  </div>
);

