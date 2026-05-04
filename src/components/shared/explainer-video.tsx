"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { moduleThemes, type ModuleKey } from "@/lib/module-themes";

interface ExplainerVideoProps {
  module: ModuleKey;
  /**
   * Self-hosted MP4 path (e.g. "/videos/build-explainer.mp4") or an
   * embeddable URL (YouTube/Vimeo).
   */
  videoUrl: string;
  /** Override the module label as the heading. Defaults to moduleThemes[module].label. */
  heading?: string;
}

function isSelfHostedMp4(url: string) {
  return url.startsWith("/") || url.toLowerCase().endsWith(".mp4");
}

export function ExplainerVideo({
  module,
  videoUrl,
  heading,
}: ExplainerVideoProps) {
  const theme = moduleThemes[module];
  const label = heading ?? theme.label;
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mx-auto max-w-4xl w-full px-2 sm:px-0 py-2">
      {expanded ? (
        <>
          <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            {label}
          </h1>
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="relative aspect-video w-full bg-black">
              {isSelfHostedMp4(videoUrl) ? (
                <video
                  src={videoUrl}
                  title={label}
                  controls
                  autoPlay
                  preload="metadata"
                  className="absolute inset-0 h-full w-full"
                  aria-label={`${label} explainer video`}
                />
              ) : (
                <iframe
                  src={videoUrl}
                  title={label}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="group inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Watch the ${label} explainer video`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${theme.accentBg} text-white`}
            >
              <Play className="h-3 w-3 fill-current" />
            </span>
            <span>Click here to watch the {label} video</span>
          </button>
        </div>
      )}
    </section>
  );
}
