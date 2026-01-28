#!/bin/bash

################################################################################
# Genova AI Backend - Local Development Server
#
# This script starts the FastAPI development server locally.
#
# Prerequisites:
# - Python 3.11+ installed
# - .env file with required environment variables
# - Local PostgreSQL and Redis running (use ../setup-local-env.sh)
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
echo -e "${GREEN}║     Genova AI Backend - Local Development Server          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo ""
    echo "Please create .env file. See .env.example for reference."
    echo ""
    exit 1
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating...${NC}"
    python -m venv .venv
    echo ""
fi

# Activate virtual environment
echo -e "${GREEN}Activating virtual environment...${NC}"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    source .venv/Scripts/activate
else
    # Unix-like
    source .venv/bin/activate
fi

# Install dependencies if requirements.txt changed
if [ ! -f ".venv/.installed" ] || [ "requirements.txt" -nt ".venv/.installed" ]; then
    echo -e "${YELLOW}Installing/updating dependencies...${NC}"
    pip install -r requirements.txt
    touch .venv/.installed
    echo ""
fi

# Check if PostgreSQL is running
echo -e "${GREEN}Checking database connection...${NC}"
if ! python -c "import asyncpg; import asyncio; asyncio.run(asyncpg.connect('postgresql://genova_user:genova_password@localhost:5432/genova_ai'))" 2>/dev/null; then
    echo -e "${RED}Cannot connect to PostgreSQL!${NC}"
    echo ""
    echo "Make sure PostgreSQL is running:"
    echo "  1. Start with docker-compose: cd .. && ./setup-local-env.sh"
    echo "  2. Or start manually: docker run -d -p 5432:5432 -e POSTGRES_USER=genova_user -e POSTGRES_PASSWORD=genova_password -e POSTGRES_DB=genova_ai postgres:15"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Database connection OK${NC}"
echo ""

# Start development server
echo -e "${GREEN}Starting FastAPI development server...${NC}"
echo ""
echo -e "${YELLOW}Server will be available at:${NC}"
echo "  - API: http://localhost:8000"
echo "  - Docs: http://localhost:8000/docs"
echo "  - ReDoc: http://localhost:8000/redoc"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

uvicorn app.main:app --reload --port 8000
