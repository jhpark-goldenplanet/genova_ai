#!/bin/bash

################################################################################
# Genova AI Frontend - Local Development Server
#
# This script starts the Next.js development server locally.
#
# Prerequisites:
# - Node.js 18+ and Yarn installed
# - .env.local file with required environment variables
#
# Usage: ./deploy-local.sh
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Genova AI Frontend - Local Development Server         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: .env.local file not found!${NC}"
    echo ""
    echo "Please create .env.local with the following variables:"
    echo ""
    cat <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_KEY=your-api-key-here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=genova-ai-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=genova-ai-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=genova-ai-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987680405347
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
EOF
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Installing dependencies...${NC}"
    yarn install
    echo ""
fi

# Next dev can fail against stale build artifacts after branch/layout changes.
if [ -d ".next" ]; then
    echo -e "${YELLOW}Removing stale .next build cache...${NC}"
    rm -rf .next
    echo ""
fi

# Start development server
echo -e "${GREEN}Starting Next.js development server...${NC}"
echo ""
echo -e "${YELLOW}Server will be available at:${NC} http://localhost:3000"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

yarn dev
