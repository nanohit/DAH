'use client';

import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { ConnectableImageShapeUtil } from '../shapes/ConnectableImageShape';
import TLCanvasToolbar from './TLCanvasToolbar';
import { useImageUpload } from '../hooks/useImageUpload';
import { useCallback, useState } from 'react';

// Custom shape utils
const customShapeUtils = [ConnectableImageShapeUtil];

interface TLMapCanvasProps {
  onEditorReady: (editor: Editor) => void;
}

const TLMapCanvas = ({ onEditorReady }: TLMapCanvasProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showUi, setShowUi] = useState(true);
  const { openImagePicker, isUploading } = useImageUpload({ editor });
  const licenseKey = process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY;

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      onEditorReady(editorInstance);
    },
    [onEditorReady]
  );

  return (
    <div className="w-full h-full relative">
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
