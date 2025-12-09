'use client';

'use client';

import { Editor, toRichText } from 'tldraw';

interface TLCanvasToolbarProps {
  editor: Editor | null;
}

const TLCanvasToolbar = ({ editor }: TLCanvasToolbarProps) => {
  const setTool = (tool: string) => {
    if (!editor) return;
    editor.setCurrentTool(tool);
  };

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

  return (
    <div className="absolute md:top-5 md:left-1/2 md:-translate-x-1/2 top-16 left-2 bg-white rounded-lg shadow-lg p-2 md:flex md:items-center md:flex-row flex-col items-start gap-2 z-[300] md:h-14">
      {/* Select tool */}
      <button
        onClick={() => setTool('select')}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Select (V)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      </button>

      {/* Hand tool */}
      <button
        onClick={() => setTool('hand')}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Pan (H)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 1 0-4 0v5" />
          <path d="M14 11V4a2 2 0 1 0-4 0v7" />
          <path d="M10 11V5a2 2 0 0 0-4 0v10" />
          <path d="M6 15a4 4 0 0 0 8 0v-4" />
          <path d="M18 12a2 2 0 0 1 4 0v2a8 8 0 0 1-8 8h-1a5 5 0 0 1-5-5" />
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
        onClick={() => setTool('arrow')}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center gap-2 transition-colors"
        title="Arrow Tool (A)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
};

export default TLCanvasToolbar;
