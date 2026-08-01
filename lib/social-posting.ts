import "server-only";

import { createId } from "@/lib/id";
import { decryptToken, encryptToken, tokenVaultConfigured } from "@/lib/token-vault";
import { buildCampaignVideoAssets } from "@/lib/video-assets";
import {
  Campaign,
  GeneratedVideoAsset,
  Platform,
  PublishingAttempt,
  PublishingMethod,
  PublishingTask,
  SocialConnection
} from "@/lib/schemas";
import {
  getCampaign,
  listSocialConnections,
  listPublishingAttempts,
  savePublishingAttempt,
  saveSocialConnection
} from "@/lib/storage";

type PublishingActor = "qa" | "customer" | "system";

export type PublishingMetricsSyncResult =
  | {
      ok: true;
      platform: Platform;
      externalPostId: string;
      externalUrl: string;
      privacyStatus: string;
      uploadStatus: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      clicks: number;
      capturedAt: string;
      note: string;
    }
  | {
      ok: false;
      platform: Platform;
      reconnectRequired: boolean;
      reason: string;
      capturedAt: string;
    };

const PLATFORM_MANUAL_STEPS: Record<Platform, string[]> = {
  TikTok: [
    "Open TikTok or TikTok Business Suite with the customer's authorized account.",
    "Upload the MP4, paste the approved caption and hashtags, then confirm privacy and commercial-content settings.",
    "Schedule or publish in the approved window, then record the post URL or screenshot in VIDSLOOM."
  ],
  "Instagram Reels": [
    "Open Meta Business Suite or Instagram with the approved professional account.",
    "Create a Reel with the MP4, cover frame, caption, hashtags, and CTA exactly as approved.",
    "Schedule or publish in the approved window, then capture the Reel URL and first metrics."
  ],
  "YouTube Shorts": [
    "Open YouTube Studio with the customer's authorized channel.",
    "Upload the vertical MP4 as a Short, paste the title/description, and set visibility according to the customer's rule.",
    "Publish or schedule, then record the Short URL and thumbnail proof."
  ],
  LinkedIn: [
    "Open the customer's LinkedIn member profile or Company Page with posting access.",
    "Upload the MP4, paste the approved commentary, and confirm the post is organic unless paid use was approved.",
    "Publish or schedule, then record the LinkedIn post URL and early engagement."
  ],
  X: [
    "Open the customer's X account or approved scheduler.",
    "Upload the MP4, adapt the caption to the account's character limit, and confirm links/hashtags.",
    "Publish or schedule, then record the post URL and first engagement."
  ],
  "Facebook Reels": [
    "Open Meta Business Suite with the customer's authorized Page.",
    "Create a Reel with the MP4, cover frame, caption, hashtags, and approved CTA.",
    "Schedule or publish in the approved window, then capture the post URL and metrics."
  ]
};

const PLATFORM_DIRECT_REQUIREMENTS: Record<Platform, string> = {
  TikTok: "TikTok Direct Post requires an audited app, customer OAuth, video.publish scope, creator-info consent, and a public video URL from an approved domain.",
  "Instagram Reels": "Instagram direct publishing requires a professional Instagram account connected through Meta OAuth with Instagram content publishing permission.",
  "YouTube Shorts": "YouTube upload requires customer OAuth with youtube.upload scope and uploads initially use the configured privacy setting.",
  LinkedIn: "LinkedIn video publishing requires approved Community Management access, customer OAuth, a member or organization author URN, and video upload permission.",
  X: "X direct video posting is not enabled in this build; use the manual posting kit until X API credentials and media upload access are configured.",
  "Facebook Reels": "Facebook Reels direct publishing is not enabled in this build; use Meta Business Suite manual posting until Page/Reels API access is configured."
};

export function publishingTaskKey(task: PublishingTask) {
  return `${task.platform}-${task.conceptTitle}-${task.day}-${task.publishWindow}`;
}

