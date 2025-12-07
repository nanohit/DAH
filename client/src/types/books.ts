export type BookSource = 'flibusta' | 'zlibrary' | 'liber3' | 'motw';

export interface BookFormat {
  id: string;
  format: string;
  source?: BookSource;
  size?: string;
  language?: string;
  token?: string;
  downloadPath?: string;
  mirrors?: string[];
  cid?: string;
}

export interface BookResult {
  id: string;
  title: string;
  author: string;
  cover?: string;
  language?: string;
  year?: string;
  size?: string;
  source?: BookSource;
  formats: BookFormat[];
}

export interface SearchError {
  message: string;
  code?: string;
  isWarning?: boolean;
}

export interface SimilarRecommendation {
  id: string | number | null;
  title: string;
  author: string;
  workId?: number | null;
  goodreadsUrl?: string | null;
}

