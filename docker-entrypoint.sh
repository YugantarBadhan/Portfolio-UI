#!/bin/sh

# Docker entrypoint script for frontend deployment
echo "Starting frontend container..."

# Define the directory containing built files
HTML_DIR="/usr/share/nginx/html"

# Function to replace API URL in JavaScript files
replace_api_url() {
    local old_url="$1"
    local new_url="$2"
    
    if [ -n "$new_url" ]; then
        echo "Replacing API URL: $old_url -> $new_url"
        
        # Replace in all JavaScript files
        find "$HTML_DIR" -name "*.js" -type f -exec sed -i "s|${old_url}|${new_url}|g" {} \;
        
        # Also replace in any potential config files
        find "$HTML_DIR" -name "*.json" -type f -exec sed -i "s|${old_url}|${new_url}|g" {} \;
        
        echo "API URL replacement completed"
    else
        echo "No API URL replacement needed"
    fi
}

# Replace API URLs based on environment variables
if [ -n "$API_URL" ]; then
    # Replace the hardcoded production API URL with the environment variable
    replace_api_url "https://portfolio-api-production-b9dc.up.railway.app/api" "$API_URL"
elif [ -n "$RAILWAY_ENVIRONMENT" ]; then
    # If running on Railway but no explicit API_URL, try to construct it
    if [ -n "$RAILWAY_PROJECT_NAME" ]; then
        CONSTRUCTED_API_URL="https://${RAILWAY_PROJECT_NAME}-api-production.up.railway.app/api"
        replace_api_url "https://portfolio-api-production-b9dc.up.railway.app/api" "$CONSTRUCTED_API_URL"
    fi
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