export function socialPostingStatus() {
  const tokenVaultReady = tokenVaultConfigured();
  return {
    tokenVaultConfigured: tokenVaultReady,
    directPlatforms: {
      TikTok: {
        implemented: true,
        enabled: tokenVaultReady && Boolean(process.env.VIDSLOOM_TIKTOK_CLIENT_KEY && process.env.VIDSLOOM_TIKTOK_CLIENT_SECRET),
        requirement: PLATFORM_DIRECT_REQUIREMENTS.TikTok
      },
      "Instagram Reels": {
        implemented: true,
        enabled: tokenVaultReady && Boolean(process.env.VIDSLOOM_META_APP_ID && process.env.VIDSLOOM_META_APP_SECRET),
        requirement: PLATFORM_DIRECT_REQUIREMENTS["Instagram Reels"]
      },
      "YouTube Shorts": {
        implemented: true,
        enabled: tokenVaultReady && Boolean(process.env.VIDSLOOM_YOUTUBE_CLIENT_ID && process.env.VIDSLOOM_YOUTUBE_CLIENT_SECRET),
        requirement: PLATFORM_DIRECT_REQUIREMENTS["YouTube Shorts"]
      },
      LinkedIn: {
        implemented: true,
        enabled: tokenVaultReady && Boolean(process.env.VIDSLOOM_LINKEDIN_CLIENT_ID && process.env.VIDSLOOM_LINKEDIN_CLIENT_SECRET),
        requirement: PLATFORM_DIRECT_REQUIREMENTS.LinkedIn
      },
      X: {
        implemented: false,
        enabled: false,
        requirement: PLATFORM_DIRECT_REQUIREMENTS.X
      },
      "Facebook Reels": {
        implemented: false,
        enabled: false,
        requirement: PLATFORM_DIRECT_REQUIREMENTS["Facebook Reels"]
      }
    }
  };
}

export async function listCampaignPublishingAttempts(campaignId: string, customerId = "") {
  return listPublishingAttempts({ campaignId, customerId, limit: 100 });
}

