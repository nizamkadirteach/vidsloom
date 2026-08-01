#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-business-heroes-infinity}"
REGION="${REGION:-asia-southeast1}"
TIME_ZONE="${TIME_ZONE:-Asia/Singapore}"
ENVIRONMENT="${ENVIRONMENT:-production}"
if [[ "${ENVIRONMENT}" != "production" && "${ENVIRONMENT}" != "staging" ]]; then
  echo "ENVIRONMENT must be production or staging." >&2
  exit 1
fi

if [[ -z "${DOMAIN:-}" ]]; then
  if [[ "${ENVIRONMENT}" == "production" ]]; then
    DOMAIN="vidsloom.com"
  else
    DOMAIN="staging.vidsloom.com"
  fi
fi

SERVICE_NAME="${SERVICE_NAME:-vidsloom-${ENVIRONMENT}}"
OPS_JOB_NAME="${OPS_JOB_NAME:-vidsloom-${ENVIRONMENT}-ops-alerts}"
if [[ -z "${OPS_SCHEDULE:-}" ]]; then
  if [[ "${ENVIRONMENT}" == "production" ]]; then
    OPS_SCHEDULE="*/15 * * * *"
  else
    OPS_SCHEDULE="*/30 * * * *"
  fi
fi
AUTOMATION_SECRET_NAME="${VIDSLOOM_AUTOMATION_SECRET_NAME:-vidsloom_automation_secret}"
NOTIFICATION_CHANNELS="${NOTIFICATION_CHANNELS:-}"

if [[ -z "${NOTIFICATION_CHANNELS}" ]]; then
  NOTIFICATION_CHANNELS="$(
    gcloud alpha monitoring channels list \
      --project="${PROJECT_ID}" \
      --format=json \
      | jq -r '[.[] | select((.enabled // true) == true and .type == "email")][0].name // ""'
  )"
fi

CHANNELS_JSON="$(
  printf '%s' "${NOTIFICATION_CHANNELS}" \
    | tr ',' '\n' \
    | jq -R -s 'split("\n") | map(select(length > 0))'
)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

write_policy() {
  local file="$1"
  local display_name="$2"
  local condition_json="$3"
  local documentation="$4"
  jq -n \
    --arg displayName "${display_name}" \
    --arg documentation "${documentation}" \
    --arg environment "${ENVIRONMENT}" \
    --argjson channels "${CHANNELS_JSON}" \
    --argjson condition "${condition_json}" \
    '{
      displayName: $displayName,
      enabled: true,
      combiner: "OR",
      notificationChannels: $channels,
      documentation: {content: $documentation, mimeType: "text/markdown"},
      userLabels: {app: "vidsloom", environment: $environment},
      conditions: [$condition]
    }' > "${file}"
}

