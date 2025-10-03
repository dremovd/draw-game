#!/bin/bash

# CORS Proxy Server Launcher
# Loads configuration from .env file

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    echo ""
    echo "Creating a template .env file..."
    cat > .env << 'EOF'
# CORS Proxy Server Configuration

# Required: Secret API key for authentication
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY=your-secret-key-here

# Optional: Server host (default: 0.0.0.0 for all interfaces)
HOST=0.0.0.0

# Optional: Server port (default: 8080)
PORT=8080

# Optional: Comma-separated list of allowed target domains (empty = allow all)
# Example: ALLOWED_DOMAINS=api.poe.com,generativelanguage.googleapis.com
ALLOWED_DOMAINS=

# Optional: Request timeout in milliseconds (default: 30000)
# TIMEOUT=30000
EOF
    echo ""
    echo "✓ Created .env file with default configuration"
    echo ""
    echo "Please edit .env and set your API_KEY, then run this script again."
    echo ""
    echo "Generate a secure key with:"
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    echo ""
    exit 1
fi

# Load environment variables from .env
echo "Loading configuration from .env..."
export $(grep -v '^#' .env | grep -v '^$' | xargs)

# Validate API_KEY
if [ -z "$API_KEY" ] || [ "$API_KEY" = "your-secret-key-here" ]; then
    echo "Error: API_KEY not set or using default value!"
    echo ""
    echo "Please edit .env and set a secure API_KEY."
    echo ""
    echo "Generate one with:"
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    echo ""
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if cors-proxy-server.js exists
if [ ! -f "cors-proxy-server.js" ]; then
    echo "Error: cors-proxy-server.js not found!"
    echo "Please ensure you're running this script from the project directory."
    exit 1
fi

# Display configuration (hide API key partially)
echo ""
echo "=========================================="
echo "Starting CORS Proxy Server"
echo "=========================================="
echo "Host: ${HOST:-0.0.0.0}"
echo "Port: ${PORT:-8080}"
echo "API Key: ${API_KEY:0:8}...${API_KEY: -4}"
if [ -n "$ALLOWED_DOMAINS" ]; then
    echo "Allowed Domains: $ALLOWED_DOMAINS"
else
    echo "Allowed Domains: ALL (unrestricted)"
fi
echo "=========================================="
echo ""

# Run the server
node cors-proxy-server.js
