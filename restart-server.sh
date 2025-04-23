#!/bin/bash
echo "Restarting server..."
kill -SIGINT $(lsof -t -i:3000) 2>/dev/null || true
node index.js &
echo "Server restarted"
