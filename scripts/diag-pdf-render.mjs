// Diagnostic: try rendering a PDF locally via pdf-to-img to isolate
// whether failures are PDF-specific or Vercel-runtime-specific.
//
// Usage: node scripts/diag-pdf-render.mjs "<path-to-pdf>"
import fs from "node:fs/promises";
import { pdf } from "pdf-to-img";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/diag-pdf-render.mjs <pdf-path>");
  process.exit(1);
}

console.log("Reading:", path);
const buf = await fs.readFile(path);
console.log("Buffer size:", buf.length, "bytes");

console.log("\n--- attempt 1: scale=2.0 ---");
try {
  const doc = await pdf(buf, { scale: 2.0 });
  console.log("PDF opened. Pages:", doc.length);
  console.log("Metadata:", JSON.stringify(doc.metadata, null, 2));
  const page1 = await doc.getPage(1);
  console.log("Page 1 rendered, bytes:", page1.length);
} catch (err) {
  console.error("scale=2.0 FAILED:", err?.message ?? err);
  if (err?.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
}

console.log("\n--- attempt 2: scale=1.0 ---");
try {
  const doc = await pdf(buf, { scale: 1.0 });
  console.log("PDF opened. Pages:", doc.length);
  const page1 = await doc.getPage(1);
  console.log("Page 1 rendered, bytes:", page1.length);
} catch (err) {
  console.error("scale=1.0 FAILED:", err?.message ?? err);
  if (err?.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
}
