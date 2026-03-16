#!/usr/bin/env bash
# deploy.sh — Deploy Recykle to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Example: ./deploy.sh my-gcp-project us-central1

set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-us-central1}"
SERVICE_NAME="recykle-app"
AR_REPO="recykle"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}"
GEMINI_MODEL="gemini-live-2.5-flash-native-audio"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No GCP project ID provided and none set in gcloud config."
  echo "Usage: ./deploy.sh YOUR_PROJECT_ID [REGION]"
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Error: GEMINI_API_KEY environment variable is not set."
  echo "Export it before running: export GEMINI_API_KEY=your_key_here"
  exit 1
fi

echo "Deploying Recykle to Google Cloud Run"
echo "  Project: ${PROJECT_ID}"
echo "  Region:  ${REGION}"
echo "  Image:   ${IMAGE_NAME}"
echo "  Model:   ${GEMINI_MODEL}"
echo ""

# Enable required Google Cloud APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  --project "${PROJECT_ID}"
echo "  APIs enabled."
echo ""

# Create Artifact Registry repository if it does not exist
echo "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "${AR_REPO}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" &>/dev/null; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Recykle container images" \
    --project="${PROJECT_ID}"
  echo "  Repository created: ${AR_REPO}"
else
  echo "  Repository already exists."
fi
echo ""

# Configure Docker authentication for Artifact Registry
echo "Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
echo ""

# Build and push container image via Cloud Build
echo "Building and pushing container image..."
gcloud builds submit \
  --tag "${IMAGE_NAME}" \
  --project "${PROJECT_ID}"
echo ""

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars "GEMINI_MODEL=${GEMINI_MODEL}" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --project "${PROJECT_ID}"

echo ""
echo "Deployment complete!"
echo "Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)"
