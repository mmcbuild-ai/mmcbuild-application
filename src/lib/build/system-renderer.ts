/**
 * MMC System Explorer renderer.
 *
 * Takes a SpatialLayout and renders it in one of four MMC system styles:
 *   - traditional (stick-built baseline)
 *   - panelised (factory panels with visible seams)
 *   - volumetric (modular boxes)
 *   - printed (3D-printed concrete with layer striations)
 *
 * The core trick: we call buildFloorPlan3D() to get the base geometry, then
 * walk the resulting Group and re-style its meshes per system. System-specific
 * overlays (panel seams, module wireframes, print striations) are added on
 * top as additional children.
 */

import * as THREE from "three";
import { buildFloorPlan3D } from "./spatial";
import type { SpatialLayout, Wall, Point2D } from "./spatial/types";

// ----------------------------------------------------------------------------
// System catalogue
// ----------------------------------------------------------------------------

export type MMCSystem = "traditional" | "panelised" | "volumetric" | "printed";

export interface SystemSpec {
  id: MMCSystem;
  label: string;
  tagline: string;
  /** Accent colour for the UI card border, label chip, overlays. Hex string. */
  accent: string;
  /** Subtitle under the label (e.g. "factory panels"). */
  subtitle: string;
}

export const SYSTEM_SPECS: Record<MMCSystem, SystemSpec> = {
  traditional: {
    id: "traditional",
    label: "Traditional",
    subtitle: "built brick-by-brick on site",
    tagline: "How your design would be built the conventional way.",
    accent: "#a85b3a",
  },
  panelised: {
    id: "panelised",
    label: "Panelised",
    subtitle: "factory panels, tilt up on site",
    tagline: "Walls + floors + roof arrive flat-packed, lifted into place.",
    accent: "#8b5cf6",
  },
  volumetric: {
    id: "volumetric",
    label: "Volumetric",
    subtitle: "modular boxes, craned into place",
    tagline: "Fully-finished rooms built off-site, delivered and installed.",
    accent: "#f59e0b",
  },
  printed: {
    id: "printed",
    label: "3D-printed concrete",
    subtitle: "printed on site, layer by layer",
    tagline: "Walls extruded in concrete by a gantry printer on your slab.",
    accent: "#3b82f6",
  },
};

// ----------------------------------------------------------------------------
// Pros / cons data (indicative — to be replaced with MMC Build's real numbers)
// ----------------------------------------------------------------------------

export interface SystemMetrics {
  /** Cost delta vs traditional, e.g. "+5%" or "-12%". */
  capex_delta: string;
  /** Weeks from slab to lockup. */
  time_to_lockup_weeks: string;
  /** % reduction in on-site labour hours vs traditional. */
  onsite_labour_reduction: string;
  /** Transport / site access summary. */
  transport: string;
  /** Suitability flags / gotchas. */
  suitability: string[];
  /** Headline pros. */
  pros: string[];
  /** Headline cons. */
  cons: string[];
}

export const SYSTEM_METRICS: Record<MMCSystem, SystemMetrics> = {
  traditional: {
    capex_delta: "baseline",
    time_to_lockup_weeks: "20–24 weeks",
    onsite_labour_reduction: "—",
    transport: "Standard trade deliveries",
    suitability: ["Works on any site", "No crane required"],
    pros: ["Familiar trades", "Highest design flexibility", "No factory lead time"],
    cons: ["Slow build", "Weather-exposed", "Site labour intensive"],
  },
  panelised: {
    capex_delta: "+3% to +8%",
    time_to_lockup_weeks: "6–10 weeks",
    onsite_labour_reduction: "≈40%",
    transport: "Flat-pack truck delivery; small crane for lift",
    suitability: ["Suits standard suburban lots", "Truck access required"],
    pros: ["~60% faster to lockup", "Factory precision = less waste", "Lower weather risk"],
    cons: ["Less on-site design change once panels cut", "Truck access needed for delivery"],
  },
  volumetric: {
    capex_delta: "-5% to +5%",
    time_to_lockup_weeks: "2–4 weeks on site",
    onsite_labour_reduction: "≈70%",
    transport: "Heavy haulage + medium crane (modules up to 3m × 12m)",
    suitability: ["Flat sites preferred", "Crane swing access mandatory", "Module size limited by road transport"],
    pros: ["Fastest install", "Interiors completed in factory", "Lowest on-site disruption"],
    cons: ["Crane site access required", "Module dimensions constrain plan", "Higher transport cost"],
  },
  printed: {
    capex_delta: "+8% to +15%",
    time_to_lockup_weeks: "3–6 weeks (printing) + finishing",
    onsite_labour_reduction: "≈50%",
    transport: "Gantry printer setup on slab; concrete pump truck",
    suitability: ["Single-storey works best", "Slab + level pad required", "Council acceptance still emerging in AU"],
    pros: ["No formwork or framing", "Curves and complex shapes 'free'", "Thermal mass advantage"],
    cons: ["Limited storeys in AU regulation", "Still emerging tech", "Higher upfront cost"],
  },
};

