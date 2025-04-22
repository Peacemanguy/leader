# GPU Leaderboard Application - Docker Setup

This repository contains a Node.js application for GPU leaderboards with Docker configuration for easy deployment.

## Features

- Main server for user voting and interaction
- Admin server for managing entries
- Persistent data storage
- One vote per IP address per category
- Custom start script to run both servers in a single container

## Docker Setup

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. Clone this repository
2. Navigate to the project directory
3. Build and start the containers:

#### Option 1: Using the provided script

- Windows: Double-click the `docker-run.bat` file
- Linux/Mac: Run `./docker-run.sh` (make it executable first with `chmod +x docker-run.sh`)

#### Option 2: Using Docker Compose directly

```bash
docker-compose up -d
```

4. Access the application:
   - Main application: http://localhost:3000
   - Admin interface: http://localhost:6969/admin
     - Default admin credentials:
       - Username: admin
       - Password: secure_password123 (you should change this in admin_server.js)

### Stopping the Application

```bash
docker-compose down
```

## Data Persistence

All data is stored in the `./data` directory, which is mounted as a volume in the Docker container. This ensures that your data persists even if the container is removed.

## Ports

- 3000: Main application server
- 6969: Admin server

## Environment Variables

You can customize the application by modifying the `.env` file:

```
# Main server configuration
PORT=3000
NODE_ENV=production

# Admin server configuration
ADMIN_PORT=6969
```

These variables are used in the `docker-compose.yml` file and passed to the application.

## Security Notes

- For production use, consider changing the admin credentials in `admin_server.js`
- Consider adding HTTPS for secure connections
- Review the session configuration in `admin_server.js` for production use

## Architecture

### Docker Setup

The application is containerized using Docker with the following components:

- **Dockerfile**: Builds a Node.js Alpine container with the application code
- **docker-compose.yml**: Orchestrates the container and sets up networking and volumes
- **docker-entrypoint.sh**: Initializes the data directory and files before starting the application
- **start.js**: Custom Node.js script that runs both the main server and admin server in a single container

### Custom Start Script

Instead of using npm scripts with concurrently, we use a custom Node.js script (`start.js`) to run both servers. This approach:

- Provides better process management in the Docker container
- Ensures proper handling of signals for graceful shutdown
- Simplifies logging by inheriting stdio from the parent process
- Avoids potential issues with npm scripts in containerized environments

### Data Persistence

All data is stored in JSON files in the `./data` directory, which is mounted as a volume in the Docker container. This ensures that:

- Data persists across container restarts and rebuilds
- Files can be backed up easily from the host machine
- Multiple containers can share the same data if needed

## License

ISC