upsert_policy() {
  local display_name="$1"
  local file="$2"
  local existing
  local -a matches
  matches=()
  while IFS= read -r policy_name; do
    [[ -n "${policy_name}" ]] && matches+=("${policy_name}")
  done < <(
    gcloud monitoring policies list \
      --project="${PROJECT_ID}" \
      --format=json \
      | jq -r --arg displayName "${display_name}" '.[] | select(.displayName == $displayName) | .name'
  )

  if (( ${#matches[@]} > 0 )); then
    existing="${matches[0]}"
    gcloud monitoring policies update "${existing}" \
      --project="${PROJECT_ID}" \
      --policy-from-file="${file}" \
      >/dev/null
    if (( ${#matches[@]} > 1 )); then
      for duplicate in "${matches[@]:1}"; do
        gcloud monitoring policies delete "${duplicate}" \
          --project="${PROJECT_ID}" \
          --quiet \
          >/dev/null
      done
    fi
  else
    gcloud monitoring policies create \
      --project="${PROJECT_ID}" \
      --policy-from-file="${file}" \
      >/dev/null
  fi
}

ensure_ops_scheduler() {
  local secret uri body
  secret="$(gcloud secrets versions access latest --secret="${AUTOMATION_SECRET_NAME}" --project="${PROJECT_ID}")"
  uri="https://${DOMAIN}/api/ops/alerts"
  body='{"notify":true,"minSeverity":"critical"}'

  if gcloud scheduler jobs describe "${OPS_JOB_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${OPS_JOB_NAME}" \
      --location="${REGION}" \
      --project="${PROJECT_ID}" \
      --schedule="${OPS_SCHEDULE}" \
      --time-zone="${TIME_ZONE}" \
      --uri="${uri}" \
      --http-method=POST \
      --update-headers="Content-Type=application/json,Authorization=Bearer ${secret}" \
      --message-body="${body}" \
      --attempt-deadline=180s \
      >/dev/null
  else
    gcloud scheduler jobs create http "${OPS_JOB_NAME}" \
      --location="${REGION}" \
      --project="${PROJECT_ID}" \
      --schedule="${OPS_SCHEDULE}" \
      --time-zone="${TIME_ZONE}" \
      --uri="${uri}" \
      --http-method=POST \
      --headers="Content-Type=application/json,Authorization=Bearer ${secret}" \
      --message-body="${body}" \
      --attempt-deadline=180s \
      >/dev/null
  fi
}

ensure_health_uptime() {
  local display_name check_name
  local -a matches
  display_name="VIDSLOOM ${ENVIRONMENT} health"
  matches=()
  while IFS= read -r uptime_name; do
    [[ -n "${uptime_name}" ]] && matches+=("${uptime_name}")
  done < <(
    gcloud monitoring uptime list-configs \
      --project="${PROJECT_ID}" \
      --format=json \
      | jq -r --arg displayName "${display_name}" '.[] | select(.displayName == $displayName) | .name'
  )

  if (( ${#matches[@]} > 0 )); then
    check_name="${matches[0]}"
    gcloud monitoring uptime update "${check_name}" \
      --project="${PROJECT_ID}" \
      --display-name="${display_name}" \
      --path="/api/health" \
      --request-method=get \
      --set-status-codes=200 \
      --matcher-type=matches-json-path \
      --json-path="$.ok" \
      --json-path-matcher-type=exact-match \
      --matcher-content="true" \
      --period=1 \
      --timeout=10 \
      --set-regions=asia-pacific,europe,usa-iowa \
      --validate-ssl=true \
      --update-user-labels=app=vidsloom,environment="${ENVIRONMENT}" \
      >/dev/null
    if (( ${#matches[@]} > 1 )); then
      for duplicate in "${matches[@]:1}"; do
        gcloud monitoring uptime delete "${duplicate}" \
          --project="${PROJECT_ID}" \
          --quiet \
          >/dev/null
      done
    fi
  else
    gcloud monitoring uptime create "${display_name}" \
      --project="${PROJECT_ID}" \
      --resource-type=uptime-url \
      --resource-labels="host=${DOMAIN},project_id=${PROJECT_ID}" \
      --protocol=https \
      --path="/api/health" \
      --request-method=get \
      --status-codes=200 \
      --matcher-type=matches-json-path \
      --json-path="$.ok" \
      --json-path-matcher-type=exact-match \
      --matcher-content="true" \
      --period=1 \
      --timeout=10 \
      --regions=asia-pacific,europe,usa-iowa \
      --validate-ssl=true \
      --user-labels=app=vidsloom,environment="${ENVIRONMENT}" \
      >/dev/null
  fi

  gcloud monitoring uptime list-configs \
    --project="${PROJECT_ID}" \
    --format=json \
    | jq -r --arg displayName "${display_name}" '[.[] | select(.displayName == $displayName)][0].name // ""'
}

ensure_ops_scheduler
HEALTH_CHECK_NAME="$(ensure_health_uptime)"
HEALTH_CHECK_ID="${HEALTH_CHECK_NAME##*/}"

health_condition="$(
  jq -n --arg checkId "${HEALTH_CHECK_ID}" '{
    displayName: "Health uptime failed",
    conditionThreshold: {
      filter: ("resource.type=\"uptime_url\" AND metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.\"check_id\"=\"" + $checkId + "\""),
      aggregations: [{
        alignmentPeriod: "300s",
        perSeriesAligner: "ALIGN_FRACTION_TRUE",
        crossSeriesReducer: "REDUCE_MIN",
        groupByFields: []
      }],
      comparison: "COMPARISON_LT",
      thresholdValue: 1,
      duration: "300s",
      trigger: {count: 1}
    }
  }'
)"
write_policy \
  "${TMP_DIR}/health-uptime.json" \
  "VIDSLOOM ${ENVIRONMENT} health uptime failed" \
  "${health_condition}" \
  "The public health endpoint at https://${DOMAIN}/api/health failed or stopped returning ok=true."
upsert_policy "VIDSLOOM ${ENVIRONMENT} health uptime failed" "${TMP_DIR}/health-uptime.json"

run_5xx_condition="$(
  jq -n --arg service "${SERVICE_NAME}" '{
    displayName: "Cloud Run 5xx responses",
    conditionThreshold: {
      filter: ("resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"" + $service + "\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code_class\"=\"5xx\""),
      aggregations: [{
        alignmentPeriod: "300s",
        perSeriesAligner: "ALIGN_DELTA",
        crossSeriesReducer: "REDUCE_SUM",
        groupByFields: []
      }],
      comparison: "COMPARISON_GT",
      thresholdValue: 0,
      duration: "0s",
      trigger: {count: 1}
    }
  }'
)"
write_policy \
  "${TMP_DIR}/cloud-run-5xx.json" \
  "VIDSLOOM ${ENVIRONMENT} Cloud Run 5xx" \
  "${run_5xx_condition}" \
  "Cloud Run returned one or more 5xx responses for the VIDSLOOM ${ENVIRONMENT} service."
upsert_policy "VIDSLOOM ${ENVIRONMENT} Cloud Run 5xx" "${TMP_DIR}/cloud-run-5xx.json"

run_latency_condition="$(
  jq -n --arg service "${SERVICE_NAME}" '{
    displayName: "Cloud Run p95 latency over 5s",
    conditionThreshold: {
      filter: ("resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"" + $service + "\" AND metric.type=\"run.googleapis.com/request_latencies\""),
      aggregations: [{
        alignmentPeriod: "300s",
        perSeriesAligner: "ALIGN_PERCENTILE_95",
        crossSeriesReducer: "REDUCE_MAX",
        groupByFields: []
      }],
      comparison: "COMPARISON_GT",
      thresholdValue: 5000,
      duration: "300s",
      trigger: {count: 1}
    }
  }'
)"
write_policy \
  "${TMP_DIR}/cloud-run-latency.json" \
  "VIDSLOOM ${ENVIRONMENT} Cloud Run latency" \
  "${run_latency_condition}" \
  "Cloud Run p95 latency exceeded 5 seconds for the VIDSLOOM ${ENVIRONMENT} service."
upsert_policy "VIDSLOOM ${ENVIRONMENT} Cloud Run latency" "${TMP_DIR}/cloud-run-latency.json"

tasks_failed_condition="$(
  jq -n --arg environment "${ENVIRONMENT}" '{
    displayName: "Cloud Tasks failed attempts",
    conditionThreshold: {
      filter: ("resource.type=\"cloud_tasks_queue\" AND resource.label.\"queue_id\"=monitoring.regex.full_match(\"vidsloom-(planning|render|publishing)-" + $environment + "\") AND metric.type=\"cloudtasks.googleapis.com/queue/task_attempt_count\" AND metric.label.\"response_code\"!=\"ok\""),
      aggregations: [{
        alignmentPeriod: "300s",
        perSeriesAligner: "ALIGN_DELTA",
        crossSeriesReducer: "REDUCE_SUM",
        groupByFields: []
      }],
      comparison: "COMPARISON_GT",
      thresholdValue: 0,
      duration: "0s",
      trigger: {count: 1}
    }
  }'
)"
write_policy \
  "${TMP_DIR}/tasks-failed.json" \
  "VIDSLOOM ${ENVIRONMENT} Cloud Tasks failed attempts" \
  "${tasks_failed_condition}" \
  "A VIDSLOOM ${ENVIRONMENT} Cloud Tasks queue reported failed worker attempts."
upsert_policy "VIDSLOOM ${ENVIRONMENT} Cloud Tasks failed attempts" "${TMP_DIR}/tasks-failed.json"

tasks_depth_condition="$(
  jq -n --arg environment "${ENVIRONMENT}" '{
    displayName: "Cloud Tasks queue depth high",
    conditionThreshold: {
      filter: ("resource.type=\"cloud_tasks_queue\" AND resource.label.\"queue_id\"=monitoring.regex.full_match(\"vidsloom-(planning|render|publishing)-" + $environment + "\") AND metric.type=\"cloudtasks.googleapis.com/queue/depth\""),
      aggregations: [{
        alignmentPeriod: "300s",
        perSeriesAligner: "ALIGN_MEAN",
        crossSeriesReducer: "REDUCE_MAX",
        groupByFields: []
      }],
      comparison: "COMPARISON_GT",
      thresholdValue: 25,
      duration: "900s",
      trigger: {count: 1}
    }
  }'
)"
write_policy \
  "${TMP_DIR}/tasks-depth.json" \
  "VIDSLOOM ${ENVIRONMENT} Cloud Tasks backlog" \
  "${tasks_depth_condition}" \
  "A VIDSLOOM ${ENVIRONMENT} Cloud Tasks queue had more than 25 pending tasks for 15 minutes."
upsert_policy "VIDSLOOM ${ENVIRONMENT} Cloud Tasks backlog" "${TMP_DIR}/tasks-depth.json"

gcloud scheduler jobs describe "${OPS_JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='table(name.basename(),schedule,timeZone,state,httpTarget.uri)'

gcloud monitoring uptime list-configs \
  --project="${PROJECT_ID}" \
  --filter="displayName:\"VIDSLOOM ${ENVIRONMENT}\"" \
  --format='table(displayName,monitoredResource.labels.host,httpCheck.path,period,timeout,name.basename())'

gcloud monitoring policies list \
  --project="${PROJECT_ID}" \
  --filter="displayName:\"VIDSLOOM ${ENVIRONMENT}\"" \
  --format='table(displayName,enabled,notificationChannels[0])'
