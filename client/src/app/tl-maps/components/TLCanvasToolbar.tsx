'use client';

import { Editor, toRichText } from 'tldraw';

interface TLCanvasToolbarProps {
  editor: Editor | null;
  onAddImage: () => void;
  isUploadingImage: boolean;
  showUi: boolean;
  onToggleUi: () => void;
}

const TLCanvasToolbar = ({ editor, onAddImage, isUploadingImage, showUi, onToggleUi }: TLCanvasToolbarProps) => {
  const handleAddText = () => {
    if (!editor) return;

    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });

    editor.createShape({
      type: 'text',
      x: point.x - 50,
      y: point.y - 20,
      props: {
        richText: toRichText('Click to edit'),
        size: 'm',
      },
    });

    editor.setCurrentTool('select');
  };

  const handleAddNote = () => {
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
  };

  const handleAddGeoShape = () => {
    if (!editor) return;

    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });

    editor.createShape({
      type: 'geo',
      x: point.x - 75,
      y: point.y - 50,
      props: {
        w: 150,
        h: 100,
        geo: 'rectangle',
        color: 'black',
        fill: 'none',
      },
    });

    editor.setCurrentTool('select');
  };

  const handleSelectArrowTool = () => {
    if (!editor) return;
    editor.setCurrentTool('arrow');
  };

  const handleSelectSelectTool = () => {
    if (!editor) return;
    editor.setCurrentTool('select');
  };

  return (
    <div className="absolute md:top-5 md:left-1/2 md:-translate-x-1/2 top-60 left-2 bg-white rounded-lg shadow-lg p-2 md:flex md:items-center md:flex-row flex-col items-start gap-2 z-[300] md:h-14">
      {/* Select tool */}
      <button
        onClick={handleSelectSelectTool}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Select (V)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      </button>

      {/* Text tool */}
      <button
        onClick={handleAddText}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Add Text"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      </button>

      {/* Note (sticky note / text box) */}
      <button
        onClick={handleAddNote}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Add Note"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z" />
          <path d="M15 3v5h5" />
        </svg>
      </button>

      {/* Rectangle / Box */}
      <button
        onClick={handleAddGeoShape}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Add Box"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      </button>

      {/* Arrow tool */}
      <button
        onClick={handleSelectArrowTool}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Arrow Tool (A)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      {/* Toggle built-in UI (hides right panel & license) */}
      <button
        onClick={onToggleUi}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title={showUi ? 'Hide built-in UI' : 'Show built-in UI'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="13" y2="12" />
          <line x1="7" y1="16" x2="11" y2="16" />
        </svg>
        <span className="hidden md:inline text-xs">{showUi ? 'Hide UI' : 'Show UI'}</span>
      </button>

      {/* Image upload */}
      <button
        onClick={onAddImage}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
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
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default TLCanvasToolbar;
