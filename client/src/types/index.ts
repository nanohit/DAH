export interface BookSearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  thumbnail?: string;
  highResThumbnail?: string;
  source: 'openlib' | 'google' | 'alphy';
  description?: string;
  _id?: string; // For Alphy books
  publishedYear?: number;
  inDatabase?: boolean;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  badge?: string;
} 