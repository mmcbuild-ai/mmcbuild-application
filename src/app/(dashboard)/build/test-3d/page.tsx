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

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <p className="font-medium text-amber-900">
          Roadmap: native .rvt / .skp upload — under review, not built yet
        </p>
        <p className="mt-2 text-amber-900">
          This harness accepts <strong>PDF, PNG, JPG only</strong>. Native
          upload of Revit (.rvt) and SketchUp (.skp) is on the roadmap but
          deliberately deferred:
        </p>
        <ul className="mt-2 space-y-1.5 text-amber-900 list-disc pl-5">
          <li>
            The spatial extractor is Claude Vision — it reads pixels, not
            CAD binaries. PDF works because we render the PDF page to PNG
            before extraction.
          </li>
          <li>
            <code>.rvt</code> is a proprietary Autodesk binary. Server-side
            parsing requires Autodesk Platform Services (APS) — paid,
            multi-week integration with per-upload cost.
          </li>
          <li>
            <code>.skp</code> is a proprietary Trimble binary. No
            production-grade Node.js parser exists. Would require
            Trimble&apos;s C++/Ruby SDK or a custom render pipeline.
          </li>
        </ul>
        <p className="mt-2 text-amber-900">
          Decision pending the MCP spike (
          <code>docs/spike-revit-sketchup-mcp.md</code>, SCRUM-48). Two
          architectural options under review:
        </p>
        <ol className="mt-2 space-y-1.5 text-amber-900 list-decimal pl-5">
          <li>
            <strong>MCP / desktop-bridge path</strong> — the user&apos;s CAD
            app reads the file locally; an MCP server sends structured data
            (not the file) to our pipeline. No upload required, preserves
            REGULATED-tier auth/billing boundary.
          </li>
          <li>
            <strong>Cloud-render path</strong> — server-side APS renders
            .rvt to images; we extract from those images. Higher capability
            ceiling, but adds Autodesk dependency and per-upload cost.
          </li>
        </ol>
        <p className="mt-3 text-amber-900">
          <strong>Workaround for now:</strong> export to PDF from your CAD
          app (Revit: File &rarr; Export &rarr; PDF; SketchUp: File &rarr;
          Export &rarr; 2D Graphic &rarr; PDF) and upload the PDF.
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
