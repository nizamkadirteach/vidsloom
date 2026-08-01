import "server-only";

import crypto from "node:crypto";

import { createId } from "@/lib/id";
import { encryptToken, tokenVaultConfigured } from "@/lib/token-vault";
import { Platform, SocialConnection, SocialConnectionSchema } from "@/lib/schemas";
import { saveSocialConnection } from "@/lib/storage";

type OAuthState = {
  customerId: string;
  platform: Platform;
  returnTo: string;
  exp: number;
};

const scopes: Record<Platform, string[]> = {
  TikTok: ["user.info.basic", "video.publish", "video.upload"],
  "Instagram Reels": ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
  "YouTube Shorts": ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
  LinkedIn: ["openid", "profile", "w_member_social"],
  X: [],
  "Facebook Reels": ["pages_show_list", "pages_read_engagement", "pages_manage_posts"]
};

export function oauthProviderStatus() {
  return {
    tokenVaultConfigured: tokenVaultConfigured(),
    providers: {
      TikTok: Boolean(process.env.VIDSLOOM_TIKTOK_CLIENT_KEY && process.env.VIDSLOOM_TIKTOK_CLIENT_SECRET),
      "Instagram Reels": Boolean(process.env.VIDSLOOM_META_APP_ID && process.env.VIDSLOOM_META_APP_SECRET),
      "YouTube Shorts": Boolean(process.env.VIDSLOOM_YOUTUBE_CLIENT_ID && process.env.VIDSLOOM_YOUTUBE_CLIENT_SECRET),
      LinkedIn: Boolean(process.env.VIDSLOOM_LINKEDIN_CLIENT_ID && process.env.VIDSLOOM_LINKEDIN_CLIENT_SECRET),
      X: false,
      "Facebook Reels": Boolean(process.env.VIDSLOOM_META_APP_ID && process.env.VIDSLOOM_META_APP_SECRET)
    }
  };
}

