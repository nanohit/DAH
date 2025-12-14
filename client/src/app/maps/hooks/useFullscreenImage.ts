'use client';

import { useCallback, useState } from 'react';

interface FullscreenImage {
  url: string;
  alt?: string;
}

export const useFullscreenImage = () => {
  const [fullscreenImage, setFullscreenImage] = useState<FullscreenImage | null>(null);

  const openFullscreenImage = useCallback((image: FullscreenImage) => {
    setFullscreenImage(image);
  }, []);

  const closeFullscreenImage = useCallback(() => {
    setFullscreenImage(null);
  }, []);

  return {
    fullscreenImage,
    openFullscreenImage,
    closeFullscreenImage,
  };
};
