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
  const label = heading ?? moduleThemes[module].label;

  return (
    <section className="mx-auto max-w-4xl w-full px-2 sm:px-0 py-2">
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
    </section>
  );
}