export function buildOAuthAuthorizationUrl({
  platform,
  customerId,
  origin,
  returnTo
}: {
  platform: Platform;
  customerId: string;
  origin: string;
  returnTo: string;
}) {
  ensureOAuthReady(platform);
  const redirectUri = callbackUrl(origin, platform);
  const state = signState({
    customerId,
    platform,
    returnTo: safeReturnTo(returnTo),
    exp: Math.floor(Date.now() / 1000) + 15 * 60
  });

  if (platform === "YouTube Shorts") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", requiredEnv("VIDSLOOM_YOUTUBE_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes[platform].join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (platform === "LinkedIn") {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("client_id", requiredEnv("VIDSLOOM_LINKEDIN_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes[platform].join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (platform === "TikTok") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", requiredEnv("VIDSLOOM_TIKTOK_CLIENT_KEY"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes[platform].join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (platform === "Instagram Reels" || platform === "Facebook Reels") {
    const version = process.env.VIDSLOOM_META_GRAPH_VERSION || "v20.0";
    const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
    url.searchParams.set("client_id", requiredEnv("VIDSLOOM_META_APP_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes[platform].join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }

  throw new Error(`${platform} OAuth is not enabled yet.`);
}

export async function completeOAuthCallback({
  platform,
  code,
  state,
  origin
}: {
  platform: Platform;
  code: string;
  state: string;
  origin: string;
}) {
  ensureOAuthReady(platform);
  const parsedState = verifyState(state);
  if (parsedState.platform !== platform) throw new Error("OAuth platform mismatch.");
  if (parsedState.exp < Math.floor(Date.now() / 1000)) throw new Error("OAuth state expired.");

  let connection: SocialConnection;
  if (platform === "YouTube Shorts") {
    connection = await saveYouTubeConnection({ code, origin, state: parsedState });
  } else if (platform === "LinkedIn") {
    connection = await saveLinkedInConnection({ code, origin, state: parsedState });
  } else if (platform === "TikTok") {
    connection = await saveTikTokConnection({ code, origin, state: parsedState });
  } else if (platform === "Instagram Reels" || platform === "Facebook Reels") {
    connection = await saveMetaConnection({ code, origin, state: parsedState, platform });
  } else {
    throw new Error(`${platform} OAuth callback is not enabled yet.`);
  }

  return {
    connection,
    returnTo: parsedState.returnTo
  };
}

function ensureOAuthReady(platform: Platform) {
  if (!tokenVaultConfigured()) throw new Error("Token encryption must be configured before social OAuth can be used.");
  if (!oauthProviderStatus().providers[platform]) throw new Error(`${platform} OAuth credentials are not configured.`);
}

async function saveYouTubeConnection({ code, origin, state }: { code: string; origin: string; state: OAuthState }) {
  const token = await fetchToken("https://oauth2.googleapis.com/token", {
    client_id: requiredEnv("VIDSLOOM_YOUTUBE_CLIENT_ID"),
    client_secret: requiredEnv("VIDSLOOM_YOUTUBE_CLIENT_SECRET"),
    redirect_uri: callbackUrl(origin, "YouTube Shorts"),
    grant_type: "authorization_code",
    code
  });
  const accessToken = String(token.access_token ?? "");
  const channel = await fetchJsonOptional("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const first = Array.isArray(channel.items) ? (channel.items[0] as Record<string, unknown> | undefined) : undefined;
  const snippet = (first?.snippet ?? {}) as Record<string, unknown>;
  return saveConnection({
    state,
    platform: "YouTube Shorts",
    accessToken,
    refreshToken: String(token.refresh_token ?? ""),
    expiresIn: Number(token.expires_in ?? 0),
    accountId: String(first?.id ?? ""),
    accountName: String(snippet.title ?? "Connected YouTube channel"),
    handle: String(snippet.customUrl ?? snippet.title ?? "YouTube Shorts"),
    metadata: {
      channelLookupStatus: first ? "resolved" : "upload-scope-only"
    }
  });
}

async function saveLinkedInConnection({ code, origin, state }: { code: string; origin: string; state: OAuthState }) {
  const token = await fetchToken("https://www.linkedin.com/oauth/v2/accessToken", {
    client_id: requiredEnv("VIDSLOOM_LINKEDIN_CLIENT_ID"),
    client_secret: requiredEnv("VIDSLOOM_LINKEDIN_CLIENT_SECRET"),
    redirect_uri: callbackUrl(origin, "LinkedIn"),
    grant_type: "authorization_code",
    code
  });
  const accessToken = String(token.access_token ?? "");
  const profile = await fetchJson("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const sub = String(profile.sub ?? "");
  const authorUrn = sub ? `urn:li:person:${sub}` : "";
  return saveConnection({
    state,
    platform: "LinkedIn",
    accessToken,
    refreshToken: String(token.refresh_token ?? ""),
    expiresIn: Number(token.expires_in ?? 0),
    accountId: authorUrn,
    accountName: String(profile.name ?? ""),
    handle: String(profile.name ?? ""),
    metadata: { authorUrn }
  });
}

async function saveTikTokConnection({ code, origin, state }: { code: string; origin: string; state: OAuthState }) {
  const token = await fetchToken("https://open.tiktokapis.com/v2/oauth/token/", {
    client_key: requiredEnv("VIDSLOOM_TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("VIDSLOOM_TIKTOK_CLIENT_SECRET"),
    redirect_uri: callbackUrl(origin, "TikTok"),
    grant_type: "authorization_code",
    code
  });
  const accessToken = String(token.access_token ?? "");
  const userInfo = await fetchJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const user = ((userInfo.data as Record<string, unknown> | undefined)?.user ?? {}) as Record<string, unknown>;
  return saveConnection({
    state,
    platform: "TikTok",
    accessToken,
    refreshToken: String(token.refresh_token ?? ""),
    expiresIn: Number(token.expires_in ?? 0),
    accountId: String(user.open_id ?? ""),
    accountName: String(user.display_name ?? ""),
    handle: String(user.display_name ?? ""),
    metadata: { privacyLevel: process.env.VIDSLOOM_TIKTOK_DEFAULT_PRIVACY || "SELF_ONLY" }
  });
}

async function saveMetaConnection({
  code,
  origin,
  state,
  platform
}: {
  code: string;
  origin: string;
  state: OAuthState;
  platform: "Instagram Reels" | "Facebook Reels";
}) {
  const version = process.env.VIDSLOOM_META_GRAPH_VERSION || "v20.0";
  const token = await fetchJson(
    `https://graph.facebook.com/${version}/oauth/access_token?${new URLSearchParams({
      client_id: requiredEnv("VIDSLOOM_META_APP_ID"),
      client_secret: requiredEnv("VIDSLOOM_META_APP_SECRET"),
      redirect_uri: callbackUrl(origin, platform),
      code
    })}`
  );
  const accessToken = String(token.access_token ?? "");
  const pages = await fetchJson(
    `https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`
  );
  const page = Array.isArray(pages.data) ? (pages.data[0] as Record<string, unknown> | undefined) : undefined;
  const ig = (page?.instagram_business_account ?? {}) as Record<string, unknown>;
  const pageToken = String(page?.access_token ?? accessToken);
  const accountId = platform === "Instagram Reels" ? String(ig.id ?? "") : String(page?.id ?? "");
  const accountName = platform === "Instagram Reels" ? String(ig.username ?? page?.name ?? "") : String(page?.name ?? "");
  return saveConnection({
    state,
    platform,
    accessToken: pageToken,
    refreshToken: "",
    expiresIn: Number(token.expires_in ?? 0),
    accountId,
    accountName,
    handle: accountName,
    status: accountId ? "connected" : "pending-review",
    metadata: {
      pageId: String(page?.id ?? ""),
      igUserId: String(ig.id ?? "")
    }
  });
}

async function saveConnection({
  state,
  platform,
  accessToken,
  refreshToken,
  expiresIn,
  accountId,
  accountName,
  handle,
  status = "connected",
  metadata = {}
}: {
  state: OAuthState;
  platform: Platform;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId: string;
  accountName: string;
  handle: string;
  status?: SocialConnection["status"];
  metadata?: Record<string, string>;
}) {
  if (!accessToken) throw new Error(`${platform} did not return an access token.`);
  const now = new Date().toISOString();
  const connection = SocialConnectionSchema.parse({
    id: createId("social"),
    customerId: state.customerId,
    platform,
    handle,
    accountId,
    accountName,
    status,
    autoPublish: false,
    scopes: scopes[platform],
    tokenType: "Bearer",
    accessTokenEncrypted: encryptToken(accessToken),
    refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : "",
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : "",
    metadata,
    createdAt: now,
    updatedAt: now,
    lastValidatedAt: now
  });
  return saveSocialConnection(connection);
}

function callbackUrl(origin: string, platform: Platform) {
  const url = new URL("/api/social/oauth/callback", origin);
  url.searchParams.set("platform", platform);
  return url.toString();
}

function signState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(value: string): OAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("OAuth state is missing.");
  const expected = crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  if (!timingSafeEqual(signature, expected)) throw new Error("OAuth state is invalid.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
}

function signingSecret() {
  const secret =
    process.env.VIDSLOOM_TOKEN_ENCRYPTION_SECRET ||
    process.env.VIDSLOOM_AUTH_SECRET ||
    process.env.VIDSLOOM_AUTOMATION_SECRET ||
    "";
  if (!secret.trim()) throw new Error("OAuth state signing is not configured.");
  return secret;
}

function timingSafeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function safeReturnTo(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/portal";
  return value;
}

async function fetchToken(url: string, body: Record<string, string>) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body)
  });
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OAuth provider request failed (${response.status}): ${text.slice(0, 700)}`);
  }
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function fetchJsonOptional(url: string, init?: RequestInit) {
  try {
    return await fetchJson(url, init);
  } catch {
    return {};
  }
}
