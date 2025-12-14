'use client';

import { Tldraw, Editor, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { ConnectableImageShapeUtil } from '../shapes/ConnectableImageShape';
import TLCanvasToolbar from './TLCanvasToolbar';
import StylePanel from './StylePanel';
import { useImageUpload } from '../hooks/useImageUpload';
import { useCallback, useEffect, useRef, useState } from 'react';

// Custom shape utils
const customShapeUtils = [ConnectableImageShapeUtil];

interface TLMapCanvasProps {
  onEditorReady: (editor: Editor) => void;
  store?: any;
  persistenceKey?: string;
  canToggleUi?: boolean;
}

const TLMapCanvas = ({ onEditorReady, store, persistenceKey, canToggleUi = true }: TLMapCanvasProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  // Controls CSS visibility of tldraw UI (not hideUi prop - we keep UI enabled for hotkeys)
  const [showUi, setShowUi] = useState(false);
  const { openImagePicker, isUploading } = useImageUpload({ editor });
  const licenseKey = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY;
  const bgRef = useRef<HTMLDivElement>(null);

  // Surface whether the license key is present at runtime (helps debug deployments)
  useEffect(() => {
    // Mask the key in logs
    const masked = licenseKey ? `${licenseKey.slice(0, 4)}…${licenseKey.slice(-4)}` : 'missing';
    console.info('[TLDraw] license key present:', !!licenseKey, masked);
  }, [licenseKey]);

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      onEditorReady(editorInstance);
    },
    [onEditorReady]
  );

  // Keep dotted background in sync with camera transform so it scales / pans with content
  useEffect(() => {
    if (!editor || !bgRef.current) return;

    const el = bgRef.current;

    const update = () => {
      const cam = editor.getCamera();
      // scale the dot spacing with zoom, and move with camera
      const baseSize = 26;
      const size = baseSize * cam.z;
      el.style.backgroundSize = `${size}px ${size}px`;
      el.style.backgroundPosition = `${cam.x * cam.z}px ${cam.y * cam.z}px`;
    };

    let frame: number;
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(frame);
  }, [editor]);

  return (
    <div className={`w-full h-full relative overflow-hidden ${showUi ? 'tldraw-ui-visible' : 'tldraw-ui-hidden'}`}>
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #c5c7cb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0',
          width: '100%',
          height: '100%',
        }}
      />
      {/* 
        IMPORTANT: hideUi is always false so that keyboard shortcuts work!
        We hide the UI elements with CSS instead (see page.tsx global styles).
        The showUi state controls the CSS class that toggles visibility.
      */}
      <Tldraw
        shapeUtils={customShapeUtils}
        onMount={handleMount}
        hideUi={false}
        className="tlmaps-canvas"
        licenseKey={licenseKey}
        store={store}
        // Local persistence to avoid losing work on refresh; include mapId in key if provided
        persistenceKey={persistenceKey ?? (typeof window !== 'undefined' ? window.location.search || 'tlmaps-local' : 'tlmaps-local')}
      >
        {/* Toolbar rendered inside Tldraw to get access to editor context */}
        <InnerToolbar 
          onAddImage={openImagePicker}
          isUploadingImage={isUploading}
          showUi={showUi}
          onToggleUi={() => setShowUi((prev) => !prev)}
          canToggleUi={canToggleUi}
        />
        {/* Style panel with three-dot menu - top right corner */}
        <StylePanel />
      </Tldraw>
    </div>
  );
};

// Inner toolbar component that has access to tldraw context
function InnerToolbar({ 
  onAddImage, 
  isUploadingImage,
  showUi,
  onToggleUi,
  canToggleUi,
}: { 
  onAddImage: () => void;
  isUploadingImage: boolean;
  showUi: boolean;
  onToggleUi: () => void;
  canToggleUi: boolean;
}) {
  const editor = useEditor();
  
  return (
    <TLCanvasToolbar
      editor={editor}
      onAddImage={onAddImage}
      isUploadingImage={isUploadingImage}
      showUi={showUi}
      onToggleUi={onToggleUi}
      canToggleUi={canToggleUi}
    />
  );
}

export default TLMapCanvas;
