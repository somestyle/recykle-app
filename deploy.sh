#!/usr/bin/env bash
# deploy.sh — Deploy Recykle to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Example: ./deploy.sh my-gcp-project us-central1

set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-us-central1}"
SERVICE_NAME="recykle-app"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No GCP project ID provided and none set in gcloud config."
  echo "   Usage: ./deploy.sh YOUR_PROJECT_ID [REGION]"
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "❌ Error: GEMINI_API_KEY environment variable is not set."
  echo "   Export it before running: export GEMINI_API_KEY=your_key_here"
  exit 1
fi

echo "🌍 Deploying Recykle to Google Cloud Run"
echo "   Project:  ${PROJECT_ID}"
echo "   Region:   ${REGION}"
echo "   Image:    ${IMAGE_NAME}"
echo ""

# Build and push Docker image
echo "📦 Building Docker image..."
gcloud builds submit \
  --tag "${IMAGE_NAME}" \
  --project "${PROJECT_ID}"

echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash-native-audio-latest" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --project "${PROJECT_ID}"

echo ""
echo "✅ Deployment complete!"
echo "   Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)"
