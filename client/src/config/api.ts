// Get API port from environment or use default
const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '5001';

// Use new multi-instance backend by default, fallback to legacy if needed
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://dah-api.onrender.com'
    : `http://localhost:${API_PORT}`);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://alphy.tech'
    : 'http://localhost:3000'); 