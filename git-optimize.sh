#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Git Repository Optimization Script ===${NC}"
echo -e "${YELLOW}This script will optimize your Git repository for GitHub.${NC}"
echo

# Check if this is a Git repository
if [ ! -d ".git" ]; then
  echo -e "${RED}Error: This is not a Git repository.${NC}"
  exit 1
fi

# Ask for confirmation
read -p "Continue with Git optimization? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Optimization aborted.${NC}"
  exit 1
fi

echo -e "${GREEN}Starting Git optimization...${NC}"

# 1. Run cleanup script first if it exists
if [ -f "./cleanup.sh" ]; then
  echo -e "${YELLOW}Running cleanup script first...${NC}"
  ./cleanup.sh
  echo -e "${GREEN}✓ Cleanup completed${NC}"
fi

# 2. Make sure .gitignore is properly set up
if [ ! -f ".gitignore" ]; then
  echo -e "${RED}Error: .gitignore file not found. Please create one first.${NC}"
  exit 1
fi

# 3. Remove files from Git that are now in .gitignore
echo -e "${YELLOW}Removing files from Git that are now in .gitignore...${NC}"
git rm -r --cached .
git add .
echo -e "${GREEN}✓ Files removed from Git cache${NC}"

# 4. Compress Git history
echo -e "${YELLOW}Compressing Git history...${NC}"
git gc --aggressive --prune=now
echo -e "${GREEN}✓ Git history compressed${NC}"

# 5. Check for large files in Git history
echo -e "${YELLOW}Checking for large files in Git history...${NC}"
git rev-list --objects --all | grep -f <(git verify-pack -v .git/objects/pack/*.idx | sort -k 3 -n | tail -10 | awk '{print $1}')

# 6. Provide instructions for removing large files if needed
echo
echo -e "${YELLOW}If you need to remove large files from Git history, consider using BFG Repo-Cleaner:${NC}"
echo "1. Install BFG: brew install bfg (macOS) or download from https://rtyley.github.io/bfg-repo-cleaner/"
echo "2. Create a backup of your repository"
echo "3. Run: bfg --strip-blobs-bigger-than 10M"
echo "4. Run: git reflog expire --expire=now --all && git gc --prune=now --aggressive"

echo
echo -e "${GREEN}Git optimization complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Commit your changes: git commit -m 'Clean repository and update .gitignore'"
echo "2. Push to GitHub: git push origin <branch-name>"
echo "3. If you had to remove large files from history, use: git push origin --force" 