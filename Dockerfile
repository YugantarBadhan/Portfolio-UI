# Build stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Debug: Show what was actually built
RUN echo "=== Build output structure ===" && \
    ls -la /app/dist/ && \
    echo "=== Portfolio-UI directory ===" && \
    ls -la /app/dist/portfolio-UI/ && \
    echo "=== Looking for browser subdirectory ===" && \
    ls -la /app/dist/portfolio-UI/browser/ || echo "No browser subdirectory found"

# Production stage  
FROM nginx:alpine

# Copy built app - copy ONLY the browser directory contents (this will overwrite nginx default files)
COPY --from=build /app/dist/portfolio-UI/browser/ /usr/share/nginx/html/

# Debug: Show what was copied to nginx
RUN echo "=== Files copied to nginx ===" && \
    ls -la /usr/share/nginx/html/

# Create simple nginx configuration
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]