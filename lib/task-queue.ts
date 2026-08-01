import "server-only";

export type TaskEnqueueResult = {
  queued: boolean;
  mode: "cloud-tasks" | "manual";
  taskName?: string;
  scheduleTime?: string;
  reason?: string;
};

export function queueStatus({
  queueName,
  location,
  workerUrl
}: {
  queueName: string;
  location: string;
  workerUrl?: string;
}) {
  return {
    configured: Boolean(queueName && automationSecret()),
    queueName,
    location,
    workerUrlConfigured: Boolean(workerUrl),
    hasAutomationSecret: Boolean(automationSecret())
  };
}

export async function enqueueHttpTask({
  queueName,
  location,
  url,
  body,
  scheduleTime,
  dispatchDeadlineSeconds,
  unavailableReason = "Cloud Tasks queue or automation secret is not configured."
}: {
  queueName: string;
  location: string;
  url: string;
  body: Record<string, unknown>;
  scheduleTime?: string;
  dispatchDeadlineSeconds?: number;
  unavailableReason?: string;
}): Promise<TaskEnqueueResult> {
  const secret = automationSecret();

  if (!queueName || !secret) {
    return {
      queued: false,
      mode: "manual",
      reason: unavailableReason
    };
  }

  const task = await createCloudTask({
    projectId: cloudProjectId(),
    location,
    queueName,
    url,
    secret,
    body,
    scheduleTime,
    dispatchDeadlineSeconds
  });

  return {
    queued: true,
    mode: "cloud-tasks",
    taskName: task.name ?? "",
    scheduleTime
  };
}

export function defaultQueueLocation() {
  return (process.env.VIDSLOOM_QUEUE_LOCATION || process.env.REGION || "asia-southeast1").trim();
}

function cloudProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    "business-heroes-infinity"
  ).trim();
}

function automationSecret() {
  return process.env.VIDSLOOM_AUTOMATION_SECRET?.trim() ?? "";
}

async function createCloudTask({
  projectId,
  location,
  queueName,
  url,
  secret,
  body,
  scheduleTime,
  dispatchDeadlineSeconds
}: {
  projectId: string;
  location: string;
  queueName: string;
  url: string;
  secret: string;
  body: Record<string, unknown>;
  scheduleTime?: string;
  dispatchDeadlineSeconds?: number;
}) {
  const accessToken = await cloudAccessToken();
  const endpoint = `https://cloudtasks.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/queues/${encodeURIComponent(queueName)}/tasks`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      task: {
        ...(scheduleTime ? { scheduleTime } : {}),
        ...(dispatchDeadlineSeconds ? { dispatchDeadline: `${dispatchDeadlineSeconds}s` } : {}),
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`
          },
          body: Buffer.from(JSON.stringify(body)).toString("base64")
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Cloud Tasks enqueue failed (${response.status}): ${truncate(text, 260)}`);
  }

  return (await response.json()) as { name?: string };
}

async function cloudAccessToken() {
  const explicit = process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
  if (explicit) return explicit;

  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: {
        "Metadata-Flavor": "Google"
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    throw new Error(`Metadata token request failed (${response.status}).`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Metadata token response did not include an access token.");
  }
  return data.access_token;
}

function truncate(input: string, max: number) {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}
