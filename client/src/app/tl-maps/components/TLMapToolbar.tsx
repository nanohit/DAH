'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Editor } from 'tldraw';

interface TLMapToolbarProps {
  mapName: string;
  onChangeMapName: (name: string) => void;
  onSave: () => Promise<void>;
  onSaveAndExit: () => Promise<void>;
  isSaving: boolean;
  isAutosaveEnabled: boolean;
  onToggleAutosave: () => void;
  isPrivate: boolean;
  onSetPrivacy: (isPrivate: boolean) => void;
  onCopyShareLink: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  editor: Editor | null;
}

const TLMapToolbar = ({
  mapName,
  onChangeMapName,
  onSave,
  onSaveAndExit,
  isSaving,
  isAutosaveEnabled,
  onToggleAutosave,
  isPrivate,
  onSetPrivacy,
  onCopyShareLink,
  onDelete,
  canDelete,
  editor,
}: TLMapToolbarProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const hiddenTextRef = useRef<HTMLSpanElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setActiveSubmenu(null);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Adjust input width based on content
  useEffect(() => {
    if (hiddenTextRef.current && mapNameInputRef.current) {
      const width = hiddenTextRef.current.offsetWidth + 12;
      mapNameInputRef.current.style.width = `${Math.max(Math.min(width, 420), 40)}px`;
    }
  }, [mapName]);

  const handleCopyLink = () => {
    onCopyShareLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Editor actions
  const handleUndo = useCallback(() => {
    if (!editor) return;
    editor.undo();
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (!editor) return;
    editor.redo();
  }, [editor]);

  const handleSelectAll = useCallback(() => {
    if (!editor) return;
    editor.selectAll();
    setShowDropdown(false);
  }, [editor]);

  const handleSelectNone = useCallback(() => {
    if (!editor) return;
    editor.selectNone();
    setShowDropdown(false);
  }, [editor]);

  const handleZoomIn = useCallback(() => {
    if (!editor) return;
    editor.zoomIn();
    setShowDropdown(false);
  }, [editor]);

  const handleZoomOut = useCallback(() => {
    if (!editor) return;
    editor.zoomOut();
    setShowDropdown(false);
  }, [editor]);

  const handleZoomToFit = useCallback(() => {
    if (!editor) return;
    editor.zoomToFit();
    setShowDropdown(false);
  }, [editor]);

  const handleZoomToSelection = useCallback(() => {
    if (!editor) return;
    editor.zoomToSelection();
    setShowDropdown(false);
  }, [editor]);

  const handleResetZoom = useCallback(() => {
    if (!editor) return;
    editor.resetZoom();
    setShowDropdown(false);
  }, [editor]);

  const handleToggleGrid = useCallback(() => {
    if (!editor) return;
    const current = editor.getInstanceState().isGridMode;
    editor.updateInstanceState({ isGridMode: !current });
  }, [editor]);

  const handleToggleDarkMode = useCallback(() => {
    if (!editor) return;
    const current = editor.user.getIsDarkMode();
    editor.user.updateUserPreferences({ colorScheme: current ? 'light' : 'dark' });
  }, [editor]);

  const handleExportSvg = useCallback(async () => {
    if (!editor) return;
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) return;
      
      const svg = await editor.getSvgString([...shapeIds]);
      if (!svg) return;
      
      const blob = new Blob([svg.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapName || 'map'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export SVG failed:', e);
    }
    setShowDropdown(false);
  }, [editor, mapName]);

  const handleExportPng = useCallback(async () => {
    if (!editor) return;
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) return;
      
      const result = await editor.toImage([...shapeIds], { format: 'png', quality: 1 });
      if (!result || !result.blob) return;
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapName || 'map'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export PNG failed:', e);
    }
    setShowDropdown(false);
  }, [editor, mapName]);

  const handleExportJson = useCallback(() => {
    if (!editor) return;
    try {
      const snapshot = editor.store.getStoreSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapName || 'map'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export JSON failed:', e);
    }
    setShowDropdown(false);
  }, [editor, mapName]);

  const handleInsertMedia = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await editor.putExternalContent({
        type: 'files',
        files: [file],
        point: editor.getViewportScreenCenter(),
        ignoreParent: false,
      });
    };
    input.click();
    setShowDropdown(false);
  }, [editor]);

  const handleInsertEmbed = useCallback(() => {
    const url = prompt('Enter URL to embed:');
    if (!url || !editor) return;
    
    const center = editor.getViewportScreenCenter();
    editor.putExternalContent({
      type: 'url',
      url,
      point: center,
    });
    setShowDropdown(false);
  }, [editor]);

  const isGridMode = editor?.getInstanceState()?.isGridMode ?? false;
  const isDarkMode = editor?.user?.getIsDarkMode?.() ?? false;

  const shortcuts = [
    { key: 'V', action: 'Select' },
    { key: 'H', action: 'Hand (pan)' },
    { key: 'D', action: 'Draw' },
    { key: 'E', action: 'Eraser' },
    { key: 'A', action: 'Arrow' },
    { key: 'T', action: 'Text' },
    { key: 'N', action: 'Note' },
    { key: 'R', action: 'Rectangle' },
    { key: 'O', action: 'Ellipse' },
    { key: '⌘/Ctrl + Z', action: 'Undo' },
    { key: '⌘/Ctrl + Shift + Z', action: 'Redo' },
    { key: '⌘/Ctrl + A', action: 'Select all' },
    { key: '⌘/Ctrl + C', action: 'Copy' },
    { key: '⌘/Ctrl + V', action: 'Paste' },
    { key: 'Delete/Backspace', action: 'Delete' },
    { key: '⌘/Ctrl + D', action: 'Duplicate' },
    { key: '+/-', action: 'Zoom in/out' },
    { key: 'Shift + 1', action: 'Zoom to fit' },
    { key: 'Shift + 0', action: 'Reset zoom' },
    { key: 'Space + Drag', action: 'Pan' },
  ];

  return (
    <>
      <div className="absolute top-5 left-5 bg-white rounded-lg shadow-lg px-3 p-2 flex items-center gap-1 z-[300] h-14">
        {/* Back button */}
        <button
          onClick={onSaveAndExit}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
          title="Save and return"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Map name input with dropdown arrow */}
        <div className="flex items-center relative">
          <input
            ref={mapNameInputRef}
            type="text"
            value={mapName}
            onChange={(e) => onChangeMapName(e.target.value)}
            className="text-gray-800 font-medium bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded px-1 py-0.5 transition-colors"
            placeholder="Untitled"
          />
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <span
            ref={hiddenTextRef}
            className="absolute opacity-0 pointer-events-none font-medium"
            style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'pre' }}
          >
            {mapName || 'Untitled'}
          </span>
          {isAutosaveEnabled && (
            <span className={`text-xs ml-2 ${isSaving ? 'text-yellow-600' : 'text-green-600'} flex items-center`}>
              {isSaving ? (
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-3 w-3 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          )}
        </div>

        {/* Undo button */}
        <button
          onClick={handleUndo}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
          title="Undo (⌘Z)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>

        {/* Redo button */}
        <button
          onClick={handleRedo}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
          title="Redo (⌘⇧Z)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>

        {/* Main dropdown - already triggered by map name dropdown arrow */}
        {showDropdown && (
          <div ref={dropdownRef} className="absolute left-0 top-16 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            {/* Privacy toggle */}
            <div className="px-4 py-2">
              <div className="inline-flex border border-gray-400/50 rounded-md overflow-hidden w-full">
                <button
                  onClick={() => onSetPrivacy(false)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 flex-1 ${
                    !isPrivate ? 'bg-gray-100 text-gray-800' : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  Public
                </button>
                <button
                  onClick={() => onSetPrivacy(true)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 flex-1 ${
                    isPrivate ? 'bg-gray-100 text-gray-800' : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>

            {/* Autosave toggle */}
            <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center">
              <input
                type="checkbox"
                id="autosave-toggle"
                checked={isAutosaveEnabled}
                onChange={onToggleAutosave}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autosave-toggle" className="cursor-pointer text-sm text-gray-700">
                Auto save
              </label>
            </div>

            {/* Share link */}
            <div
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center"
              onClick={handleCopyLink}
            >
              {linkCopied ? (
                <>
                  <svg className="h-4 w-4 mr-2 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Link copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </div>

            <div className="border-t border-gray-200 my-1" />

            {/* Edit submenu */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('edit')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center justify-between">
                Edit
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              {activeSubmenu === 'edit' && (
                <div className="absolute left-full top-0 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200">
                  <div onClick={handleSelectAll} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    Select all <span className="text-gray-400">⌘A</span>
                  </div>
                  <div onClick={handleSelectNone} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700">
                    Select none
                  </div>
                </div>
              )}
            </div>

            {/* View submenu */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('view')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center justify-between">
                View
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              {activeSubmenu === 'view' && (
                <div className="absolute left-full top-0 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200">
                  <div onClick={handleZoomIn} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    Zoom in <span className="text-gray-400">+</span>
                  </div>
                  <div onClick={handleZoomOut} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    Zoom out <span className="text-gray-400">−</span>
                  </div>
                  <div onClick={handleResetZoom} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    Reset zoom <span className="text-gray-400">⇧0</span>
                  </div>
                  <div onClick={handleZoomToFit} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    Zoom to fit <span className="text-gray-400">⇧1</span>
                  </div>
                  <div onClick={handleZoomToSelection} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700">
                    Zoom to selection
                  </div>
                  <div className="border-t border-gray-200 my-1" />
                  <div onClick={handleToggleGrid} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    <span>{isGridMode ? '✓ ' : ''}Grid</span>
                  </div>
                  <div onClick={handleToggleDarkMode} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between">
                    <span>{isDarkMode ? '✓ ' : ''}Dark mode</span>
                  </div>
                </div>
              )}
            </div>

            {/* Export submenu */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('export')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center justify-between">
                Export as
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              {activeSubmenu === 'export' && (
                <div className="absolute left-full top-0 w-36 bg-white rounded-md shadow-lg py-1 border border-gray-200">
                  <div onClick={handleExportSvg} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700">
                    SVG
                  </div>
                  <div onClick={handleExportPng} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700">
                    PNG
                  </div>
                  <div onClick={handleExportJson} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700">
                    JSON
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 my-1" />

            {/* Insert embed */}
            <div
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between"
              onClick={handleInsertEmbed}
            >
              Insert embed <span className="text-gray-400">⌘I</span>
            </div>

            {/* Upload media */}
            <div
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between"
              onClick={handleInsertMedia}
            >
              Upload media <span className="text-gray-400">⌘U</span>
            </div>

            <div className="border-t border-gray-200 my-1" />

            {/* Keyboard shortcuts */}
            <div
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
              onClick={() => { setShowShortcuts(true); setShowDropdown(false); }}
            >
              Keyboard shortcuts
            </div>

            {/* Delete option */}
            {canDelete && (
              <>
                <div className="border-t border-gray-200 my-1" />
                {showDeleteConfirm ? (
                  <div className="px-4 py-2 text-sm text-red-600">
                    <div className="text-gray-800 mb-2">Are you sure?</div>
                    <div className="flex justify-between">
                      <button
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                        onClick={onDelete}
                      >
                        Delete
                      </button>
                      <button
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-600 flex items-center"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete map
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500]" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Keyboard shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody>
                  {shortcuts.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 text-gray-600">{s.action}</td>
                      <td className="py-2 text-right font-mono text-gray-400">{s.key}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TLMapToolbar;
