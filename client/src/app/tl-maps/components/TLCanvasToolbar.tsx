'use client';

import { Editor, toRichText, useEditor, useValue } from 'tldraw';
import { useState, useCallback, useRef, useEffect } from 'react';

interface TLCanvasToolbarProps {
  editor: Editor | null;
  onAddImage: () => void;
  isUploadingImage: boolean;
  showUi: boolean;
  onToggleUi: () => void;
  canToggleUi?: boolean;
}

// Separate component that uses tldraw hooks for reactive tool tracking
function ToolButton({ 
  tool, 
  onClick, 
  title, 
  children 
}: { 
  tool: string; 
  onClick: () => void; 
  title: string; 
  children: React.ReactNode;
}) {
  const editor = useEditor();
  
  // Use tldraw's reactive hook for instant updates
  const isActive = useValue(
    'is tool active',
    () => editor.getCurrentToolId() === tool,
    [editor, tool]
  );

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
        isActive ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100 text-gray-700'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

// Wrapper to provide editor context
function ToolbarWithEditor({ 
  editor, 
  onAddImage, 
  isUploadingImage,
  showUi,
  onToggleUi,
  canToggleUi = true,
}: TLCanvasToolbarProps) {
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMoreDropdown(false);
      }
    };
    if (showMoreDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreDropdown]);

  const handleSelectTool = useCallback((tool: string) => {
    if (!editor) return;
    editor.setCurrentTool(tool);
  }, [editor]);

  const handleAddText = useCallback(() => {
    if (!editor) return;
    editor.setCurrentTool('text');
  }, [editor]);

  // Add text box (filled rectangle with text label)
  const handleAddTextBox = useCallback(() => {
    if (!editor) return;
    
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    
    editor.createShape({
      type: 'geo',
      x: point.x - 100,
      y: point.y - 40,
      props: {
        w: 200,
        h: 80,
        geo: 'rectangle',
        color: 'black',
        fill: 'solid',
        richText: toRichText('Text'),
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
      },
    });
    
    editor.setCurrentTool('select');
  }, [editor]);

  // Shape creation handlers
  const handleAddShape = useCallback((geoType: string) => {
    if (!editor) return;
    
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    
    editor.createShape({
      type: 'geo',
      x: point.x - 50,
      y: point.y - 50,
      props: {
        w: 100,
        h: 100,
        geo: geoType,
        color: 'black',
        fill: 'none',
      },
    });
    
    editor.setCurrentTool('select');
    setShowMoreDropdown(false);
  }, [editor]);

  const handleAddNote = useCallback(() => {
    if (!editor) return;
    
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    
    editor.createShape({
      type: 'note',
      x: point.x - 100,
      y: point.y - 100,
      props: {
        size: 'm',
        color: 'yellow',
      },
    });
    
    editor.setCurrentTool('select');
    setShowMoreDropdown(false);
  }, [editor]);

  const handleAddFrame = useCallback(() => {
    if (!editor) return;
    
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    
    editor.createShape({
      type: 'frame',
      x: point.x - 150,
      y: point.y - 100,
      props: {
        w: 300,
        h: 200,
        name: 'Frame',
      },
    });
    
    editor.setCurrentTool('select');
    setShowMoreDropdown(false);
  }, [editor]);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 960);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!editor) return null;

  const selectHandToolbar = (
    <div className="bg-white rounded-xl shadow-lg p-1 flex items-center gap-0.5">
      <ToolButton tool="select" onClick={() => handleSelectTool('select')} title="Select (V)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      </ToolButton>

      <ToolButton tool="hand" onClick={() => handleSelectTool('hand')} title="Hand (H)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </ToolButton>
    </div>
  );

  const mainToolbar = (
    <div className="bg-white rounded-xl shadow-lg p-1 flex items-center gap-0.5">
      <ToolButton tool="draw" onClick={() => handleSelectTool('draw')} title="Draw (D)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </ToolButton>

      <ToolButton tool="eraser" onClick={() => handleSelectTool('eraser')} title="Eraser (E)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      </ToolButton>

      <ToolButton tool="arrow" onClick={() => handleSelectTool('arrow')} title="Arrow (A)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </ToolButton>

      <ToolButton tool="text" onClick={handleAddText} title="Text (T)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </ToolButton>

      <button
        onClick={handleAddTextBox}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
        title="Text Box"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15V9" />
          <path d="M7 9h4" />
          <path d="M7 12h3" />
        </svg>
      </button>

      <button
        onClick={onAddImage}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
        title="Add Image"
        disabled={isUploadingImage}
      >
        {isUploadingImage ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        )}
      </button>

      {/* More shapes dropdown - icons only */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowMoreDropdown(!showMoreDropdown)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
          title="More shapes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {showMoreDropdown && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-[220px]">
            <div className="grid grid-cols-4 gap-2">
              {/* Rectangle */}
              <button
                onClick={() => handleAddShape('rectangle')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Rectangle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
              {/* Ellipse */}
              <button
                onClick={() => handleAddShape('ellipse')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Ellipse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="12" rx="10" ry="8" />
                </svg>
              </button>
              {/* Diamond */}
              <button
                onClick={() => handleAddShape('diamond')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Diamond"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2 L22 12 L12 22 L2 12 Z" />
                </svg>
              </button>
              {/* Triangle */}
              <button
                onClick={() => handleAddShape('triangle')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Triangle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2 L22 20 L2 20 Z" />
                </svg>
              </button>
              {/* Star */}
              <button
                onClick={() => handleAddShape('star')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Star"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
              {/* Heart */}
              <button
                onClick={() => handleAddShape('heart')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Heart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
              {/* Cloud */}
              <button
                onClick={() => handleAddShape('cloud')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Cloud"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
              </button>
              {/* Sticky Note */}
              <button
                onClick={handleAddNote}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Sticky Note"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z" />
                  <path d="M15 3v5h5" />
                </svg>
              </button>
              {/* Frame */}
              <button
                onClick={handleAddFrame}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Frame"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="0" />
                  <path d="M3 9h18" />
                </svg>
              </button>
              {/* Hexagon */}
              <button
                onClick={() => handleAddShape('hexagon')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Hexagon"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </button>
              {/* Arrow Right */}
              <button
                onClick={() => handleAddShape('arrow-right')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="Arrow Right"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              {/* X-Box */}
              <button
                onClick={() => handleAddShape('x-box')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="X Box"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isCompact ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-row flex-wrap items-center justify-center gap-2 z-[300]">
          {selectHandToolbar}
          {mainToolbar}
        </div>
      ) : (
        <>
          <div className="absolute top-5 left-1/2 -translate-x-[calc(50%+170px)] z-[300]">{selectHandToolbar}</div>
          <div className="absolute top-5 left-1/2 -translate-x-[calc(50%-10px)] z-[300]">{mainToolbar}</div>
        </>
      )}

      {/* Toggle UI button - bottom left */}
      {canToggleUi && (
        <button
          onClick={onToggleUi}
          className="fixed bottom-4 left-4 z-[400] bg-white border border-gray-200 shadow-sm rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          title={showUi ? 'Hide tldraw UI' : 'Show tldraw UI'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showUi ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          {showUi ? 'Hide UI' : 'Show UI'}
        </button>
      )}
    </>
  );
}

// Main component that wraps everything
const TLCanvasToolbar = (props: TLCanvasToolbarProps) => {
  if (!props.editor) return null;
  
  return <ToolbarWithEditor {...props} />;
};

export default TLCanvasToolbar;