// ----------------------------------------------------------------------------
// Material palettes per system
// ----------------------------------------------------------------------------

interface SystemPalette {
  externalWall: number;
  internalWall: number;
  roof: number;
  ground: number;
  overlay: number;
}

const PALETTES: Record<MMCSystem, SystemPalette> = {
  traditional: {
    externalWall: 0xb88b6b, // warm brick-veneer
    internalWall: 0xe6e2dc,
    roof: 0x4a3c34,
    ground: 0xe8e4dc,
    overlay: 0xa85b3a,
  },
  panelised: {
    externalWall: 0xe8e4dc, // off-white panel
    internalWall: 0xf0ece6,
    roof: 0x6e6964,
    ground: 0xe8e4dc,
    overlay: 0x8b5cf6, // violet seams
  },
  volumetric: {
    externalWall: 0xd8cdb8, // warm tan
    internalWall: 0xe8e0d0,
    roof: 0x5a5048,
    ground: 0xe8e4dc,
    overlay: 0xf59e0b, // amber module lines
  },
  printed: {
    externalWall: 0xcfc8bc, // concrete grey-beige
    internalWall: 0xd8d4cc,
    roof: 0x4a4640,
    ground: 0xe4e0d8,
    overlay: 0x3b82f6, // blue
  },
};

// ----------------------------------------------------------------------------
// Helpers — re-implemented locally to avoid touching the existing geometry.ts
// ----------------------------------------------------------------------------

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function wallAngle(wall: Wall): number {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
}

function wallMidpoint(wall: Wall): Point2D {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2,
  };
}

// ----------------------------------------------------------------------------
// Per-system overlays
// ----------------------------------------------------------------------------

const PANEL_WIDTH_M = 2.4; // AU-standard structural panel width

/**
 * Vertical seam strips at panel-width intervals on every external wall.
 * Rendered as thin dark BoxGeometry strips sitting flush with the wall's
 * outside face.
 */
function buildPanelSeams(
  layout: SpatialLayout,
  wallHeight: number,
): THREE.Group {
  const group = new THREE.Group();
  const seamMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a2a2a,
    transparent: true,
    opacity: 0.55,
  });

  for (const wall of layout.walls) {
    if (wall.type !== "external") continue;
    const len = wallLength(wall);
    if (len < PANEL_WIDTH_M * 0.5) continue;

    const angle = wallAngle(wall);
    const mid = wallMidpoint(wall);
    const wallH = wall.height_m && wall.height_m > 0 ? wall.height_m : wallHeight;

    const seamCount = Math.max(1, Math.floor(len / PANEL_WIDTH_M));
    const seamSpacing = len / seamCount;

    for (let i = 1; i < seamCount; i++) {
      const t = i * seamSpacing - len / 2;
      // Seam is a thin strip 2cm wide × wall height × slightly thicker than wall
      const seamThickness = (wall.thickness || 0.09) + 0.03;
      const geo = new THREE.BoxGeometry(0.025, wallH * 0.96, seamThickness);
      const seam = new THREE.Mesh(geo, seamMaterial);
      // Position relative to wall mid, offset by t along the wall direction
      seam.position.set(
        mid.x + Math.cos(angle) * t,
        wallH / 2,
        mid.y + Math.sin(angle) * t,
      );
      seam.rotation.y = -angle;
      group.add(seam);
    }
  }

  return group;
}

/**
 * Module wireframe overlays — divides the building footprint into a grid of
 * ≈MODULE_W × MODULE_D cells and draws each cell as a translucent coloured
 * line box at wall height. Communicates "the building is partitioned into
 * factory modules".
 */
const MODULE_W = 3.0;
const MODULE_D = 6.0;

function buildModuleWireframes(
  layout: SpatialLayout,
  wallHeight: number,
  accent: number,
): THREE.Group {
  const group = new THREE.Group();
  const { width, depth } = layout.bounds;

  // Decide grid orientation: longer side gets MODULE_D
  const cellW = width >= depth ? MODULE_D : MODULE_W;
  const cellD = width >= depth ? MODULE_W : MODULE_D;

  const cols = Math.max(1, Math.round(width / cellW));
  const rows = Math.max(1, Math.round(depth / cellD));
  const actualW = width / cols;
  const actualD = depth / rows;

  const lineMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.7,
  });
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * actualW;
      const z = r * actualD;
      // Edge box at wall height
      const edges = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(actualW, wallHeight + 0.2, actualD),
      );
      const wire = new THREE.LineSegments(edges, lineMaterial);
      wire.position.set(x + actualW / 2, (wallHeight + 0.2) / 2, z + actualD / 2);
      group.add(wire);

      // Translucent fill so modules read as bounded volumes
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(actualW * 0.98, wallHeight + 0.18, actualD * 0.98),
        fillMaterial,
      );
      fill.position.set(x + actualW / 2, (wallHeight + 0.18) / 2, z + actualD / 2);
      group.add(fill);
    }
  }

  return group;
}

