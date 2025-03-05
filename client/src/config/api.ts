export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://dah-tyxc.onrender.com/api'
  : 'http://localhost:5001/api';

export const SITE_URL = process.env.NODE_ENV === 'production'
  ? 'https://alphy.tech'
  : 'http://localhost:3000'; 