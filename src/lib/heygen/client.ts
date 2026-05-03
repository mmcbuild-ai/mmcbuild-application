// Minimal HeyGen V2 client. Used by scripts/heygen-generate-*-explainer.ts
// to pre-render the per-module explainer videos that play on each module's
// landing page. Server-side only (uses HEYGEN_API_KEY).

const API_BASE = "https://api.heygen.com";

type HeyGenAvatar = {
  avatar_id: string;
  avatar_name: string;
  gender: string | null;
  preview_image_url: string | null;
  preview_video_url: string | null;
};

type HeyGenVoice = {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio: string | null;
};

type GenerateInput = {
  avatarId: string;
  voiceId: string;
  text: string;
  /** 720p keeps file size sane (~3-5 MB / minute). */
  width?: number;
  height?: number;
  /** Solid colour or hex. HeyGen accepts "#xxxxxx" via background.value. */
  backgroundHex?: string;
};

function authHeaders(): Record<string, string> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not set");
  return { "X-Api-Key": key, "Content-Type": "application/json" };
}

export async function listAvatars(): Promise<HeyGenAvatar[]> {
  const res = await fetch(`${API_BASE}/v2/avatars`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HeyGen listAvatars ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data?: { avatars?: HeyGenAvatar[] };
  };
  return json.data?.avatars ?? [];
}

export async function listVoices(): Promise<HeyGenVoice[]> {
  const res = await fetch(`${API_BASE}/v2/voices`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HeyGen listVoices ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data?: { voices?: HeyGenVoice[] } };
  return json.data?.voices ?? [];
}

/** Submit the render. Returns a video_id you poll on. */
export async function generateVideo(input: GenerateInput): Promise<string> {
  const body = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: input.avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: input.text,
          voice_id: input.voiceId,
        },
        background: {
          type: "color",
          value: input.backgroundHex ?? "#0f172a",
        },
      },
    ],
    dimension: {
      width: input.width ?? 1280,
      height: input.height ?? 720,
    },
  };
  const res = await fetch(`${API_BASE}/v2/video/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HeyGen generateVideo ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as { data?: { video_id?: string } };
  const id = json.data?.video_id;
  if (!id) throw new Error(`HeyGen generateVideo: video_id missing`);
  return id;
}

type VideoStatus = {
  status: "pending" | "processing" | "completed" | "failed" | "waiting";
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
};

export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  const res = await fetch(
    `${API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HeyGen getVideoStatus ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as {
    data?: {
      status?: VideoStatus["status"];
      video_url?: string;
      thumbnail_url?: string;
      error?: { message?: string } | string;
    };
  };
  const data = json.data ?? {};
  const errVal =
    typeof data.error === "string"
      ? data.error
      : (data.error?.message ?? null);
  return {
    status: data.status ?? "pending",
    videoUrl: data.video_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    error: errVal,
  };
}
