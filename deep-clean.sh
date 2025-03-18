#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Deep Project Cleanup Script ===${NC}"
echo -e "${YELLOW}This script will aggressively clean your project for GitHub.${NC}"
echo -e "${RED}WARNING: This will remove all node_modules and build artifacts.${NC}"
echo

# Function to show size before and after cleanup
calculate_size() {
  du -sh . | awk '{print $1}'
}

# Record initial size
echo -e "${BLUE}Initial project size:${NC} $(calculate_size)"
echo

# Ask for confirmation
read -p "Continue with deep cleanup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Cleanup aborted.${NC}"
  exit 1
fi

echo -e "${GREEN}Starting deep cleanup...${NC}"

# 1. Create a backup of package.json files
echo -e "${YELLOW}Creating backup of package.json files...${NC}"
mkdir -p .package-backups
cp package.json .package-backups/root-package.json
cp client/package.json .package-backups/client-package.json
cp cloudflare-proxy/flibusta-proxy/package.json .package-backups/flibusta-proxy-package.json 2>/dev/null || true
echo -e "${GREEN}✓ Package.json backups created${NC}"

# 2. Remove all node_modules directories
echo -e "${YELLOW}Removing all node_modules directories...${NC}"
find . -name "node_modules" -type d -exec rm -rf {} +
echo -e "${GREEN}✓ All node_modules removed${NC}"

# 3. Remove all build artifacts
echo -e "${YELLOW}Removing all build artifacts...${NC}"
rm -rf ./client/.next
rm -rf ./client/build
rm -rf ./client/dist
rm -rf ./client/out
rm -rf ./cloudflare-proxy/flibusta-proxy/dist
rm -rf ./cloudflare-proxy/flibusta-proxy/build
rm -rf ./dist
rm -rf ./build
echo -e "${GREEN}✓ All build artifacts removed${NC}"

# 4. Remove all package-lock.json, yarn.lock, and pnpm-lock.yaml files
echo -e "${YELLOW}Removing all lock files...${NC}"
find . -name "package-lock.json" -type f -delete
find . -name "yarn.lock" -type f -delete
find . -name "pnpm-lock.yaml" -type f -delete
echo -e "${GREEN}✓ All lock files removed${NC}"

# 5. Remove all log files and temporary files
echo -e "${YELLOW}Removing all log and temporary files...${NC}"
find . -name "*.log" -type f -delete
find . -name "*.tmp" -type f -delete
find . -name "*.temp" -type f -delete
find . -name ".DS_Store" -type f -delete
echo -e "${GREEN}✓ All log and temporary files removed${NC}"

# 6. Remove any large binary files
echo -e "${YELLOW}Removing any large binary files...${NC}"
find . -name "*.epub" -type f -delete
find . -size +10M -type f -not -path "*.git*" -exec rm -f {} \;
echo -e "${GREEN}✓ Large binary files removed${NC}"

# 7. Clean .git directory
echo -e "${YELLOW}Cleaning .git directory...${NC}"
git gc --aggressive --prune=now
echo -e "${GREEN}✓ Git directory cleaned${NC}"

# 8. Create a minimal .gitignore
echo -e "${YELLOW}Creating a comprehensive .gitignore...${NC}"
cat > .gitignore << 'EOL'
# Dependencies
node_modules/
*/node_modules/
**/node_modules/
.pnp
.pnp.js
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist/
*/dist/
**/dist/
build/
*/build/
**/build/
out/
*/out/
**/out/

# Next.js
.next/
*/.next/
**/.next/
.next/cache/
*/.next/cache/
**/.next/cache/

# Caches
.cache/
*/.cache/
**/.cache/
.turbo

# Logs
logs/
*/logs/
**/logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# OS specific
.DS_Store
Thumbs.db

# Project specific
*.epub
EOL
echo -e "${GREEN}✓ Comprehensive .gitignore created${NC}"

# 9. Create a README.md with setup instructions
echo -e "${YELLOW}Creating a README.md with setup instructions...${NC}"
cat > README.md << 'EOL'
# Project Setup

This repository has been optimized for GitHub. To set up the project locally, follow these steps:

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:
   ```
   # Root dependencies
   npm install

   # Client dependencies
   cd client
   npm install
   cd ..

   # Cloudflare proxy dependencies (if needed)
   cd cloudflare-proxy/flibusta-proxy
   npm install
   cd ../..
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` (if available)
   - Fill in the required environment variables

4. Start the development server:
   ```
   npm run dev
   ```

## Project Structure

- `client/`: Frontend application (Next.js)
- `server/`: Backend server
- `cloudflare-proxy/`: Cloudflare Workers proxy
- `models/`: Database models
- `controllers/`: API controllers
- `routes/`: API routes
- `middleware/`: Express middleware
- `utils/`: Utility functions
- `config/`: Configuration files

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build the project
- `npm start`: Start production server
- `./cleanup.sh`: Clean up build artifacts and caches
- `./git-optimize.sh`: Optimize Git repository
EOL
echo -e "${GREEN}✓ README.md created${NC}"

# 10. Create a minimal package.json with scripts to reinstall dependencies
echo -e "${YELLOW}Creating a minimal package.json with setup scripts...${NC}"
cat > package.json << 'EOL'
{
  "name": "project",
  "version": "1.0.0",
  "description": "Project optimized for GitHub",
  "main": "index.js",
  "scripts": {
    "postinstall": "npm run install:all",
    "install:all": "npm run install:client && npm run install:proxy",
    "install:client": "cd client && npm install",
    "install:proxy": "cd cloudflare-proxy/flibusta-proxy && npm install",
    "dev": "node index.js",
    "build": "cd client && npm run build",
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOL
echo -e "${GREEN}✓ Minimal package.json created${NC}"

# Record final size
echo
echo -e "${BLUE}Final project size:${NC} $(calculate_size)"
echo -e "${BLUE}Size reduction:${NC} $(echo "scale=2; ($(du -sk . | awk '{print $1}' | sed 's/M//') - $(du -sk . | awk '{print $1}' | sed 's/M//')) / 1024" | bc) MB"

echo
echo -e "${GREEN}Deep cleanup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Commit your changes: git commit -m 'Deep clean repository for GitHub'"
echo "2. Push to GitHub: git push origin <branch-name>"
echo "3. When cloning this repository, run 'npm install' to reinstall all dependencies"
echo
echo -e "${RED}NOTE: You will need to reinstall dependencies to continue development.${NC}"
echo -e "${RED}Your original package.json files are backed up in .package-backups/${NC}" 