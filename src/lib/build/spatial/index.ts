export type {
  SpatialLayout,
  Wall,
  Room,
  Opening,
  Point2D,
  SuggestionOverlay,
} from "./types";
export { buildFloorPlan3D, buildSuggestionHighlight } from "./geometry";
// Note: extractSpatialLayout and renderPdfPage are server-only —
// import them directly from their files in server contexts.
