# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# Production stage  
FROM nginx:alpine

# Copy built app
COPY --from=build /app/dist/portfolio-UI/browser/ /usr/share/nginx/html/

# Create nginx config that uses Railway's PORT environment variable
RUN cat > /etc/nginx/conf.d/default.conf << 'EOL'
server {
    listen PORT_PLACEHOLDER;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOL

# Create startup script that replaces PORT_PLACEHOLDER with actual PORT
RUN cat > /docker-entrypoint.sh << 'EOL'
#!/bin/sh
PORT=${PORT:-80}
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/conf.d/default.conf
echo "=== Nginx will listen on port $PORT ==="
cat /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
EOL

RUN chmod +x /docker-entrypoint.sh

# Show what we have
RUN echo "=== Files ===" && ls -la /usr/share/nginx/html/

EXPOSE $PORT
CMD ["/docker-entrypoint.sh"]