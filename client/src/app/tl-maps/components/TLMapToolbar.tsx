'use client';

import { useRef, useEffect, useState } from 'react';

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
}: TLMapToolbarProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const hiddenTextRef = useRef<HTMLSpanElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
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

  return (
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

      {/* Map name input */}
      <div className="flex items-center relative">
        <input
          ref={mapNameInputRef}
          type="text"
          value={mapName}
          onChange={(e) => onChangeMapName(e.target.value)}
          className="text-gray-800 font-medium bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded px-1 py-0.5 transition-colors"
          placeholder="Untitled"
        />
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

      {/* Save button */}
      <button
        onClick={onSave}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
        title="Save"
        disabled={isSaving}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      </button>

      {/* More options dropdown */}
      <div className="relative">
        <button
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title="More options"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showDropdown && (
          <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
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

            {/* Delete option */}
            {canDelete && (
              <>
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
    </div>
  );
};

export default TLMapToolbar;
