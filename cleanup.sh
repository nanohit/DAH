#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Project Cleanup Script ===${NC}"
echo -e "${YELLOW}This script will remove build artifacts, caches, and temporary files to reduce project size.${NC}"
echo

# Function to show size before and after cleanup
calculate_size() {
  du -sh . | awk '{print $1}'
}

# Function to show size of a specific directory
dir_size() {
  if [ -d "$1" ]; then
    du -sh "$1" | awk '{print $1}'
  else
    echo "N/A"
  fi
}

# Record initial size
echo -e "${BLUE}Initial project size:${NC} $(calculate_size)"
echo

# Display sizes of major directories
echo -e "${BLUE}Current directory sizes:${NC}"
echo -e "Client: $(dir_size ./client)"
echo -e "Client node_modules: $(dir_size ./client/node_modules)"
echo -e "Client .next: $(dir_size ./client/.next)"
echo -e "Cloudflare-proxy: $(dir_size ./cloudflare-proxy)"
echo -e "Root node_modules: $(dir_size ./node_modules)"
echo

# Ask for confirmation
read -p "Continue with cleanup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Cleanup aborted.${NC}"
  exit 1
fi

echo -e "${GREEN}Starting cleanup...${NC}"

# 1. Clean Next.js cache and build artifacts
if [ -d "./client/.next" ]; then
  echo -e "${YELLOW}Cleaning Next.js cache and build artifacts...${NC}"
  rm -rf ./client/.next/cache
  rm -rf ./client/.next/server/pages
  rm -rf ./client/.next/server/chunks
  rm -rf ./client/.next/static/development
  echo -e "${GREEN}✓ Next.js cache cleaned${NC}"
fi

# 2. Remove node_modules/.cache directories
find . -type d -name ".cache" -exec rm -rf {} +
echo -e "${GREEN}✓ Node modules cache directories removed${NC}"

# 3. Clean package manager caches
if command -v npm &> /dev/null; then
  echo -e "${YELLOW}Cleaning npm cache...${NC}"
  npm cache clean --force
  echo -e "${GREEN}✓ npm cache cleaned${NC}"
fi

if command -v yarn &> /dev/null; then
  echo -e "${YELLOW}Cleaning yarn cache...${NC}"
  yarn cache clean
  echo -e "${GREEN}✓ yarn cache cleaned${NC}"
fi

# 4. Remove log files
echo -e "${YELLOW}Removing log files...${NC}"
find . -name "*.log" -type f -delete
echo -e "${GREEN}✓ Log files removed${NC}"

# 5. Remove temporary files
echo -e "${YELLOW}Removing temporary files...${NC}"
find . -name "*.tmp" -o -name "*.temp" -type f -delete
echo -e "${GREEN}✓ Temporary files removed${NC}"

# 6. Remove .DS_Store files
echo -e "${YELLOW}Removing .DS_Store files...${NC}"
find . -name ".DS_Store" -type f -delete
echo -e "${GREEN}✓ .DS_Store files removed${NC}"

# 7. Update .gitignore to ensure proper ignoring of build artifacts
echo -e "${YELLOW}Updating .gitignore file...${NC}"
if [ -f ".gitignore" ]; then
  # Check if entries already exist before adding them
  gitignore_content=$(cat .gitignore)
  
  entries_to_add=(
    "# Dependencies"
    "node_modules/"
    "*/node_modules/"
    "**/.pnp"
    ".pnp.js"
    
    "# Build outputs"
    "dist/"
    "build/"
    "out/"
    
    "# Next.js"
    ".next/"
    "**/.next/"
    ".next/cache/"
    "**/.next/cache/"
    
    "# Caches"
    ".cache/"
    "**/.cache/"
    ".turbo"
    
    "# Logs"
    "logs/"
    "*.log"
    "npm-debug.log*"
    "yarn-debug.log*"
    "yarn-error.log*"
    
    "# Environment variables"
    ".env"
    ".env.local"
    ".env.development.local"
    ".env.test.local"
    ".env.production.local"
    
    "# OS specific"
    ".DS_Store"
    "Thumbs.db"
    
    "# Project specific"
    "*.epub"
  )
  
  # Create a temporary file
  temp_gitignore=$(mktemp)
  
  # Copy existing content
  echo "$gitignore_content" > "$temp_gitignore"
  
  # Add new entries if they don't exist
  for entry in "${entries_to_add[@]}"; do
    if ! grep -q "^$entry$" "$temp_gitignore"; then
      echo "$entry" >> "$temp_gitignore"
    fi
  done
  
  # Replace the original .gitignore
  mv "$temp_gitignore" .gitignore
  echo -e "${GREEN}✓ .gitignore updated${NC}"
else
  # Create new .gitignore file
  for entry in "${entries_to_add[@]}"; do
    echo "$entry" >> .gitignore
  done
  echo -e "${GREEN}✓ New .gitignore created${NC}"
fi

# 8. Git cleanup (if it's a git repository)
if [ -d ".git" ]; then
  echo -e "${YELLOW}Cleaning Git repository...${NC}"
  
  # Check if there are any commits
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    # Clean up unnecessary files
    git gc --aggressive --prune=now
    echo -e "${GREEN}✓ Git repository cleaned${NC}"
  else
    echo -e "${YELLOW}No Git commits found, skipping Git cleanup${NC}"
  fi
fi

# Record final size
echo
echo -e "${BLUE}Final project size:${NC} $(calculate_size)"
echo -e "${BLUE}Size reduction:${NC} $(echo "scale=2; ($(du -sk . | awk '{print $1}') - $(du -sk . | awk '{print $1}')) / 1024" | bc) MB"

echo
echo -e "${GREEN}Cleanup complete!${NC}"
echo -e "${YELLOW}For even more space savings, consider:${NC}"
echo "1. Using a monorepo tool like Turborepo or Nx"
echo "2. Removing unused dependencies"
echo "3. Using Docker for development"
echo "4. Running 'npm prune --production' before deployment" 