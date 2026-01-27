#!/bin/bash

################################################################################
# GCP Resource Creation Script for Genova AI Backend
#
# This script creates all necessary GCP resources:
# - Cloud SQL (PostgreSQL)
# - Cloud Memorystore (Redis)
# - Cloud Storage Bucket
# - VPC Connector (for private IP connectivity)
# - Service Account with appropriate permissions
#
# Usage: ./1-create-resources.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-northeast3}"
ZONE="${GCP_ZONE:-${REGION}-a}"

# Resource names
SQL_INSTANCE_NAME="genova-postgres"
REDIS_INSTANCE_NAME="genova-redis"
BUCKET_NAME="${PROJECT_ID}-genova-videos"
VPC_CONNECTOR_NAME="genova-vpc-connector"
SERVICE_ACCOUNT_NAME="genova-backend-sa"

# Database configuration
DB_NAME="genova_ai"
DB_USER="genova_user"
DB_PASSWORD="${DB_PASSWORD:-}"  # Should be set via environment variable

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Genova AI Backend - GCP Resource Creation Script        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable is not set${NC}"
    echo "Please set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}Warning: DB_PASSWORD not set. Generating random password...${NC}"
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    echo -e "${GREEN}Generated DB Password: ${DB_PASSWORD}${NC}"
    echo -e "${YELLOW}IMPORTANT: Save this password! You'll need it for deployment.${NC}"
fi

# Set the project
echo -e "${GREEN}[1/9] Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"
echo ""

# Enable required APIs
echo -e "${GREEN}[2/9] Enabling required GCP APIs...${NC}"
gcloud services enable \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    storage.googleapis.com \
    run.googleapis.com \
    vpcaccess.googleapis.com \
    compute.googleapis.com \
    aiplatform.googleapis.com \
    speech.googleapis.com \
    translate.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com
echo ""

# Configure VPC for Private IP
echo -e "${GREEN}[2.5/9] Configuring VPC for Private Services...${NC}"
# Allocate IP range for Google services
if ! gcloud compute addresses describe google-managed-services-default --global &>/dev/null; then
    echo "Allocating IP range for private services..."
    gcloud compute addresses create google-managed-services-default \
        --global \
        --purpose=VPC_PEERING \
        --prefix-length=16 \
        --network=default

    echo "Creating VPC peering connection..."
    gcloud services vpc-peerings connect \
        --service=servicenetworking.googleapis.com \
        --ranges=google-managed-services-default \
        --network=default
else
    echo -e "${YELLOW}VPC peering already configured. Skipping...${NC}"
fi
echo ""

# Create Service Account
echo -e "${GREEN}[3/9] Creating Service Account...${NC}"
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
    echo -e "${YELLOW}Service account already exists. Skipping...${NC}"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Genova AI Backend Service Account" \
        --description="Service account for Genova AI Backend Cloud Run service"

    # Grant necessary permissions
    echo "Granting permissions to service account..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/cloudsql.client"

    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/storage.objectAdmin"

    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/aiplatform.user"

    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/cloudtranslate.user"
fi
echo ""

# Create Cloud SQL Instance
echo -e "${GREEN}[4/9] Creating Cloud SQL PostgreSQL instance...${NC}"
echo "This may take 5-10 minutes..."
if gcloud sql instances describe "$SQL_INSTANCE_NAME" &>/dev/null; then
    echo -e "${YELLOW}Cloud SQL instance already exists. Skipping...${NC}"
else
    gcloud sql instances create "$SQL_INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region="$REGION" \
        --storage-type=SSD \
        --storage-size=10GB \
        --network=default \
        --no-assign-ip \
        --backup-start-time=03:00 \
        --database-flags=max_connections=100 \
        --availability-type=zonal

    # Create database
    echo "Creating database..."
    gcloud sql databases create "$DB_NAME" \
        --instance="$SQL_INSTANCE_NAME"

    # Create user
    echo "Creating database user..."
    gcloud sql users create "$DB_USER" \
        --instance="$SQL_INSTANCE_NAME" \
        --password="$DB_PASSWORD"
fi
echo ""

# Create Redis Instance
echo -e "${GREEN}[5/9] Creating Cloud Memorystore Redis instance...${NC}"
echo "This may take 5-10 minutes..."
if gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region="$REGION" &>/dev/null; then
    echo -e "${YELLOW}Redis instance already exists. Skipping...${NC}"