export async function executePublishingAction({
  campaignId,
  taskKey,
  method,
  origin,
  requestedBy,
  customerId = ""
}: {
  campaignId: string;
  taskKey: string;
  method: PublishingMethod;
  origin: string;
  requestedBy: PublishingActor;
  customerId?: string;
}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found.");
  if (customerId && campaign.customerId && campaign.customerId !== customerId) {
    throw new Error("Campaign does not belong to this customer.");
  }

  const task = campaign.pack.publishingQueue.find((item) => publishingTaskKey(item) === taskKey);
  if (!task) throw new Error("Publishing task not found.");

  const now = new Date().toISOString();
  const asset = matchingAsset(campaign, task);
  const baseAttempt = buildBaseAttempt({
    campaign,
    task,
    taskKey,
    method,
    status: method === "manual-assisted" ? "manual-kit-ready" : "blocked",
    requestedBy,
    origin,
    asset,
    now
  });

  const concept = campaign.pack.videoConcepts.find((item) => item.title === task.conceptTitle);
  if (concept?.qualityGate.status !== "pass") {
    const gate = concept?.qualityGate;
    return savePublishingAttempt({
      ...baseAttempt,
      status: "blocked",
      error: gate
        ? `Publishing blocked by quality gate: ${gate.status} (${gate.score}/${gate.minPublishScore}). ${gate.publishBlockers[0] || gate.nextActions[0] || "Resolve proof, claim, storyboard, and QA checks before publishing."}`
        : "Publishing blocked because the quality gate is missing for this concept."
    });
  }

  if (method === "manual-assisted") {
    return savePublishingAttempt(baseAttempt);
  }

  if (!tokenVaultConfigured()) {
    return savePublishingAttempt({
      ...baseAttempt,
      error: "Direct posting is blocked because token encryption is not configured on this deployment."
    });
  }

  if (!asset?.videoUrl) {
    return savePublishingAttempt({
      ...baseAttempt,
      error: "Direct posting is blocked because this task has no generated MP4 asset yet."
    });
  }

  const visualQaBlocker = visualQaPublishingBlocker(asset);
  if (visualQaBlocker) {
    return savePublishingAttempt({
      ...baseAttempt,
      error: visualQaBlocker
    });
  }

  const connection = await findUsableSocialConnection({
    customerId: campaign.customerId || customerId,
    platform: task.platform
  });
  if (!connection) {
    return savePublishingAttempt({
      ...baseAttempt,
      error: "Direct posting is blocked until the customer connects this social account through OAuth."
    });
  }

  if (task.platform === "X" || task.platform === "Facebook Reels") {
    return savePublishingAttempt({
      ...baseAttempt,
      connectionId: connection.id,
      error: PLATFORM_DIRECT_REQUIREMENTS[task.platform]
    });
  }

  const publishingAttempt = await savePublishingAttempt({
    ...baseAttempt,
    status: "publishing",
    connectionId: connection.id
  });

  try {
    const result = await publishDirect({
      campaign,
      task,
      asset,
      origin,
      connection
    });
    return savePublishingAttempt({
      ...publishingAttempt,
      status: result.status,
      externalPostId: result.externalPostId,
      externalUrl: result.externalUrl,
      providerResponse: result.providerResponse,
      error: "",
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return savePublishingAttempt({
      ...publishingAttempt,
      status: "failed",
      error: error instanceof Error ? error.message : "Direct posting failed.",
      updatedAt: new Date().toISOString()
    });
  }
}

export async function refreshPublishingAttemptMetrics({
  attempt,
  campaign
}: {
  attempt: PublishingAttempt;
  campaign: Campaign;
}): Promise<PublishingMetricsSyncResult> {
  const capturedAt = new Date().toISOString();
  if (attempt.platform !== "YouTube Shorts") {
    return {
      ok: false,
      platform: attempt.platform,
      reconnectRequired: false,
      reason: `${attempt.platform} metrics refresh is not implemented yet.`,
      capturedAt
    };
  }

  const externalPostId = attempt.externalPostId || youtubeVideoIdFromUrl(attempt.externalUrl);
  if (!externalPostId) {
    return {
      ok: false,
      platform: attempt.platform,
      reconnectRequired: false,
      reason: "YouTube metrics refresh needs a stored video id from the direct publishing attempt.",
      capturedAt
    };
  }

  const connection = await findUsableSocialConnection({
    customerId: attempt.customerId || campaign.customerId,
    platform: attempt.platform
  });
  if (!connection) {
    return {
      ok: false,
      platform: attempt.platform,
      reconnectRequired: true,
      reason: "Reconnect YouTube Shorts so VIDSLOOM can read post metrics after publishing.",
      capturedAt
    };
  }

  try {
    const refreshedConnection = await refreshConnectionIfNeeded(connection);
    const token = decryptToken(refreshedConnection.accessTokenEncrypted);
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
        part: "snippet,status,statistics",
        id: externalPostId
      })}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      const error = await responseError(response, "YouTube metrics refresh failed.");
      return {
        ok: false,
        platform: attempt.platform,
        reconnectRequired: /insufficient|permission|scope/i.test(error),
        reason: /insufficient|permission|scope/i.test(error)
          ? "Reconnect YouTube Shorts so VIDSLOOM can request post-metrics permission in addition to upload permission."
          : error,
        capturedAt
      };
    }

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const items = Array.isArray(json.items) ? (json.items as Array<Record<string, unknown>>) : [];
    const video = items[0];
    if (!video) {
      return {
        ok: false,
        platform: attempt.platform,
        reconnectRequired: false,
        reason: "YouTube did not return the uploaded video during metrics refresh.",
        capturedAt
      };
    }

    const statistics = (video.statistics ?? {}) as Record<string, unknown>;
    const status = (video.status ?? {}) as Record<string, unknown>;
    const privacyStatus = String(status.privacyStatus ?? attempt.providerResponse.privacyStatus ?? "");
    const uploadStatus = String(status.uploadStatus ?? attempt.providerResponse.uploadStatus ?? "");
    const views = safeMetric(statistics.viewCount);
    const likes = safeMetric(statistics.likeCount);
    const comments = safeMetric(statistics.commentCount);

    return {
      ok: true,
      platform: attempt.platform,
      externalPostId,
      externalUrl: attempt.externalUrl || `https://www.youtube.com/shorts/${externalPostId}`,
      privacyStatus,
      uploadStatus,
      views,
      likes,
      comments,
      shares: 0,
      saves: 0,
      clicks: 0,
      capturedAt,
      note: `YouTube metrics synced from the connected channel. Privacy: ${privacyStatus || "unknown"}. Upload status: ${uploadStatus || "unknown"}.`
    };
  } catch (error) {
    return {
      ok: false,
      platform: attempt.platform,
      reconnectRequired: false,
      reason: error instanceof Error ? error.message : "YouTube metrics refresh failed.",
      capturedAt
    };
  }
}

