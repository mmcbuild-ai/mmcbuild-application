export type PlanFileKind = "pdf" | "image" | "dwg";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const ACCEPTED_PLAN_EXTS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".dwg",
] as const;

export const ACCEPTED_PLAN_ACCEPT_ATTR =
  "application/pdf,image/jpeg,image/png,image/webp,.dwg";

export function detectPlanKind(
  fileName: string,
  mimeType: string | null | undefined,
): PlanFileKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "dwg") return "dwg";
  if (IMAGE_EXTS.has(ext) || (mimeType && IMAGE_MIME.has(mimeType)))
    return "image";
  return null;
}

export function contentTypeForKind(
  kind: PlanFileKind,
  fileName: string,
): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "dwg") return "application/acad";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
