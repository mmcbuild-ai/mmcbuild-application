import { Test3DHarness } from "@/components/build/test-3d-harness";

export const metadata = {
  title: "3D Extractor Test Harness",
};

export default function Test3DPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">3D Extractor Test Harness</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dev tool. Upload a plan (PDF / PNG / JPG), see the spatial extractor
          result rendered in 3D. Skips project, paywall, and Inngest. One AI
          call per click (Sonnet vision; Haiku page classifier if PDF
          auto-detect runs).
        </p>
      </div>

      <details className="rounded-lg border bg-zinc-50 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Where to find sample plans to stress-test
        </summary>
        <ul className="mt-3 space-y-2 text-zinc-700">
          <li>
            <strong>Volume builder display home pages</strong> — Metricon,
            Coral, Wisdom, McDonald Jones, Clarendon. Each home page links to
            a downloadable floor plan PDF. Good for clean single-storey and
            double-storey residential plans.
          </li>
          <li>
            <strong>realestate.com.au new-build listings</strong> — many
            display the floor plan as a PDF or PNG in the gallery. Good for
            realistic ICP-grade plans.
          </li>
          <li>
            <strong>NSW Planning Portal / VicSmart / SA PlanSA</strong> —
            council DA documents are public. Search a recent residential
            application and download the architectural set PDF. Good for
            multi-page sets that exercise the page classifier.
          </li>
          <li>
            <strong>Wikimedia Commons</strong> — search the &quot;Floor
            plans&quot; category for image-only PNGs / JPGs. Good for testing
            the image path that skips PDF rendering.
          </li>
          <li>
            <strong>Hand-sketch / photo of a sketch</strong> — phone photo of
            a hand-drawn plan. Good for stress-testing extractor robustness
            on non-CAD inputs.
          </li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Not linking specific URLs because builder and council PDF links
          rotate. Test for personal use only — most floor plans are
          copyrighted by the builder or architect.
        </p>
      </details>

      <Test3DHarness />
    </div>
  );
}