function buildBaseAttempt({
  campaign,
  task,
  taskKey,
  method,
  status,
  requestedBy,
  origin,
  asset,
  now
}: {
  campaign: Campaign;
  task: PublishingTask;
  taskKey: string;
  method: PublishingMethod;
  status: PublishingAttempt["status"];
  requestedBy: PublishingActor;
  origin: string;
  asset: GeneratedVideoAsset | null;
  now: string;
}): PublishingAttempt {
  const assetUrl = asset?.videoUrl ? absoluteUrl(origin, asset.videoUrl) : "";
  const posterUrl = asset?.posterUrl ? absoluteUrl(origin, asset.posterUrl) : "";
  const instructions =
    method === "manual-assisted"
      ? buildManualPostingInstructions(task, assetUrl)
      : [
          PLATFORM_DIRECT_REQUIREMENTS[task.platform],
          "VIDSLOOM will only publish after a valid customer OAuth connection and approved publishing rules are present.",
          "If the platform rejects the post or credentials are missing, use the manual posting kit immediately."
        ];

  return {
    id: createId("post_attempt"),
    campaignId: campaign.id,
    customerId: campaign.customerId,
    taskKey,
    platform: task.platform,
    conceptTitle: task.conceptTitle,
    method,
    status,
    requestedBy,
    connectionId: "",
    assetUrl,
    posterUrl,
    caption: `${task.caption}\n\n${task.hashtags.join(" ")}`.trim(),
    hashtags: task.hashtags,
    publishWindow: `${task.day} ${task.publishWindow}`.trim(),
    scheduledFor: "",
    instructions,
    checklist: [
      ...task.assetChecklist,
      ...task.approvalChecklist,
      "Record the final post URL, screenshot, and first metrics after publishing."
    ].slice(0, 30),
    externalPostId: "",
    externalUrl: "",
    providerResponse: {},
    error: "",
    createdAt: now,
    updatedAt: now
  };
}

function buildManualPostingInstructions(task: PublishingTask, assetUrl: string) {
  return [
    assetUrl ? `Download or open the approved MP4: ${assetUrl}` : "Wait for the approved MP4 asset before posting.",
    ...PLATFORM_MANUAL_STEPS[task.platform],
    `Use this posting window: ${task.day}, ${task.publishWindow}.`,
    "After publishing, paste the live post URL into the pilot proof notes or customer record."
  ];
}

function matchingAsset(campaign: Campaign, task: PublishingTask) {
  const assets = campaign.pack.videoAssets.length
    ? campaign.pack.videoAssets
    : buildCampaignVideoAssets({
        campaignId: campaign.id,
        intake: campaign.intake,
        pack: campaign.pack,
        createdAt: campaign.createdAt
      });

  return (
    assets.find(
      (asset) => asset.conceptTitle === task.conceptTitle && asset.platform === task.platform
    ) ??
    assets.find((asset) => asset.conceptTitle === task.conceptTitle) ??
    assets[0] ??
    null
  );
}

