FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose ports
EXPOSE 3000 6969

# Set entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Command to run the application
CMD ["node", "start.js"]