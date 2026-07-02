#!/bin/bash

# Exit on error
set -e

# FarmAssist AI GCP Cloud Run Deployment Script
# Make sure you are logged in to your GCP account via 'gcloud auth login'
# and have set the correct project.

echo "========================================="
echo "   FarmAssist AI - GCP Deployment Tool   "
echo "========================================="

# 1. Ask or set GCP Project ID
if [ -z "$GCP_PROJECT_ID" ]; then
    read -p "Enter your GCP Project ID: " GCP_PROJECT_ID
fi

if [ -z "$GEMINI_API_KEY" ]; then
    read -sp "Enter your GEMINI_API_KEY (press Enter when done): " GEMINI_API_KEY
    echo ""
fi

# Set active project
gcloud config set project "$GCP_PROJECT_ID"

# 2. Enable necessary APIs
echo "Enabling GCP APIs (Artifact Registry, Cloud Build, Cloud Run)..."
gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com

# 3. Create Artifact Registry repository if it doesn't exist
REPO_NAME="farmassist-repo"
REGION="us-central1"

echo "Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION >/dev/null 2>&1; then
    echo "Creating repository $REPO_NAME in $REGION..."
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="FarmAssist AI Docker repository"
fi

# 4. Build and push image using Cloud Build
IMAGE_TAG="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO_NAME/farmassist-app:latest"
echo "Building and pushing docker image using Google Cloud Build..."
gcloud builds submit --tag "$IMAGE_TAG" .

# 5. Deploy to Google Cloud Run
echo "Deploying to Google Cloud Run..."
gcloud run deploy farmassist-app \
    --image="$IMAGE_TAG" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated \
    --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY"

echo "========================================="
echo "Deployment Complete!"
echo "Your app is live at the Cloud Run URL above."
echo "========================================="
