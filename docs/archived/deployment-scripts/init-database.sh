#!/bin/bash

################################################################################
# PostgreSQL Database Initialization Script
#
# This script initializes the Cloud SQL PostgreSQL database with the schema
# required for Genova AI Backend.
#
# Prerequisites:
# - Cloud SQL instance must be created
# - Configuration must be saved in deployment/config/.env.production
#
# Usage: ./init-database.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Genova AI Backend - Database Initialization Script      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load configuration
CONFIG_FILE="../config/.env.production"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    echo "Please run 1-create-resources.sh first to create GCP resources."
    exit 1
fi

echo -e "${GREEN}[1/4] Loading configuration from $CONFIG_FILE...${NC}"
source "$CONFIG_FILE"

# Verify required variables
if [ -z "$SQL_CONNECTION_NAME" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Missing required configuration variables${NC}"
    exit 1
fi
echo ""

# Check if Cloud SQL Proxy is available
echo -e "${GREEN}[2/4] Checking Cloud SQL Proxy...${NC}"
PROXY_BINARY="cloud-sql-proxy"

# Check if cloud-sql-proxy exists in PATH or current directory
if ! command -v cloud-sql-proxy &> /dev/null && [ ! -f "./cloud-sql-proxy" ]; then
    echo -e "${YELLOW}Cloud SQL Proxy not found. Downloading...${NC}"

    # Download Cloud SQL Proxy
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        # Windows (Git Bash)
        curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.x64.exe
        PROXY_BINARY="./cloud-sql-proxy.exe"
    else
        # Linux
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
    fi

    chmod +x cloud-sql-proxy* 2>/dev/null || true
    echo -e "${GREEN}Cloud SQL Proxy downloaded successfully${NC}"

    # Use local proxy if not in PATH
    if [ ! -f "./cloud-sql-proxy.exe" ]; then
        PROXY_BINARY="./cloud-sql-proxy"
    fi
else
    if [ -f "./cloud-sql-proxy.exe" ]; then
        PROXY_BINARY="./cloud-sql-proxy.exe"
    elif [ -f "./cloud-sql-proxy" ]; then
        PROXY_BINARY="./cloud-sql-proxy"
    fi
fi
echo ""

# Start Cloud SQL Proxy in background
echo -e "${GREEN}[3/4] Starting Cloud SQL Proxy...${NC}"
PROXY_PORT=5433
$PROXY_BINARY --port=$PROXY_PORT "$SQL_CONNECTION_NAME" &
PROXY_PID=$!

# Wait for proxy to be ready
echo "Waiting for Cloud SQL Proxy to be ready..."
sleep 5

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ ! -z "$PROXY_PID" ]; then
        kill $PROXY_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Initialize database schema
echo -e "${GREEN}[4/4] Initializing database schema...${NC}"
echo "Connecting to database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Execute SQL schema
PGPASSWORD="$DB_PASSWORD" psql \
    -h localhost \
    -p $PROXY_PORT \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f init-schema.sql

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Database Schema Initialized Successfully!         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show created tables
echo -e "${YELLOW}Verifying created tables:${NC}"
PGPASSWORD="$DB_PASSWORD" psql \
    -h localhost \
    -p $PROXY_PORT \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "\dt" \
    -c "\di"

echo ""
echo -e "${GREEN}Database initialization complete!${NC}"
echo -e "${YELLOW}Next step: Build and deploy the application with ./scripts/2-deploy.sh${NC}"
