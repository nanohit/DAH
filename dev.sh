#!/bin/bash

# Store the root directory path
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📂 Project root directory: $ROOT_DIR"

echo "🔍 Checking for existing processes on ports 5001, 3000, and 8787..."
pid_backend=$(lsof -ti:5001)
pid_frontend=$(lsof -ti:3000)
pid_cloudflare=$(lsof -ti:8787)

if [ ! -z "$pid_backend" ]; then
    echo "🛑 Found process using port 5001 (PID: $pid_backend). Stopping it..."
    kill -9 $pid_backend
    echo "✅ Backend process stopped"
else
    echo "✅ Port 5001 is free"
fi

if [ ! -z "$pid_frontend" ]; then
    echo "🛑 Found process using port 3000 (PID: $pid_frontend). Stopping it..."
    kill -9 $pid_frontend
    echo "✅ Frontend process stopped"
else
    echo "✅ Port 3000 is free"
fi

if [ ! -z "$pid_cloudflare" ]; then
    echo "🛑 Found process using port 8787 (PID: $pid_cloudflare). Stopping it..."
    kill -9 $pid_cloudflare
    echo "✅ Cloudflare worker stopped"
else
    echo "✅ Port 8787 is free"
fi

# Start Cloudflare worker
echo "🚀 Starting Cloudflare worker..."
if [ -d "$ROOT_DIR/cloudflare-proxy/flibusta-proxy" ]; then
    cd "$ROOT_DIR/cloudflare-proxy/flibusta-proxy"
    npx wrangler dev --port 8787 &
    cd "$ROOT_DIR"
else
    echo "❌ Error: Cloudflare worker directory not found"
    exit 1
fi

# Start backend server
echo "🚀 Starting backend server..."
if [ -f "$ROOT_DIR/index.js" ]; then
    cd "$ROOT_DIR"
    node index.js &
else
    echo "❌ Error: Backend server file (index.js) not found"
    exit 1
fi

# Start frontend development server
echo "🚀 Starting frontend server..."
if [ -d "$ROOT_DIR/client" ]; then
    cd "$ROOT_DIR/client"
    npm run dev &
else
    echo "❌ Error: Frontend directory not found"
    exit 1
fi

# Wait for all background processes
wait

# This script will:
# 1. Store the absolute path to the project root
# 2. Check if ports 5001, 3000, and 8787 are in use
# 3. If they are, kill the processes
# 4. Start the Cloudflare worker in development mode
# 5. Start both backend and frontend development servers
# 6. Add error checking for required directories and files 