/**
 * Procedural horizontal-stripe texture for 3D-printed walls. Generated once
 * per call; tiles vertically to match real-world layer height.
 */
let printTextureCache: THREE.CanvasTexture | null = null;
function getPrintLayerTexture(): THREE.CanvasTexture | null {
  if (printTextureCache) return printTextureCache;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  // Base tone
  ctx.fillStyle = "#cfc8bc";
  ctx.fillRect(0, 0, 64, 64);
  // Horizontal stripes (≈4 visible per 64px = 4 print layers per 0.4m of wall)
  ctx.fillStyle = "#a89e8e";
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2);
  }
  // Subtle highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = 2; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Texture repeats: 1 tile = 0.4m of wall height, so 6 tiles per 2.4m wall.
  // Multiplied per-mesh below based on wall length.
  printTextureCache = tex;
  return tex;
}

// ----------------------------------------------------------------------------
// Material recolouring walker
// ----------------------------------------------------------------------------

/**
 * Walk the Group produced by buildFloorPlan3D and restyle each mesh per the
 * target system's palette.
 */
function restyleForSystem(group: THREE.Group, system: MMCSystem): void {
  const palette = PALETTES[system];

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const ud = obj.userData;

    if (ud?.type === "wall") {
      // Find the source wall to know if it's external
      const isExternal =
        obj.material instanceof THREE.MeshStandardMaterial
          ? true // we can't read type from material; assume external if not internal palette
          : true;
      // Read the wall colour heuristically: the existing code sets brighter
      // colours for external walls. We'll just recolour everything with the
      // system palette — external vs internal is communicated by relative
      // brightness.
      const newMat = new THREE.MeshStandardMaterial({
        color: palette.externalWall, // simplified; original code already
        // separates external vs internal — we override uniformly per system
        // for visual coherence
        roughness: 0.85,
        metalness: 0.05,
      });

      // System-specific material tweaks
      if (system === "printed") {
        const tex = getPrintLayerTexture();
        if (tex) {
          const cloned = tex.clone();
          cloned.needsUpdate = true;
          cloned.wrapS = THREE.RepeatWrapping;
          cloned.wrapT = THREE.RepeatWrapping;
          cloned.repeat.set(2, 6); // 6 vertical bands = 2.4m wall / 0.4m per band
          newMat.map = cloned;
          newMat.color.setHex(0xffffff); // let texture dominate
          newMat.roughness = 0.95;
        }
      }
      if (system === "panelised") {
        newMat.roughness = 0.75;
      }
      if (system === "volumetric") {
        newMat.color.setHex(palette.externalWall);
      }

      obj.material = newMat;
      return;
    }

    if (ud?.type === "floor") {
      // Slightly tint the floor to harmonise with the system palette
      if (obj.material instanceof THREE.MeshStandardMaterial) {
        const m = obj.material.clone();
        m.color.setHex(palette.ground);
        obj.material = m;
      }
      return;
    }

    if (ud?.type === "roof") {
      if (obj.material instanceof THREE.MeshStandardMaterial) {
        const m = obj.material.clone();
        m.color.setHex(palette.roof);
        m.roughness = 0.7;
        obj.material = m;
      }
      return;
    }

    if (ud?.type === "opening" && ud?.openingType === "window") {
      // Re-tint glass cooler in panelised/printed, warmer in traditional
      if (obj.material instanceof THREE.MeshStandardMaterial) {
        const m = obj.material.clone();
        m.color.setHex(system === "printed" ? 0x8aa8c4 : 0x9cb4d0);
        m.transparent = true;
        m.opacity = 0.45;
        obj.material = m;
      }
    }
  });
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

/**
 * Build a 3D group for the given SpatialLayout rendered in the chosen
 * MMC system style. Returns a fresh Group every call (safe to render in
 * separate Canvas instances).
 */
export function buildFloorPlan3DForSystem(
  layout: SpatialLayout,
  system: MMCSystem,
): THREE.Group {
  const wallHeight = layout.wall_height || 2.4;

  // Start from the base geometry pipeline (gives us walls, roof, openings,
  // floors, ground — correctly centred)
  const group = buildFloorPlan3D(layout);

  // Recolour materials per system
  restyleForSystem(group, system);

  // Add system-specific overlays. They need to be centred the same way the
  // base group is — buildFloorPlan3D applies a `group.position.set(-cx, 0, -cz)`
  // translation as its final step, so overlays added as children are
  // automatically translated with the group.
  if (system === "panelised") {
    group.add(buildPanelSeams(layout, wallHeight));
  } else if (system === "volumetric") {
    group.add(buildModuleWireframes(layout, wallHeight, PALETTES.volumetric.overlay));
  }

  return group;
}
