#!/bin/bash

################################################################################
# GCP Resource Cleanup Script for Genova AI Backend
#
# WARNING: This script will PERMANENTLY DELETE all resources created by
# 1-create-resources.sh including databases, storage, and all data.
#
# This operation is IRREVERSIBLE!
#
# Usage: ./destroy-resources.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║   WARNING: Resource Cleanup Script                        ║${NC}"
echo -e "${RED}║   This will PERMANENTLY DELETE all resources!             ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load configuration if it exists
CONFIG_FILE="../config/.env.production"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    echo -e "${YELLOW}Configuration file not found. Using defaults...${NC}"
fi

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-northeast3}"
SERVICE_NAME="genova-ai-backend"
SQL_INSTANCE_NAME="genova-postgres"
REDIS_INSTANCE_NAME="genova-redis"
BUCKET_NAME="${GCS_BUCKET_NAME:-${PROJECT_ID}-genova-videos}"
VPC_CONNECTOR_NAME="genova-vpc-connector"
SERVICE_ACCOUNT_NAME="genova-backend-sa"
ARTIFACT_REGISTRY_REPO="genova-ai"

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Project ID not found in config. Please enter it:${NC}"
    read -p "GCP Project ID: " PROJECT_ID
fi

echo ""
echo -e "${YELLOW}Resources to be deleted:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""
echo "1. Cloud Run Service: $SERVICE_NAME"
echo "2. Cloud SQL Instance: $SQL_INSTANCE_NAME (including all databases)"
echo "3. Memorystore Redis: $REDIS_INSTANCE_NAME"
echo "4. Cloud Storage Bucket: $BUCKET_NAME (including all files)"
echo "5. VPC Connector: $VPC_CONNECTOR_NAME"
echo "6. Service Account: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "7. Artifact Registry: $ARTIFACT_REGISTRY_REPO (including all images)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Confirmation
echo -e "${RED}THIS ACTION CANNOT BE UNDONE!${NC}"
echo ""
read -p "Are you sure you want to delete all resources? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${GREEN}Cleanup cancelled. No resources were deleted.${NC}"
    exit 0
fi

echo ""
read -p "Please confirm again by typing the project ID '$PROJECT_ID': " PROJECT_CONFIRM

if [ "$PROJECT_CONFIRM" != "$PROJECT_ID" ]; then
    echo -e "${GREEN}Project ID did not match. Cleanup cancelled.${NC}"
    exit 0
fi

# Set the project
echo ""
echo -e "${YELLOW}[1/7] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
echo ""

# Delete Cloud Run service
echo -e "${YELLOW}[2/7] Deleting Cloud Run service...${NC}"
if gcloud run services describe "$SERVICE_NAME" --region="$REGION" &>/dev/null; then
    gcloud run services delete "$SERVICE_NAME" \
        --region="$REGION" \
        --quiet
    echo -e "${GREEN}Cloud Run service deleted${NC}"
else
    echo -e "${YELLOW}Cloud Run service not found. Skipping...${NC}"
fi
echo ""

# Delete VPC Connector
echo -e "${YELLOW}[3/7] Deleting VPC Connector...${NC}"
if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR_NAME" --region="$REGION" &>/dev/null; then
    gcloud compute networks vpc-access connectors delete "$VPC_CONNECTOR_NAME" \
        --region="$REGION" \
        --quiet
    echo -e "${GREEN}VPC Connector deleted${NC}"
else
    echo -e "${YELLOW}VPC Connector not found. Skipping...${NC}"
fi
echo ""

# Delete Cloud SQL instance
echo -e "${YELLOW}[4/7] Deleting Cloud SQL instance...${NC}"
echo "This may take a few minutes..."
if gcloud sql instances describe "$SQL_INSTANCE_NAME" &>/dev/null; then
    gcloud sql instances delete "$SQL_INSTANCE_NAME" \
        --quiet
    echo -e "${GREEN}Cloud SQL instance deleted${NC}"
else
    echo -e "${YELLOW}Cloud SQL instance not found. Skipping...${NC}"
fi
echo ""

# Delete Redis instance
echo -e "${YELLOW}[5/7] Deleting Redis instance...${NC}"
echo "This may take a few minutes..."
if gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region="$REGION" &>/dev/null; then
    gcloud redis instances delete "$REDIS_INSTANCE_NAME" \
        --region="$REGION" \
        --quiet
    echo -e "${GREEN}Redis instance deleted${NC}"
else
    echo -e "${YELLOW}Redis instance not found. Skipping...${NC}"
fi
echo ""

# Delete Cloud Storage bucket
echo -e "${YELLOW}[6/7] Deleting Cloud Storage bucket...${NC}"
if gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    echo "Deleting all objects in bucket..."
    gsutil -m rm -r "gs://$BUCKET_NAME/**" || true
    echo "Deleting bucket..."
    gcloud storage buckets delete "gs://$BUCKET_NAME" --quiet
    echo -e "${GREEN}Cloud Storage bucket deleted${NC}"
else
    echo -e "${YELLOW}Bucket not found. Skipping...${NC}"
fi
echo ""

# Delete Artifact Registry repository
echo -e "${YELLOW}[7/7] Deleting Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" --location="$REGION" &>/dev/null; then
    gcloud artifacts repositories delete "$ARTIFACT_REGISTRY_REPO" \
        --location="$REGION" \
        --quiet
    echo -e "${GREEN}Artifact Registry repository deleted${NC}"
else
    echo -e "${YELLOW}Artifact Registry repository not found. Skipping...${NC}"
fi
echo ""

# Note about Service Account
echo -e "${YELLOW}Note: Service Account cleanup${NC}"
echo "To delete the service account, run:"
echo "  gcloud iam service-accounts delete ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo -e "${YELLOW}Note: This is kept to prevent accidental IAM permission issues.${NC}"
echo -e "${YELLOW}Delete manually if you're sure you don't need it.${NC}"
echo ""

# Delete configuration file
echo -e "${YELLOW}Deleting configuration file...${NC}"
if [ -f "$CONFIG_FILE" ]; then
    rm "$CONFIG_FILE"
    echo -e "${GREEN}Configuration file deleted${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Resource Cleanup Completed Successfully!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓${NC} Cloud Run service deleted"
echo -e "${GREEN}✓${NC} VPC Connector deleted"
echo -e "${GREEN}✓${NC} Cloud SQL instance deleted (including all databases)"
echo -e "${GREEN}✓${NC} Redis instance deleted"
echo -e "${GREEN}✓${NC} Cloud Storage bucket deleted (including all files)"
echo -e "${GREEN}✓${NC} Artifact Registry repository deleted"
echo -e "${YELLOW}⚠${NC} Service Account kept (manual deletion required if needed)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}All resources have been cleaned up.${NC}"
echo -e "${YELLOW}Note: Billing may continue for a few hours as resources finalize deletion.${NC}"
echo ""
