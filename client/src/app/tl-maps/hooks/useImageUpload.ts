'use client';

import { useCallback, useState } from 'react';
import { Editor, AssetRecordType, createShapeId, TLAssetId } from 'tldraw';
import { toast } from 'react-hot-toast';

interface UseImageUploadArgs {
  editor: Editor | null;
}

export const useImageUpload = ({ editor }: UseImageUploadArgs) => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(
          `https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`,
          {
            method: 'POST',
            body: formData,
          }
        );
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to upload image');
        }
        
        return data.data.display_url;
      } catch (error) {
        console.error('Image upload error:', error);
        toast.error('Failed to upload image');
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  // Get image dimensions
  const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const addImageToCanvas = useCallback(
    async (file: File) => {
      if (!editor) return;

      const url = await uploadImage(file);
      if (!url) return;

      try {
        // Get image dimensions
        let dimensions = { width: 300, height: 300 };
        try {
          dimensions = await getImageDimensions(url);
        } catch (e) {
          console.warn('Could not get image dimensions, using default');
        }

        // Scale down if too large
        const maxSize = 500;
        let { width, height } = dimensions;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Create a unique asset ID
        const assetId = AssetRecordType.createId();
        
        // Create the asset record
        editor.createAssets([
          {
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: file.name || 'Uploaded image',
              src: url,
              w: dimensions.width,
              h: dimensions.height,
              mimeType: file.type || 'image/png',
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        // Get center of viewport
        const { x, y } = editor.getViewportScreenCenter();
        const point = editor.screenToPage({ x, y });

        // Create the image shape
        editor.createShape({
          type: 'image',
          x: point.x - width / 2,
          y: point.y - height / 2,
          props: {
            assetId,
            w: width,
            h: height,
          },
        });

        editor.setCurrentTool('select');
      } catch (error) {
        console.error('Error creating image shape:', error);
        toast.error('Failed to add image to canvas');
      }
    },
    [editor, uploadImage]
  );

  const openImagePicker = useCallback(() => {
    if (isUploading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        await addImageToCanvas(file);
      }
    };
    input.click();
  }, [addImageToCanvas, isUploading]);

  return {
    isUploading,
    openImagePicker,
    addImageToCanvas,
  };
};
