#!/bin/bash

# Script to switch between local development and production environments

MODE=$1

if [ "$MODE" != "local" ] && [ "$MODE" != "production" ]; then
  echo "Usage: ./switch-env.sh [local|production]"
  echo "  local       - Switch to local development environment"
  echo "  production  - Switch to production environment"
  exit 1
fi

if [ "$MODE" == "local" ]; then
  echo "Switching to LOCAL development environment..."
  
  # Update client environment
  echo "NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_IMGBB_API_KEY=dea282c8a3ed6b4d82eed4ea65ab3826
NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=YOUR_GOOGLE_BOOKS_API_KEY
NEXT_PUBLIC_FLIBUSTA_PROXY_URL=https://flibusta-proxy.alphy-flibusta.workers.dev" > client/.env.local
  
  # Update backend environment if needed
  if [ -f ".env" ]; then
    sed -i '' 's/NODE_ENV=production/NODE_ENV=development/g' .env
  fi
  
  echo "✅ Environment switched to LOCAL. Client will use http://localhost:5001 as API URL."
  echo "🔄 You may need to restart your development servers."
  
elif [ "$MODE" == "production" ]; then
  echo "Switching to PRODUCTION environment..."
  
  # Update client environment
  echo "NEXT_PUBLIC_API_URL=https://dah-tyxc.onrender.com
NEXT_PUBLIC_SITE_URL=https://alphy.tech
NEXT_PUBLIC_IMGBB_API_KEY=dea282c8a3ed6b4d82eed4ea65ab3826
NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=YOUR_GOOGLE_BOOKS_API_KEY
NEXT_PUBLIC_FLIBUSTA_PROXY_URL=https://flibusta-proxy.alphy-flibusta.workers.dev" > client/.env.local
  
  # Update backend environment if needed
  if [ -f ".env" ]; then
    sed -i '' 's/NODE_ENV=development/NODE_ENV=production/g' .env
  fi
  
  echo "✅ Environment switched to PRODUCTION. Client will use https://dah-tyxc.onrender.com as API URL."
  echo "🔄 You may need to restart your development servers."
fi 