### STAGE 1: Build ###
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Clean npm cache and install dependencies (include devDependencies for build)
RUN npm cache clean --force
RUN npm ci --silent

# Install Angular CLI globally (use compatible version)
RUN npm install -g @angular/cli@20.0.4

# Copy source code
COPY . .

# Build the Angular application for production
RUN npm run build:prod

### STAGE 2: Serve with Nginx ###
FROM nginx:1.25-alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from build stage
COPY --from=build /app/dist/portfolio-UI /usr/share/nginx/html

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port (Railway will handle port mapping)
EXPOSE 80

# Use custom entrypoint for environment variable substitution
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]