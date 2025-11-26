'use client';

import { MapData as MapDataBase, SavedMap as SavedMapBase } from '@/utils/mapUtils';

export type ElementType = 'element' | 'book' | 'line' | 'image' | 'link';
export type Orientation = 'horizontal' | 'vertical';
export type ConnectionAnchor = 'top' | 'right' | 'bottom' | 'left';

export interface MapElement {
  id: string;
  type: ElementType;
  left: number;
  top: number;
  width?: number;
  height?: number;
  scale?: number;
  text: string;
  orientation: Orientation;
  bookData?: {
    key: string;
    _id?: string;
    title: string;
    author: string[];
    thumbnail?: string;
    highResThumbnail?: string;
    description?: string;
    source: 'openlib' | 'google' | 'alphy';
    flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
    completed?: boolean;
    flibustaVariants?: Array<{
      title: string;
      author: string;
      sourceId: string;
      formats: Array<{
        format: string;
        url: string;
      }>;
    }>;
    bookmarks?: Array<{
      user: string | { _id: string };
      timestamp: string;
    }>;
  };
  lineData?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDraggingStart?: boolean;
    isDraggingEnd?: boolean;
  };
  imageData?: {
    url: string;
    alt: string;
  };
  linkData?: {
    url: string;
    title?: string;
    previewUrl?: string;
    description?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    image?: string;
    youtubeVideoId?: string;
  };
}

export interface Connection {
  id: string;
  start: string;
  end: string;
  startPoint?: ConnectionAnchor;
  endPoint?: ConnectionAnchor;
}

export interface Point {
  x: number;
  y: number;
  id?: string;
}

export interface AlignmentGuide {
  position: number;
  type: 'vertical' | 'horizontal';
}

export interface SnapToGridArgs {
  transform: {
    x: number;
    y: number;
  };
  active: {
    id: string | number;
  } | null;
  draggingElement: MapElement | undefined;
  elements: MapElement[];
}

export interface BookSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  thumbnail?: string;
  highResThumbnail?: string;
  source: 'openlib' | 'google' | 'alphy';
  description?: string;
  _id?: string;
  publishedYear?: number;
  inDatabase?: boolean;
  flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
  flibustaVariants?: Array<{
    title: string;
    author: string;
    sourceId: string;
    formats: Array<{
      format: string;
      url: string;
    }>;
  }>;
}

export type MapData = MapDataBase;
export type SavedMap = SavedMapBase;

