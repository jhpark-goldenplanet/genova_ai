#!/bin/bash

################################################################################
# Genova AI Frontend - Dev Environment Deployment
#
# This script deploys the frontend to Cloud Run using Cloud Build.
# Uses Secret Manager for sensitive configuration.
#
# Prerequisites:
# - gcloud CLI configured with genova-ai-project
# - Secret Manager secrets created (dev-next-public-api-key)
# - Cloud Build API enabled
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
echo -e "${GREEN}║        Genova AI Frontend - Dev Deployment                ║${NC}"
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
echo "This may take 5-10 minutes..."
echo ""

gcloud builds submit --config=cloudbuild.yaml --project="$PROJECT_ID"

echo ""
echo -e "${GREEN}[3/3] Deployment completed!${NC}"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe genova-frontend --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Deployment Successful!                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Service URL:${NC} $SERVICE_URL"
    echo ""
    echo -e "${YELLOW}Test the deployment:${NC}"
    echo "  curl $SERVICE_URL"
    echo ""
    echo -e "${YELLOW}View logs:${NC}"
    echo "  gcloud run services logs read genova-frontend --region=$REGION --limit=50"
    echo ""
else
    echo -e "${YELLOW}Could not retrieve service URL. Check Cloud Console.${NC}"
fi

echo -e "${GREEN}Done!${NC}"
