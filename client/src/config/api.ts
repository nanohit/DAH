export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://dah-tyxc.onrender.com'
    : 'http://localhost:5001');

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://alphy.tech'
    : 'http://localhost:3000'); 