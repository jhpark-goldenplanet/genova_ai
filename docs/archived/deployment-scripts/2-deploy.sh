#!/bin/bash

################################################################################
# Cloud Run Deployment Script for Genova AI Backend
#
# This script builds the Docker image and deploys it to Cloud Run.
#
# Prerequisites:
# - GCP resources must be created (run 1-create-resources.sh first)
# - Database schema must be initialized (run sql/init-database.sh first)
# - Docker must be installed and running
#
# Usage: ./2-deploy.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Genova AI Backend - Cloud Run Deployment Script      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load configuration
CONFIG_FILE="../config/.env.production"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    echo "Please run 1-create-resources.sh first to create GCP resources."
    exit 1
fi

echo -e "${GREEN}[1/7] Loading configuration...${NC}"
source "$CONFIG_FILE"

# Verify required variables
if [ -z "$GCP_PROJECT_ID" ] || [ -z "$GCP_REGION" ]; then
    echo -e "${RED}Error: Missing required configuration variables${NC}"
    exit 1
fi

# Configuration
SERVICE_NAME="genova-ai-backend"
IMAGE_NAME="backend"
ARTIFACT_REGISTRY_REPO="genova-ai"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Project ID: $GCP_PROJECT_ID"
echo "Region: $GCP_REGION"
echo "Service Name: $SERVICE_NAME"
echo "Image: $FULL_IMAGE_NAME"
echo ""

# Set the project
echo -e "${GREEN}[2/7] Setting GCP project...${NC}"
gcloud config set project "$GCP_PROJECT_ID"
echo ""

# Create Artifact Registry repository if it doesn't exist
echo -e "${GREEN}[3/7] Creating Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" --location="$GCP_REGION" &>/dev/null; then
    echo -e "${YELLOW}Artifact Registry repository already exists. Skipping...${NC}"
else
    gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPO" \
        --repository-format=docker \
        --location="$GCP_REGION" \
        --description="Genova AI Backend container images"
fi
echo ""

# Configure Docker to use gcloud credentials
echo -e "${GREEN}[4/7] Configuring Docker authentication...${NC}"
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
echo ""

# Build Docker image
echo -e "${GREEN}[5/7] Building Docker image...${NC}"
echo "This may take 5-10 minutes..."
cd ../../  # Go to project root

docker build \
    --platform linux/amd64 \
    --tag "$FULL_IMAGE_NAME" \
    --file Dockerfile \
    .

echo -e "${GREEN}Docker image built successfully!${NC}"
echo ""

# Push image to Artifact Registry
echo -e "${GREEN}[6/7] Pushing image to Artifact Registry...${NC}"
echo "This may take a few minutes..."
docker push "$FULL_IMAGE_NAME"
echo -e "${GREEN}Image pushed successfully!${NC}"
echo ""

# Construct DATABASE_URL
DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION_NAME}"
# REDIS_URL is loaded from .env.production (Upstash)

# Create temporary env vars file for all env vars
ENV_VARS_FILE=$(mktemp)
cat > "$ENV_VARS_FILE" << EOF
APP_ENV: "production"
LOG_LEVEL: "INFO"
DATABASE_URL: "${DATABASE_URL}"
DATABASE_POOL_SIZE: "5"
DATABASE_MAX_OVERFLOW: "10"
REDIS_URL: "${REDIS_URL}"
GOOGLE_CLOUD_PROJECT: "${GCP_PROJECT_ID}"
GOOGLE_CLOUD_LOCATION: "${GCP_REGION}"
GCS_BUCKET_NAME: "${GCS_BUCKET_NAME}"
MAX_FILE_SIZE: "2GB"
PROCESSING_TIMEOUT: "900"
MAX_CONCURRENT_TASKS: "5"
REQUESTS_CA_BUNDLE: "/etc/ssl/certs/ca-certificates.crt"
CURL_CA_BUNDLE: "/etc/ssl/certs/ca-certificates.crt"
API_KEYS: "${API_KEYS:-CHANGE_THIS_TO_YOUR_SECRET_API_KEY}"
CORS_ORIGINS: "${CORS_ORIGINS:-*}"
GENAI_API_KEY: "${GENAI_API_KEY}"
VERTEX_AI_MODEL: "${VERTEX_AI_MODEL:-gemini-3-flash-preview}"
SUMMARIZATION_MODEL: "${SUMMARIZATION_MODEL:-gemini-3-flash-preview}"
EOF

