#!/bin/sh
set -e

echo "Starting GPU Leaderboard application..."

# Create data directory if it doesn't exist
mkdir -p /app/data
echo "Ensuring data directory exists: /app/data"

# Initialize data.json if it doesn't exist
if [ ! -f /app/data/data.json ]; then
  echo '{}' > /app/data/data.json
  echo "Initialized empty data.json file"
fi

# Initialize ips.json if it doesn't exist
if [ ! -f /app/data/ips.json ]; then
  echo '{}' > /app/data/ips.json
  echo "Initialized empty ips.json file"
fi

echo "Data files initialized successfully"
echo "Starting application with: $@"

# Execute the provided command (node start.js)
exec "$@"