function visualQaPublishingBlocker(asset: GeneratedVideoAsset) {
  const publishableStatuses: GeneratedVideoAsset["status"][] = ["ready-for-approval", "approved", "final-ready"];
  if (!publishableStatuses.includes(asset.status)) {
    return `Direct posting is blocked because the selected video is ${asset.status}; render and approve a finished MP4 first.`;
  }

  if (asset.renderMode === "sample-fallback" || asset.renderMode === "queued-render") {
    return "Direct posting is blocked because the selected video is not a customer-specific finished render yet.";
  }

  if (asset.renderMode === "dynamic-render" || asset.renderMode === "ai-generated") {
    const qa = asset.aiMediaQa;
    if (!qa || qa.verdict !== "pass") {
      return `Direct posting is blocked until visual QA passes for this video. Current QA: ${qa?.verdict || "not-run"}.`;
    }
    if (qa.textOrLogoLeak) {
      return "Direct posting is blocked because visual QA detected possible text, logo, or watermark leakage.";
    }
    if (qa.artifactRisk >= 35) {
      return `Direct posting is blocked because visual QA artifact risk is too high (${qa.artifactRisk}/100).`;
    }
  }

  return "";
}

function absoluteUrl(origin: string, url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, origin).toString();
}

function youtubeVideoIdFromUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").trim();
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] ?? "";
    if (url.searchParams.get("v")) return url.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
  return "";
}

function safeMetric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

async function publishDirect({
  campaign,
  task,
  asset,
  origin,
  connection
}: {
  campaign: Campaign;
  task: PublishingTask;
  asset: GeneratedVideoAsset;
  origin: string;
  connection: SocialConnection;
}): Promise<Pick<PublishingAttempt, "status" | "externalPostId" | "externalUrl" | "providerResponse">> {
  const refreshedConnection = await refreshConnectionIfNeeded(connection);
  const token = decryptToken(refreshedConnection.accessTokenEncrypted);
  const assetUrl = absoluteUrl(origin, asset.videoUrl);
  const caption = `${task.caption}\n\n${task.hashtags.join(" ")}`.trim();

  if (task.platform === "TikTok") {
    return publishToTikTok({ token, assetUrl, caption, connection: refreshedConnection });
  }
  if (task.platform === "Instagram Reels") {
    return publishToInstagram({ token, assetUrl, caption, connection: refreshedConnection });
  }
  if (task.platform === "YouTube Shorts") {
    return publishToYouTube({ token, assetUrl, caption, title: task.conceptTitle, campaign });
  }
  if (task.platform === "LinkedIn") {
    return publishToLinkedIn({ token, assetUrl, caption, title: task.conceptTitle, connection: refreshedConnection });
  }

  throw new Error(PLATFORM_DIRECT_REQUIREMENTS[task.platform]);
}

async function findUsableSocialConnection({
  customerId,
  platform
}: {
  customerId: string;
  platform: Platform;
}) {
  const connections = await listSocialConnections({ customerId, platform });
  return (
    connections.find((connection) => {
      if (connection.status !== "connected" || !connection.accessTokenEncrypted) return false;
      if (!expiresSoon(connection)) return true;
      return platform === "YouTube Shorts" && Boolean(connection.refreshTokenEncrypted);
    }) ?? null
  );
}

async function refreshConnectionIfNeeded(connection: SocialConnection) {
  if (!expiresSoon(connection)) return connection;
  if (connection.platform !== "YouTube Shorts" || !connection.refreshTokenEncrypted) return connection;

  const token = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("VIDSLOOM_YOUTUBE_CLIENT_ID"),
      client_secret: requiredEnv("VIDSLOOM_YOUTUBE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refreshTokenEncrypted)
    })
  });
  const accessToken = String(token.access_token ?? "");
  if (!accessToken) throw new Error("YouTube token refresh did not return an access token.");

  const now = new Date().toISOString();
  const expiresIn = Number(token.expires_in ?? 0);
  return saveSocialConnection({
    ...connection,
    accessTokenEncrypted: encryptToken(accessToken),
    refreshTokenEncrypted: token.refresh_token
      ? encryptToken(String(token.refresh_token))
      : connection.refreshTokenEncrypted,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : "",
    updatedAt: now,
    lastValidatedAt: now,
    metadata: {
      ...connection.metadata,
      tokenRefreshedAt: now
    }
  });
}

