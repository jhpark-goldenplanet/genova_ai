#!/bin/bash

################################################################################
# Genova AI Frontend - Develop Service Deployment
#
# This script deploys the frontend to the dedicated Cloud Run service
# `genova-frontend-develop` using Cloud Build.
#
# Usage: bash ./deploy-develop-service.sh
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ID="genova-ai-project"
REGION="asia-northeast3"
SERVICE_NAME="genova-frontend-develop"
BUILD_CONFIG="cloudbuild-develop-service.yaml"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Genova AI Frontend - Develop Service Deployment         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

echo -e "${GREEN}[1/3] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
echo ""

echo -e "${GREEN}[2/3] Submitting build to Cloud Build...${NC}"
echo "This may take 5-10 minutes..."
echo ""
gcloud builds submit .. --config="frontend/$BUILD_CONFIG" --project="$PROJECT_ID"
echo ""

echo -e "${GREEN}[3/3] Deployment completed!${NC}"
echo ""

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")

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
    echo "  gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=50"
    echo ""
else
    echo -e "${YELLOW}Could not retrieve service URL. Check Cloud Console.${NC}"
fi

echo -e "${GREEN}Done!${NC}"
