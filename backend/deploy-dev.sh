#!/bin/bash

################################################################################
# Genova AI Backend - Dev Environment Deployment
#
# This script deploys the backend to Cloud Run using Cloud Build.
# Uses Secret Manager for sensitive configuration.
#
# Prerequisites:
# - gcloud CLI configured with genova-ai-project
# - Secret Manager secrets created (dev-db-password, dev-gemini-api-key, etc.)
# - Cloud Build API enabled
# - Artifact Registry repository 'genova-ai' created
#
# Usage: ./deploy-dev.sh
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Genova AI Backend - Dev Deployment                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_ID="genova-ai-project"
REGION="asia-northeast3"

echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set project
echo -e "${GREEN}[1/3] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
echo ""

# Submit build
echo -e "${GREEN}[2/3] Submitting build to Cloud Build...${NC}"
echo "This may take 10-15 minutes..."
echo ""

gcloud builds submit .. --config=backend/cloudbuild.yaml --project="$PROJECT_ID"

echo ""
echo -e "${GREEN}[3/3] Deployment completed!${NC}"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe genova-ai-backend --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Deployment Successful!                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Service URL:${NC} $SERVICE_URL"
    echo ""
    echo -e "${YELLOW}Test the deployment:${NC}"
    echo "  # Health Check"
    echo "  curl $SERVICE_URL/health"
    echo ""
    echo "  # API Docs"
    echo "  open $SERVICE_URL/docs"
    echo ""
    echo -e "${YELLOW}View logs:${NC}"
    echo "  gcloud run services logs read genova-ai-backend --region=$REGION --limit=50"
    echo ""

    # Quick health check
    echo -e "${GREEN}Running health check...${NC}"
    sleep 5
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Health check passed! Service is running.${NC}"
    else
        echo -e "${YELLOW}⚠ Health check returned HTTP $HTTP_CODE${NC}"
        echo "The service may still be starting up. Check logs for details."
    fi
else
    echo -e "${YELLOW}Could not retrieve service URL. Check Cloud Console.${NC}"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
