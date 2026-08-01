#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-production}"
PROJECT_ID="${PROJECT_ID:-business-heroes-infinity}"
REGION="${REGION:-asia-southeast1}"
TIME_ZONE="${TIME_ZONE:-Asia/Singapore}"
SCHEDULE="${SCHEDULE:-}"
SERVICE_URL="${SERVICE_URL:-https://vidsloom.com}"
AUTOMATION_SECRET_NAME="${VIDSLOOM_AUTOMATION_SECRET_NAME:-vidsloom_automation_secret}"
JOB_NAME="vidsloom-${ENVIRONMENT}-publishing-sweep"

if [[ "${ENVIRONMENT}" != "staging" && "${ENVIRONMENT}" != "production" ]]; then
  echo "Usage: scripts/configure-publishing-scheduler.sh [staging|production]" >&2
  exit 1
fi

if [[ "${ENVIRONMENT}" == "staging" && "${SERVICE_URL}" == "https://vidsloom.com" ]]; then
  SERVICE_URL="${STAGING_SERVICE_URL:-https://staging.vidsloom.com}"
fi

if [[ -z "${SCHEDULE}" ]]; then
  if [[ "${ENVIRONMENT}" == "staging" ]]; then
    SCHEDULE="*/30 * * * *"
  else
    SCHEDULE="*/15 * * * *"
  fi
fi

SECRET="$(gcloud secrets versions access latest --secret="${AUTOMATION_SECRET_NAME}" --project="${PROJECT_ID}")"
URI="${SERVICE_URL%/}/api/publishing/jobs"
BODY="${BODY:-}"
if [[ -z "${BODY}" ]]; then
  if [[ "${ENVIRONMENT}" == "staging" ]]; then
    BODY='{"limit":50,"dryRun":true}'
  else
    BODY='{"limit":50}'
  fi
fi

if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${URI}" \
    --http-method=POST \
    --update-headers="Content-Type=application/json,Authorization=Bearer ${SECRET}" \
    --message-body="${BODY}" \
    --attempt-deadline=180s \
    >/dev/null
else
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${URI}" \
    --http-method=POST \
    --headers="Content-Type=application/json,Authorization=Bearer ${SECRET}" \
    --message-body="${BODY}" \
    --attempt-deadline=180s \
    >/dev/null
fi

gcloud scheduler jobs describe "${JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="table(name.basename(),schedule,timeZone,state,httpTarget.uri)"
