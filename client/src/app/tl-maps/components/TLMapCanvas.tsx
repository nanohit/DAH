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
  persistenceKey?: string;
}

const TLMapCanvas = ({ onEditorReady, persistenceKey }: TLMapCanvasProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showUi, setShowUi] = useState(true);
  const { openImagePicker, isUploading } = useImageUpload({ editor });

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
        persistenceKey={persistenceKey}
        hideUi={!showUi}
        className="tlmaps-canvas"
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
