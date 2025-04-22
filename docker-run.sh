#!/bin/bash

# Stop any running containers
echo "Stopping any running containers..."
docker-compose down

# Build and start the containers
echo "Building and starting containers..."
docker-compose up -d --build

# Show container status
echo "Container status:"
docker-compose ps

echo ""
echo "Application is now running with custom start script!"
echo "Main application: http://localhost:3000"
echo "Admin interface: http://localhost:6969/admin"
echo ""
echo "Both servers are running in a single container."
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"