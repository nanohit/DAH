'use client';

import { useCallback, useState } from 'react';
import { Editor } from 'tldraw';
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

  const addImageToCanvas = useCallback(
    async (file: File) => {
      if (!editor) return;

      const url = await uploadImage(file);
      if (!url) return;

      const { x, y } = editor.getViewportScreenCenter();
      const point = editor.screenToPage({ x, y });

      editor.createShape({
        type: 'connectable-image',
        x: point.x - 100,
        y: point.y - 100,
        props: {
          w: 200,
          h: 200,
          url,
          alt: file.name || 'Uploaded image',
        },
      });
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
