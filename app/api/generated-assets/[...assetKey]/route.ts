import { NextResponse } from "next/server";

import { readGeneratedAsset } from "@/lib/generated-asset-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetKey: string[] }> }) {
  const { assetKey } = await context.params;
  const key = assetKey.join("/");
  const asset = await readGeneratedAsset(key).catch((error) => {
    console.error("Generated asset read failed", { key, error });
    return null;
  });

  if (!asset) {
    return NextResponse.json({ error: "Generated asset not found." }, { status: 404 });
  }

  const range = request.headers.get("range");
  const rangeMatch = range?.match(/^bytes=(\d*)-(\d*)$/);

  if (rangeMatch) {
    const size = asset.body.byteLength;
    const start = rangeMatch[1] ? Number.parseInt(rangeMatch[1], 10) : 0;
    const end = rangeMatch[2] ? Number.parseInt(rangeMatch[2], 10) : size - 1;
    const boundedStart = Math.max(0, Math.min(start, size - 1));
    const boundedEnd = Math.max(boundedStart, Math.min(end, size - 1));
    const chunk = asset.body.subarray(boundedStart, boundedEnd + 1);

    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "content-type": asset.contentType,
        "cache-control": asset.cacheControl,
        "accept-ranges": "bytes",
        "content-range": `bytes ${boundedStart}-${boundedEnd}/${size}`,
        "content-length": String(chunk.byteLength)
      }
    });
  }

  return new NextResponse(new Uint8Array(asset.body), {
    headers: {
      "content-type": asset.contentType,
      "cache-control": asset.cacheControl,
      "accept-ranges": "bytes",
      "content-length": String(asset.body.byteLength)
    }
  });
}
