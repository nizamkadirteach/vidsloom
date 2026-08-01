import { unsubscribeNewsletterSubscriberByToken } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const subscriber = token ? await unsubscribeNewsletterSubscriberByToken(token) : null;
  const title = subscriber ? "You are unsubscribed" : "Unsubscribe link not found";
  const message = subscriber
    ? "You have been removed from VIDSLOOM trend notes."
    : "This unsubscribe link is invalid or has already expired.";

  return new Response(
    `<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family:Arial,sans-serif;background:#f7fbfc;color:#172033;display:grid;min-height:100vh;place-items:center;margin:0;padding:24px}main{background:#fff;border:1px solid #dfe4ec;border-radius:10px;max-width:520px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.12)}h1{font-size:28px;margin:0 0 10px}p{line-height:1.5;margin:0 0 18px}a{color:#0891b2;font-weight:700}</style></head><body><main><h1>${title}</h1><p>${message}</p><a href="/newsletter">Back to VIDSLOOM</a></main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    }
  );
}
