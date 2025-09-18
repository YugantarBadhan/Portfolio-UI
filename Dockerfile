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

# Create script that generates config with correct port
RUN cat > /start.sh << 'EOF'
#!/bin/sh
PORT=${PORT:-80}
cat > /etc/nginx/conf.d/default.conf << EOL
server {
    listen $PORT;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOL
echo "Nginx listening on port $PORT"
nginx -g "daemon off;"
EOF

RUN chmod +x /start.sh

CMD ["/start.sh"]