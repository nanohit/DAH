'use client';

import { useCallback, useState } from 'react';
import { MapElement } from '../types';
import { getDefaultDimensions } from '../utils';

interface UseImageModalArgs {
  containerRef: React.RefObject<HTMLDivElement>;
  getViewportCenterInCanvas: () => { x: number; y: number };
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
}

export const useImageModal = ({ containerRef, getViewportCenterInCanvas, setElements }: UseImageModalArgs) => {
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const addImageElement = useCallback(
    (imageUrl: string) => {
      if (!containerRef.current) return;

      const { width, height } = getDefaultDimensions({ type: 'image' } as MapElement);
      const viewportCenter = getViewportCenterInCanvas();

      const left = viewportCenter.x - width / 2;
      const top = viewportCenter.y - height / 2;
      const canvasWidth = 2700;
      const canvasHeight = 2700;

      const newElement: MapElement = {
        id: `image-${Date.now()}`,
        type: 'image',
        left: Math.max(0, Math.min(left, canvasWidth - width)),
        top: Math.max(0, Math.min(top, canvasHeight - height)),
        width,
        height,
        text: 'Image',
        orientation: 'horizontal',
        imageData: {
          url: imageUrl,
          alt: 'Image',
        },
      };

      setElements((prev) => [...prev, newElement]);
    },
    [containerRef, getViewportCenterInCanvas, setElements],
  );

  const handleImageSubmit = useCallback(
    async (file: File) => {
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to upload image');
        }
        addImageElement(data.data.display_url);
      } finally {
        setIsUploadingImage(false);
      }
    },
    [addImageElement],
  );

  const openImageModal = useCallback(() => {
    if (isUploadingImage) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        void handleImageSubmit(file);
      }
    };

    input.click();
  }, [handleImageSubmit, isUploadingImage]);

  return {
    openImageModal,
    isUploadingImage,
  };
};
