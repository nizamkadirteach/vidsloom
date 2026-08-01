import type { VideoDurationSeconds } from "@/lib/schemas";

export type DurationSegment = {
  shotNumber: number;
  startSecond: number;
  endSecond: number;
  role: "hook" | "problem" | "offer" | "proof" | "demo" | "cta" | "transition";
};

const durationPatterns: Record<VideoDurationSeconds, Array<Omit<DurationSegment, "shotNumber" | "startSecond" | "endSecond"> & { seconds: number }>> = {
  10: [
    { role: "hook", seconds: 3 },
    { role: "proof", seconds: 4 },
    { role: "cta", seconds: 3 }
  ],
  15: [
    { role: "hook", seconds: 3 },
    { role: "offer", seconds: 5 },
    { role: "proof", seconds: 4 },
    { role: "cta", seconds: 3 }
  ],
  20: [
    { role: "hook", seconds: 3 },
    { role: "problem", seconds: 4 },
    { role: "demo", seconds: 5 },
    { role: "proof", seconds: 5 },
    { role: "cta", seconds: 3 }
  ],
  30: [
    { role: "hook", seconds: 3 },
    { role: "problem", seconds: 5 },
    { role: "offer", seconds: 6 },
    { role: "demo", seconds: 6 },
    { role: "proof", seconds: 6 },
    { role: "cta", seconds: 4 }
  ],
  45: [
    { role: "hook", seconds: 4 },
    { role: "problem", seconds: 6 },
    { role: "offer", seconds: 7 },
    { role: "demo", seconds: 8 },
    { role: "proof", seconds: 8 },
    { role: "transition", seconds: 5 },
    { role: "cta", seconds: 7 }
  ],
  60: [
    { role: "hook", seconds: 4 },
    { role: "problem", seconds: 7 },
    { role: "offer", seconds: 8 },
    { role: "demo", seconds: 8 },
    { role: "proof", seconds: 8 },
    { role: "demo", seconds: 8 },
    { role: "proof", seconds: 7 },
    { role: "cta", seconds: 10 }
  ]
};

export function segmentVideoDuration(durationSeconds: VideoDurationSeconds): DurationSegment[] {
  const pattern = durationPatterns[durationSeconds];
  let cursor = 0;

  return pattern.map((item, index) => {
    const startSecond = cursor;
    cursor += item.seconds;
    const endSecond = index === pattern.length - 1 ? durationSeconds : cursor;
    return {
      shotNumber: index + 1,
      startSecond,
      endSecond,
      role: item.role
    };
  });
}

export function recommendedDurationFor({
  platform,
  goal,
  qualityMode
}: {
  platform: string;
  goal: string;
  qualityMode: string;
}): VideoDurationSeconds {
  const haystack = `${platform} ${goal} ${qualityMode}`.toLowerCase();
  if (haystack.includes("linkedin") || haystack.includes("explainer") || haystack.includes("b2b")) return 30;
  if (haystack.includes("launch") || haystack.includes("education") || haystack.includes("objection")) return 45;
  if (haystack.includes("flash") || haystack.includes("promo") || haystack.includes("offer")) return 15;
  if (haystack.includes("x") || haystack.includes("tiktok")) return 15;
  return 20;
}
