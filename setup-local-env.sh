#!/bin/bash

################################################################################
# Genova AI - Local Environment Setup
#
# This script starts PostgreSQL and Redis using Docker Compose
# for local development.
#
# Prerequisites:
# - Docker and Docker Compose installed
#
# Usage: ./setup-local-env.sh
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Genova AI - Local Environment Setup                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running!${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    exit 1
fi

echo -e "${GREEN}Starting PostgreSQL and Redis...${NC}"
echo ""

# Start services
docker-compose up -d

echo ""
echo -e "${GREEN}Waiting for services to be ready...${NC}"
sleep 5

# Check PostgreSQL
echo -e "${BLUE}Checking PostgreSQL...${NC}"
if docker-compose exec -T postgres pg_isready -U genova_user > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL might still be starting up${NC}"
fi

# Check Redis
echo -e "${BLUE}Checking Redis...${NC}"
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is ready${NC}"
else
    echo -e "${YELLOW}⚠ Redis might still be starting up${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Local Environment Ready!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Services:${NC}"
echo "  - PostgreSQL: localhost:5432"
echo "    User: genova_user"
echo "    Password: genova_password"
echo "    Database: genova_ai"
echo ""
echo "  - Redis: localhost:6379"
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose stop"
echo "  - Remove services: docker-compose down"
echo "  - Remove with data: docker-compose down -v"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Backend: cd backend && ./deploy-local.sh"
echo "  2. Frontend: cd frontend && ./deploy-local.sh"
echo ""
echo -e "${GREEN}Done!${NC}"
