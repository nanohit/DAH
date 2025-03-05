export interface BookSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  thumbnail?: string;
  highResThumbnail?: string;
  description?: string;
  source: 'openlib' | 'google' | 'alphy';
  _id?: string; // For Alphy books
} 