'use client';

import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { ConnectableImageShapeUtil } from '../shapes/ConnectableImageShape';
import TLCanvasToolbar from './TLCanvasToolbar';
import { useImageUpload } from '../hooks/useImageUpload';
import { useCallback, useEffect, useRef, useState } from 'react';

// Custom shape utils
const customShapeUtils = [ConnectableImageShapeUtil];

interface TLMapCanvasProps {
  onEditorReady: (editor: Editor) => void;
}

const TLMapCanvas = ({ onEditorReady }: TLMapCanvasProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  // Default to hiding built-in UI to avoid license prompts
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
    el.style.transformOrigin = '0 0';

    const update = () => {
      const cam = editor.getCamera();
      el.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
      // Ensure the pattern tiles from a stable origin
      el.style.backgroundPosition = `${-cam.x}px ${-cam.y}px`;
    };

    let frame: number;
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [editor]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #c5c7cb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: 'center center',
          width: '4000px',
          height: '4000px',
        }}
      />
      <Tldraw
        shapeUtils={customShapeUtils}
        onMount={handleMount}
        hideUi={!showUi}
        className="tlmaps-canvas"
        licenseKey={licenseKey}
      />
      <TLCanvasToolbar
        editor={editor}
        onAddImage={openImagePicker}
        isUploadingImage={isUploading}
        showUi={showUi}
        onToggleUi={() => setShowUi((prev) => !prev)}
      />
    </div>
  );
};

export default TLMapCanvas;
