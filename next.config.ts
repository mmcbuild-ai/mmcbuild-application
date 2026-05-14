import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdf-to-img",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  // Force the @napi-rs/canvas native binaries and pdfjs-dist standard
  // fonts/cmaps into the serverless function bundle. Without this Vercel's
  // automatic file trace can miss native .node files and pdfjs's runtime
  // assets, which surfaces as "DOMMatrix is not defined" at PDF render time.
  outputFileTracingIncludes: {
    "/build/test-3d/**": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
    "/api/**": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
