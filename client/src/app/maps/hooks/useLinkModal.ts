'use client';

import { useCallback, useState } from 'react';
import { API_BASE_URL } from '@/config/api';
import { MapElement } from '../types';
import { getDefaultDimensions } from '../utils';

interface UseLinkModalArgs {
  containerRef: React.RefObject<HTMLDivElement>;
  getViewportCenterInCanvas: () => { x: number; y: number };
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
}

type LinkPreviewResult = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  displayUrl?: string;
  youtubeVideoId?: string;
  previewUrl?: string;
};

export const useLinkModal = ({ containerRef, getViewportCenterInCanvas, setElements }: UseLinkModalArgs) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLoadingLinkPreview, setIsLoadingLinkPreview] = useState(false);

  const fetchLinkPreview = useCallback(
    async (inputUrl: string, overrideTitle?: string): Promise<LinkPreviewResult | null> => {
      if (!inputUrl) return null;
      setIsLoadingLinkPreview(true);
      try {
        let processedUrl = inputUrl.trim();
        if (!/^https?:\/\//i.test(processedUrl)) {
          processedUrl = `https://${processedUrl}`;
        }
        const params = new URLSearchParams({ url: processedUrl });
        if (overrideTitle) {
          params.set('title', overrideTitle);
        }

        const response = await fetch(`${API_BASE_URL}/api/link-preview?${params.toString()}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const payload = await response.json();
          if (payload?.data) {
            const data = payload.data;
            return {
              url: data.url || processedUrl,
              title: overrideTitle || data.title || processedUrl,
              description: data.description,
              image: data.previewUrl || data.image,
              siteName: data.siteName,
              favicon: data.favicon,
              displayUrl: data.displayUrl,
              youtubeVideoId: data.youtubeVideoId,
              previewUrl: data.previewUrl || data.image,
            };
          }
        }

        throw new Error(`Preview request failed with status ${response.status}`);
      } catch (error) {
        console.error('Error fetching link preview:', error);
        let fallback: LinkPreviewResult;
        try {
          const fallbackUrl = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
          const fallbackObj = new URL(fallbackUrl);
          const cleanHostname = fallbackObj.hostname.replace('www.', '');
          const firstPath = fallbackObj.pathname.split('/')[1];
          const displayUrl = firstPath ? `${cleanHostname}/${firstPath}` : cleanHostname;
          fallback = {
            url: fallbackUrl,
            title: overrideTitle || fallbackUrl,
            displayUrl,
          };
        } catch {
          fallback = {
            url: processedUrl,
            title: overrideTitle || processedUrl,
            displayUrl: processedUrl,
          };
        }
        return fallback;
      } finally {
        setIsLoadingLinkPreview(false);
      }
    },
    [],
  );

  const addLinkElement = useCallback(
    (linkData: LinkPreviewResult) => {
      if (!containerRef.current) return;

      const { width, height } = getDefaultDimensions({ type: 'link' } as MapElement);
      const viewportCenter = getViewportCenterInCanvas();

      const left = viewportCenter.x - width / 2;
      const top = viewportCenter.y - height / 2;
      const canvasWidth = 2700;
      const canvasHeight = 2700;

      const newElement: MapElement = {
        id: `link-${Date.now()}`,
        type: 'link',
        left: Math.max(0, Math.min(left, canvasWidth - width)),
        top: Math.max(0, Math.min(top, canvasHeight - height)),
        width,
        height,
        text:
          linkData.title ||
          linkData.displayUrl ||
          (linkData.url ? new URL(linkData.url).hostname.replace('www.', '') : ''),
        orientation: 'horizontal',
        linkData: {
          url: linkData.url,
          title: linkData.title,
          description: linkData.description,
          siteName: linkData.siteName,
          favicon: linkData.favicon,
          displayUrl: linkData.displayUrl,
          image: linkData.image,
          youtubeVideoId: linkData.youtubeVideoId,
          previewUrl: linkData.previewUrl || linkData.image,
        },
      };

      setElements((prev) => [...prev, newElement]);
      setIsLinkModalOpen(false);
    },
    [containerRef, getViewportCenterInCanvas, setElements],
  );

  const openLinkModal = useCallback(() => {
    setIsLinkModalOpen(true);
  }, []);

  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
  }, []);

  const handleLinkSubmit = useCallback(
    async (url: string, title?: string) => {
      const preview = await fetchLinkPreview(url, title);
      if (!preview) return;
      addLinkElement(preview);
      setIsLinkModalOpen(false);
    },
    [fetchLinkPreview, addLinkElement],
  );

  return {
    isLinkModalOpen,
    openLinkModal,
    closeLinkModal,
    isLoadingLinkPreview,
    handleLinkSubmit,
  };
};
