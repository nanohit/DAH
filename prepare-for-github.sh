#!/bin/bash

# Prepare DAH project for GitHub and deployment

echo "Preparing repository for GitHub..."

# Make sure .env files are ignored
grep -q ".env" .gitignore || echo ".env" >> .gitignore
grep -q ".env.local" .gitignore || echo ".env.local" >> .gitignore
grep -q ".env.development.local" .gitignore || echo ".env.development.local" >> .gitignore
grep -q ".env.production.local" .gitignore || echo ".env.production.local" >> .gitignore

# Make sure sensitive information is not committed
echo "Checking for sensitive information..."

# Create production samples if they don't exist
if [ ! -f ".env.example" ]; then
  cp .env.production .env.example
  sed -i '' 's/your-secret-key-here-replace-in-render/YOUR_SECRET_KEY/g' .env.example
  sed -i '' 's/your-vk-token-here-replace-in-render/YOUR_VK_TOKEN/g' .env.example
  sed -i '' 's/your-imgbb-api-key-replace-in-render/YOUR_IMGBB_API_KEY/g' .env.example
  sed -i '' 's/password/YOUR_PASSWORD/g' .env.example
  echo "Created .env.example file"
fi

if [ ! -f "client/.env.example" ]; then
  cp client/.env.production client/.env.example
  sed -i '' 's/YOUR_GOOGLE_BOOKS_API_KEY/YOUR_API_KEY/g' client/.env.example
  echo "Created client/.env.example file"
fi

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
  git init
  echo "Git repository initialized"
fi

echo "Running clean-up..."
# Clean up unnecessary files
find . -name ".DS_Store" -delete
find . -name "*.log" -delete
find . -name "npm-debug.log*" -delete

echo "Repository is ready for GitHub!"
echo "Next steps:"
echo "1. Create a new repository on GitHub"
echo "2. Add the remote repository: git remote add origin YOUR_REPO_URL"
echo "3. Commit your changes: git add . && git commit -m 'Initial commit'"
echo "4. Push to GitHub: git push -u origin main"
echo ""
echo "To deploy on Render.com, connect your GitHub repository and use the settings in render.yaml" 