function expiresSoon(connection: SocialConnection) {
  if (!connection.expiresAt) return false;
  const expiresAt = Date.parse(connection.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60_000;
}

async function publishToTikTok({
  token,
  assetUrl,
  caption,
  connection
}: {
  token: string;
  assetUrl: string;
  caption: string;
  connection: SocialConnection;
}) {
  const privacyLevel = connection.metadata.privacyLevel || process.env.VIDSLOOM_TIKTOK_DEFAULT_PRIVACY || "SELF_ONLY";
  const response = await fetchJson("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: assetUrl
      }
    })
  });
  const publishId = stringFromPath(response, ["data", "publish_id"]);
  return {
    status: "queued" as const,
    externalPostId: publishId,
    externalUrl: "",
    providerResponse: compactProviderResponse(response)
  };
}

async function publishToInstagram({
  token,
  assetUrl,
  caption,
  connection
}: {
  token: string;
  assetUrl: string;
  caption: string;
  connection: SocialConnection;
}) {
  const accountId = connection.accountId || connection.metadata.igUserId;
  if (!accountId) throw new Error("Instagram account id is missing from the social connection.");

  const version = process.env.VIDSLOOM_META_GRAPH_VERSION || "v20.0";
  const createBody = new URLSearchParams({
    media_type: "REELS",
    video_url: assetUrl,
    caption: caption.slice(0, 2200),
    access_token: token
  });
  const container = await fetchJson(`https://graph.facebook.com/${version}/${accountId}/media`, {
    method: "POST",
    body: createBody
  });
  const creationId = stringFromPath(container, ["id"]);
  if (!creationId) throw new Error("Instagram did not return a media container id.");

  try {
    const published = await fetchJson(`https://graph.facebook.com/${version}/${accountId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: token
      })
    });
    const postId = stringFromPath(published, ["id"]);
    return {
      status: "published" as const,
      externalPostId: postId || creationId,
      externalUrl: postId ? `https://www.instagram.com/reel/${postId}/` : "",
      providerResponse: compactProviderResponse({ container, published })
    };
  } catch (error) {
    return {
      status: "queued" as const,
      externalPostId: creationId,
      externalUrl: "",
      providerResponse: {
        ...compactProviderResponse(container),
        publishNote: error instanceof Error ? error.message.slice(0, 240) : "Container created; publish polling required."
      }
    };
  }
}

async function publishToYouTube({
  token,
  assetUrl,
  caption,
  title,
  campaign
}: {
  token: string;
  assetUrl: string;
  caption: string;
  title: string;
  campaign: Campaign;
}) {
  const video = await fetchAsset(assetUrl);
  const privacyStatus = process.env.VIDSLOOM_YOUTUBE_PRIVACY_STATUS || "private";
  const initResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(video.byteLength)
    },
    body: JSON.stringify({
      snippet: {
        title: title.slice(0, 100),
        description: caption.slice(0, 5000),
        tags: ["shorts", campaign.intake.industry, campaign.intake.businessName].filter(Boolean).slice(0, 10),
        categoryId: "22"
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false
      }
    })
  });
  if (!initResponse.ok) throw new Error(await responseError(initResponse, "YouTube upload initialization failed."));
  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return a resumable upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(video.byteLength)
    },
    body: video
  });
  if (!uploadResponse.ok) throw new Error(await responseError(uploadResponse, "YouTube upload failed."));
  const json = (await uploadResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const videoId = stringFromPath(json, ["id"]);
  return {
    status: "published" as const,
    externalPostId: videoId,
    externalUrl: videoId ? `https://www.youtube.com/shorts/${videoId}` : "",
    providerResponse: {
      privacyStatus: stringFromPath(json, ["status", "privacyStatus"]),
      uploadStatus: stringFromPath(json, ["status", "uploadStatus"]),
      embeddable: String(Boolean((json.status as Record<string, unknown> | undefined)?.embeddable)),
      ...compactProviderResponse(json)
    }
  };
}

