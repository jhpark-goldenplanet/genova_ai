#!/bin/bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-genova-ai-project}"
TRIGGER_REGION="${TRIGGER_REGION:-global}"
REPO_OWNER="${REPO_OWNER:-GP-SoftwareDivision}"
REPO_NAME="${REPO_NAME:-genova_ai}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-}"

trigger_id_by_name() {
  local name="$1"
  gcloud builds triggers list \
    --project="$PROJECT_ID" \
    --region="$TRIGGER_REGION" \
    --filter="name=$name" \
    --format='value(id)'
}

upsert_github_trigger() {
  local name="$1"
  local description="$2"
  local branch_pattern="$3"
  local build_config="$4"
  local included_files="$5"

  local existing_id
  existing_id="$(trigger_id_by_name "$name")"

  local common_args=(
    "--project=$PROJECT_ID"
    "--region=$TRIGGER_REGION"
    "--repo-owner=$REPO_OWNER"
    "--repo-name=$REPO_NAME"
    "--branch-pattern=$branch_pattern"
    "--build-config=$build_config"
    "--description=$description"
    "--included-files=$included_files"
  )

  if [ -n "$SERVICE_ACCOUNT" ]; then
    common_args+=("--service-account=$SERVICE_ACCOUNT")
  fi

  if [ -n "$existing_id" ]; then
    echo "[update] $name"
    gcloud builds triggers update github "$existing_id" "${common_args[@]}"
  else
    echo "[create] $name"
    gcloud builds triggers create github --name="$name" "${common_args[@]}"
  fi
}

echo "[info] project=$PROJECT_ID region=$TRIGGER_REGION repo=$REPO_OWNER/$REPO_NAME"

upsert_github_trigger \
  "genova-frontend-main" \
  "Deploy frontend production service on pushes to main" \
  "^main$" \
  "frontend/cloudbuild.yaml" \
  "frontend/**"

upsert_github_trigger \
  "genova-frontend-develop" \
  "Deploy frontend develop service on pushes to develop" \
  "^develop$" \
  "frontend/cloudbuild-develop-service.yaml" \
  "frontend/**"

upsert_github_trigger \
  "genova-backend-main" \
  "Deploy backend production service on pushes to main" \
  "^main$" \
  "backend/cloudbuild.yaml" \
  "backend/**"

upsert_github_trigger \
  "genova-backend-develop" \
  "Deploy backend develop service on pushes to develop" \
  "^develop$" \
  "backend/cloudbuild-develop-service.yaml" \
  "backend/**"

echo "[done] branch deployment triggers are configured"