else
    gcloud redis instances create "$REDIS_INSTANCE_NAME" \
        --size=1 \
        --region="$REGION" \
        --redis-version=redis_7_0 \
        --tier=basic \
        --network=default \
        --redis-config maxmemory-policy=allkeys-lru
fi
echo ""

# Create Cloud Storage Bucket
echo -e "${GREEN}[6/9] Creating Cloud Storage bucket...${NC}"
if gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    echo -e "${YELLOW}Bucket already exists. Skipping...${NC}"
else
    gcloud storage buckets create "gs://$BUCKET_NAME" \
        --location="$REGION" \
        --uniform-bucket-level-access \
        --public-access-prevention

    # Set lifecycle policy to delete files older than 90 days
    cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["uploaded_tmp/"]
        }
      }
    ]
  }
}
EOF
    gcloud storage buckets update "gs://$BUCKET_NAME" --lifecycle-file=/tmp/lifecycle.json
    rm /tmp/lifecycle.json
fi
echo ""

# Create VPC Connector
echo -e "${GREEN}[7/9] Creating VPC Connector for serverless access...${NC}"
if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR_NAME" --region="$REGION" &>/dev/null; then
    echo -e "${YELLOW}VPC Connector already exists. Skipping...${NC}"
else
    gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR_NAME" \
        --region="$REGION" \
        --network=default \
        --range=10.8.0.0/28 \
        --min-instances=2 \
        --max-instances=3 \
        --machine-type=f1-micro
fi
echo ""

# Get connection information
echo -e "${GREEN}[8/9] Retrieving connection information...${NC}"
SQL_CONNECTION_NAME=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" --format='value(connectionName)')
SQL_PRIVATE_IP=$(gcloud sql instances describe "$SQL_INSTANCE_NAME" --format='value(ipAddresses[0].ipAddress)')
REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region="$REGION" --format='value(host)')
REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region="$REGION" --format='value(port)')
echo ""

# Save configuration to file
echo -e "${GREEN}[9/9] Saving configuration to deployment/config/.env.production${NC}"
mkdir -p ../config
cat > ../config/.env.production <<EOF
# GCP Configuration
GCP_PROJECT_ID=$PROJECT_ID
GCP_REGION=$REGION

# Cloud SQL Configuration
SQL_INSTANCE_NAME=$SQL_INSTANCE_NAME
SQL_CONNECTION_NAME=$SQL_CONNECTION_NAME
SQL_PRIVATE_IP=$SQL_PRIVATE_IP
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_INSTANCE_NAME=$REDIS_INSTANCE_NAME
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT

# Cloud Storage
GCS_BUCKET_NAME=$BUCKET_NAME

# VPC Connector
VPC_CONNECTOR_NAME=$VPC_CONNECTOR_NAME

# Service Account
SERVICE_ACCOUNT_EMAIL=${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com
EOF
echo ""

# Display summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Resources Created Successfully!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Resource Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Cloud SQL:${NC}"
echo "  Instance Name: $SQL_INSTANCE_NAME"
echo "  Connection Name: $SQL_CONNECTION_NAME"
echo "  Private IP: $SQL_PRIVATE_IP"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo -e "${GREEN}Redis:${NC}"
echo "  Instance Name: $REDIS_INSTANCE_NAME"
echo "  Host: $REDIS_HOST"
echo "  Port: $REDIS_PORT"
echo ""
echo -e "${GREEN}Cloud Storage:${NC}"
echo "  Bucket Name: $BUCKET_NAME"
echo "  URL: gs://$BUCKET_NAME"
echo ""
echo -e "${GREEN}VPC Connector:${NC}"
echo "  Name: $VPC_CONNECTOR_NAME"
echo "  Network: default"
echo ""
echo -e "${GREEN}Service Account:${NC}"
echo "  Email: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Initialize database schema: cd ../sql && ./init-database.sh"
echo "2. Build and deploy application: cd ../scripts && ./2-deploy.sh"
echo ""
echo -e "${GREEN}Configuration saved to: deployment/config/.env.production${NC}"
echo -e "${YELLOW}IMPORTANT: Keep the .env.production file secure! It contains sensitive credentials.${NC}"