async function publishToLinkedIn({
  token,
  assetUrl,
  caption,
  title,
  connection
}: {
  token: string;
  assetUrl: string;
  caption: string;
  title: string;
  connection: SocialConnection;
}) {
  const author = connection.metadata.authorUrn || connection.accountId;
  if (!author.startsWith("urn:li:")) throw new Error("LinkedIn author URN is missing from the social connection.");

  const video = await fetchAsset(assetUrl);
  const version = process.env.VIDSLOOM_LINKEDIN_VERSION || "202605";
  const init = await fetchJson("https://api.linkedin.com/rest/videos?action=initializeUpload", {
    method: "POST",
    headers: linkedInHeaders(token, version),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author,
        fileSizeBytes: video.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false
      }
    })
  });
  const uploadValue = (init.value ?? {}) as Record<string, unknown>;
  const videoUrn = String(uploadValue.video ?? "");
  const uploadInstructions = Array.isArray(uploadValue.uploadInstructions) ? uploadValue.uploadInstructions : [];
  if (!videoUrn || !uploadInstructions.length) throw new Error("LinkedIn did not return video upload instructions.");

  const uploadedPartIds: string[] = [];
  for (const instruction of uploadInstructions as Array<Record<string, unknown>>) {
    const uploadUrl = String(instruction.uploadUrl ?? "");
    if (!uploadUrl) continue;
    const firstByte = Number(instruction.firstByte ?? 0);
    const lastByte = Number(instruction.lastByte ?? video.byteLength - 1);
    const chunk = video.subarray(firstByte, lastByte + 1);
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: chunk
    });
    if (!uploadResponse.ok) throw new Error(await responseError(uploadResponse, "LinkedIn video chunk upload failed."));
    const etag = uploadResponse.headers.get("etag")?.replaceAll('"', "") ?? "";
    if (etag) uploadedPartIds.push(etag);
  }

  await fetchJson("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST",
    headers: linkedInHeaders(token, version),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: String(uploadValue.uploadToken ?? ""),
        uploadedPartIds
      }
    })
  });

  const post = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: linkedInHeaders(token, version),
    body: JSON.stringify({
      author,
      commentary: caption.slice(0, 3000),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      content: {
        media: {
          title: title.slice(0, 200),
          id: videoUrn
        }
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    })
  });
  if (!post.ok) throw new Error(await responseError(post, "LinkedIn post creation failed."));
  const postId = post.headers.get("x-restli-id") ?? "";
  return {
    status: "published" as const,
    externalPostId: postId || videoUrn,
    externalUrl: postId ? `https://www.linkedin.com/feed/update/${postId}/` : "",
    providerResponse: {
      videoUrn,
      postId
    }
  };
}

function linkedInHeaders(token: string, version: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Linkedin-Version": version,
    "X-Restli-Protocol-Version": "2.0.0"
  };
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await responseError(response, `Request failed for ${url}`));
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function fetchAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await responseError(response, "Unable to download generated video asset."));
  return Buffer.from(await response.arrayBuffer());
}

async function responseError(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  return `${fallback} (${response.status}): ${text.slice(0, 700)}`;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function stringFromPath(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}

function compactProviderResponse(value: unknown) {
  const entries = flatten(value).slice(0, 20);
  return Object.fromEntries(entries.map(([key, item]) => [key, String(item).slice(0, 240)]));
}

function flatten(value: unknown, prefix = ""): Array<[string, string | number | boolean]> {
  if (!value || typeof value !== "object") return [];
  const output: Array<[string, string | number | boolean]> = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      output.push([path, item]);
    } else if (item && typeof item === "object" && output.length < 20) {
      output.push(...flatten(item, path));
    }
  }
  return output;
}
