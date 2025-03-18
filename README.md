# Alphy (code name DAH)

A social forum for dark academia enthusiasts to share content, discuss literature, and connect.

## Getting Started

### Backend
```
cd server
npm install
npm run dev
```

### Frontend
```
cd client
npm install
npm run dev
```

## Deployment

### Setup GitHub Repository
1. Create a new repository on GitHub
2. Initialize the local repository (if not done already):
   ```
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Add the remote repository:
   ```
   git remote add origin https://github.com/yourusername/dah.git
   git push -u origin main
   ```

### Deploy Backend to Render.com
1. Sign up or log in to [Render.com](https://render.com)
2. Create a new "Web Service" and connect your GitHub repository
3. Use the following settings:
   - Name: dah
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node index.js`
4. Set up the required environment variables in the Render dashboard:
   - MONGODB_URI
   - JWT_SECRET 
   - VK_TOKEN
   - IMGBB_API_KEY

### Deploy Frontend
The frontend is configured to be deployed on Vercel with the following environment variables:
- NEXT_PUBLIC_API_URL=https://dah-tyxc.onrender.com
- NEXT_PUBLIC_SITE_URL=https://alphy.tech
- NEXT_PUBLIC_IMGBB_API_KEY
- NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
- NEXT_PUBLIC_FLIBUSTA_PROXY_URL=https://flibusta-proxy.alphy-flibusta.workers.dev