# Deploy to Cloud Run
echo -e "${GREEN}[7/7] Deploying to Cloud Run...${NC}"
echo "This may take 5-10 minutes..."

gcloud run deploy "$SERVICE_NAME" \
    --image="$FULL_IMAGE_NAME" \
    --platform=managed \
    --region="$GCP_REGION" \
    --service-account="$SERVICE_ACCOUNT_EMAIL" \
    --memory=4Gi \
    --cpu=2 \
    --timeout=3600 \
    --concurrency=10 \
    --min-instances=0 \
    --max-instances=10 \
    --allow-unauthenticated \
    --add-cloudsql-instances="$SQL_CONNECTION_NAME" \
    --env-vars-file="$ENV_VARS_FILE" \
    --cpu-boost

# Clean up temp file
rm -f "$ENV_VARS_FILE"

echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$GCP_REGION" --format='value(status.url)')

# Display deployment summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Deployment Completed Successfully!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Service Information:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Service Name:${NC} $SERVICE_NAME"
echo -e "${GREEN}Service URL:${NC} $SERVICE_URL"
echo -e "${GREEN}Region:${NC} $GCP_REGION"
echo -e "${GREEN}Image:${NC} $FULL_IMAGE_NAME"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Testing the deployment:${NC}"
echo ""
echo "1. Health Check:"
echo "   curl ${SERVICE_URL}/health"
echo ""
echo "2. API Root:"
echo "   curl ${SERVICE_URL}/"
echo ""
echo "3. API Documentation:"
echo "   Open in browser: ${SERVICE_URL}/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Monitoring and Logs:${NC}"
echo ""
echo "View logs:"
echo "  gcloud run services logs read $SERVICE_NAME --region=$GCP_REGION --limit=50"
echo ""
echo "Monitor in Cloud Console:"
echo "  https://console.cloud.google.com/run/detail/${GCP_REGION}/${SERVICE_NAME}/metrics?project=${GCP_PROJECT_ID}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""

# Quick health check
echo -e "${BLUE}Running health check...${NC}"
sleep 5  # Wait for service to be fully ready
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed! Service is running.${NC}"
else
    echo -e "${YELLOW}⚠ Health check returned HTTP $HTTP_CODE${NC}"
    echo "The service may still be starting up. Check logs for details."
    echo "Run: gcloud run services logs read $SERVICE_NAME --region=$GCP_REGION --limit=20"
fi
echo ""

# Upload YouTube cookies if available
echo -e "${BLUE}Uploading YouTube cookies...${NC}"
COOKIE_FILE="../config/youtube_cookies.txt"

if [ -f "$COOKIE_FILE" ]; then
    echo "Found cookies file at $COOKIE_FILE"

    # Wait for service to be ready
    sleep 3

    # Upload cookies
    UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SERVICE_URL}/v1/youtube/upload-cookies" \
        -F "file=@$COOKIE_FILE")

    HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ YouTube cookies uploaded successfully!${NC}"
        echo "$RESPONSE_BODY" | grep -o '"message":"[^"]*"' || true
    else
        echo -e "${YELLOW}⚠ Failed to upload cookies (HTTP $HTTP_CODE)${NC}"
        echo "Response: $RESPONSE_BODY"
        echo "You can manually upload later using:"
        echo "  curl -X POST \"${SERVICE_URL}/v1/youtube/upload-cookies\" -F \"file=@${COOKIE_FILE}\""
    fi
else
    echo -e "${YELLOW}⚠ No YouTube cookies file found at $COOKIE_FILE${NC}"
    echo ""
    echo "To enable YouTube authentication:"
    echo "  1. Export cookies from your browser using 'Get cookies.txt LOCALLY' extension"
    echo "  2. Save as: $COOKIE_FILE"
    echo "  3. Re-run this deployment script, or manually upload:"
    echo "     curl -X POST \"${SERVICE_URL}/v1/youtube/upload-cookies\" -F \"file=@$COOKIE_FILE\""
fi
echo ""
