#!/bin/sh

# Docker entrypoint script for frontend deployment
echo "Starting frontend container..."

# Set default port if not provided
export PORT=${PORT:-8080}
echo "Using port: $PORT"

# Configure nginx with the correct port
echo "Configuring nginx for port $PORT..."
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Define the directory containing built files
HTML_DIR="/usr/share/nginx/html"

# Replace API URLs based on environment variables
if [ -n "$API_URL" ]; then
    echo "Replacing API URL with environment variable: $API_URL"
    
    # More comprehensive URL replacement patterns
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|https://portfolio-api-production-b9dc.up.railway.app/api|${API_URL}|g" {} \;
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|http://localhost:8080/api|${API_URL}|g" {} \;
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|localhost:8080/api|${API_URL#*://}|g" {} \;
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|\"localhost:8080\"|\"${API_URL#*://}\"|g" {} \;
    
    # Also check for any hardcoded localhost references in any format
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|http:\\/\\/localhost:8080\\/api|${API_URL}|g" {} \;
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|\"http://localhost:8080/api\"|\"${API_URL}\"|g" {} \;
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|'http://localhost:8080/api'|'${API_URL}'|g" {} \;
    
    echo "API URL replacement completed"
    
    # Debug: Show what files were processed and verify replacement
    echo "Files processed and content sample:"
    find "$HTML_DIR" -name "*.js" -type f | head -3
    
    echo "Verifying replacement - checking for remaining localhost references:"
    if find "$HTML_DIR" -name "*.js" -type f -exec grep -l "localhost.*api" {} \; | head -1; then
        echo "WARNING: Some localhost references may still exist"
    else
        echo "SUCCESS: No localhost references found in JS files"
    fi
    
elif [ -n "$RAILWAY_ENVIRONMENT" ]; then
    # If running on Railway but no explicit API_URL, try to construct it
    if [ -n "$RAILWAY_PROJECT_NAME" ]; then
        CONSTRUCTED_API_URL="https://${RAILWAY_PROJECT_NAME}-api-production.up.railway.app/api"
        echo "Using constructed API URL: $CONSTRUCTED_API_URL"
        
        find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|https://portfolio-api-production-b9dc.up.railway.app/api|${CONSTRUCTED_API_URL}|g" {} \;
        find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|http://localhost:8080/api|${CONSTRUCTED_API_URL}|g" {} \;
        find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|localhost:8080/api|${CONSTRUCTED_API_URL#*://}|g" {} \;
    fi
else
    echo "No API URL environment variable found, using default"
fi

# Replace admin token if provided
if [ -n "$ADMIN_TOKEN" ]; then
    echo "Updating admin token in configuration..."
    find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|yugantarportfoliobadhan|${ADMIN_TOKEN}|g" {} \;
fi

# Ensure proper permissions
chown -R nginx:nginx "$HTML_DIR"
chmod -R 755 "$HTML_DIR"

echo "Frontend configuration completed"
echo "Starting nginx..."

# Execute the command passed to the container (nginx)
exec "$@"