/**
 * Piece 3: Spatial JSON → Three.js 3D Geometry
 *
 * Converts the AI-extracted spatial layout into Three.js meshes for rendering.
 * Pure geometry — no AI needed here.
 */

import * as THREE from "three";
import type { SpatialLayout, Wall, Room, Opening, Point2D } from "./types";

// Colour palette
const COLOURS = {
  wall_external: 0xb0b0b0,
  wall_internal: 0xd4d4d4,
  wall_party: 0xa0a0a0,
  floor: 0xf5f0e8,
  door: 0x8b6914,
  window: 0x87ceeb,
  ceiling: 0xfafafa,
  suggestion_highlight: 0x14b8a6, // teal-500
};

// Room type → floor colour
const ROOM_COLOURS: Record<string, number> = {
  living: 0xf5f0e8,
  bedroom: 0xe8edf5,
  bathroom: 0xe0f0f0,
  ensuite: 0xe0f0f0,
  kitchen: 0xf5ede0,
  laundry: 0xe8e8f0,
  garage: 0xe0e0e0,
  hallway: 0xf0f0f0,
  entry: 0xf0ece0,
  study: 0xedf0e8,
  dining: 0xf5ede0,
  alfresco: 0xe8f0e0,
  default: 0xf5f0e8,
};

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

/**
 * Build a single wall mesh (extruded rectangle).
 */
function buildWall(wall: Wall, height: number): THREE.Mesh {
  const length = wallLength(wall);
  const thickness = wall.thickness || 0.09;
  const geometry = new THREE.BoxGeometry(length, height, thickness);

  const colourKey = `wall_${wall.type}` as keyof typeof COLOURS;
  const colour = COLOURS[colourKey] || COLOURS.wall_external;
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.8,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const mid = wallMidpoint(wall);
  const angle = wallAngle(wall);

  // Position at midpoint, half height up, rotated to match wall direction
  // Three.js: x = right, y = up, z = towards camera
  // Our coords: x = right, y = depth (into screen)
  mesh.position.set(mid.x, height / 2, mid.y);
  mesh.rotation.y = -angle;

  mesh.userData = { type: "wall", wallId: wall.id, material: wall.material };
  return mesh;
}

/**
 * Build a floor polygon for a room.
 */
function buildFloor(room: Room): THREE.Mesh {
  if (room.polygon.length < 3) {
    // Fallback: create a small placeholder
    const geo = new THREE.PlaneGeometry(1, 1);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf5f0e8 }));
  }

  const shape = new THREE.Shape();
  shape.moveTo(room.polygon[0].x, room.polygon[0].y);
  for (let i = 1; i < room.polygon.length; i++) {
    shape.lineTo(room.polygon[i].x, room.polygon[i].y);
  }
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  const colour = ROOM_COLOURS[room.type || "default"] || ROOM_COLOURS.default;
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // Rotate to lay flat (shape is in XY, we need XZ)
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01; // slightly above ground to prevent z-fighting

  mesh.userData = { type: "floor", roomId: room.id, roomName: room.name };
  return mesh;
}

/**
 * Build an opening (door or window) as a coloured box cut into the wall.
 */
function buildOpening(opening: Opening, wallHeight: number, walls: Wall[]): THREE.Mesh | null {
  // Find the parent wall to determine position and rotation
  const wall = walls.find((w) => w.id === opening.wall_id);
  if (!wall) {
    // Position at the opening's coordinates if no wall reference
    const height = opening.height || (opening.type === "window" ? 1.2 : 2.04);
    const sillHeight = opening.sill_height || (opening.type === "window" ? 0.9 : 0);
    const geometry = new THREE.BoxGeometry(opening.width, height, 0.15);
    const colour = opening.type === "window" ? COLOURS.window : COLOURS.door;
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.5,
      transparent: opening.type === "window",
      opacity: opening.type === "window" ? 0.4 : 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(opening.position.x, sillHeight + height / 2, opening.position.y);
    mesh.userData = { type: "opening", openingType: opening.type, openingId: opening.id };
    return mesh;
  }

  const angle = wallAngle(wall);
  const height = opening.height || (opening.type === "window" ? 1.2 : 2.04);
  const sillHeight = opening.sill_height || (opening.type === "window" ? 0.9 : 0);
  const thickness = (wall.thickness || 0.09) + 0.02; // slightly thicker than wall to show through

  const geometry = new THREE.BoxGeometry(opening.width, height, thickness);
  const colour = opening.type === "window" ? COLOURS.window : COLOURS.door;
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.3,
    transparent: opening.type === "window",
    opacity: opening.type === "window" ? 0.4 : 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(opening.position.x, sillHeight + height / 2, opening.position.y);
  mesh.rotation.y = -angle;

  mesh.userData = { type: "opening", openingType: opening.type, openingId: opening.id };
  return mesh;
}

/**
 * Build a ground plane.
 */
function buildGround(bounds: SpatialLayout["bounds"]): THREE.Mesh {
  const padding = 2;
  const width = bounds.width + padding * 2;
  const depth = bounds.depth + padding * 2;
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe8e8e0,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(bounds.width / 2, 0, bounds.depth / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build a highlight overlay for a suggestion affecting specific walls.
 */
export function buildSuggestionHighlight(
  wallIds: string[],
  walls: Wall[],
  wallHeight: number,
  colour: number = COLOURS.suggestion_highlight
): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  for (const wallId of wallIds) {
    const wall = walls.find((w) => w.id === wallId);
    if (!wall) continue;

    const length = wallLength(wall);
    const thickness = (wall.thickness || 0.09) + 0.05;
    const geometry = new THREE.BoxGeometry(length, wallHeight + 0.1, thickness);
    const mesh = new THREE.Mesh(geometry, material);
    const mid = wallMidpoint(wall);
    const angle = wallAngle(wall);
    mesh.position.set(mid.x, wallHeight / 2, mid.y);
    mesh.rotation.y = -angle;
    group.add(mesh);
  }

  return group;
}

/**
 * Main entry point: build complete 3D scene from spatial layout.
 */
export function buildFloorPlan3D(layout: SpatialLayout): THREE.Group {
  const group = new THREE.Group();
  const wallHeight = layout.wall_height || 2.4;

  // Ground plane
  group.add(buildGround(layout.bounds));

  // Room floors
  for (const room of layout.rooms) {
    group.add(buildFloor(room));
  }

  // Walls
  for (const wall of layout.walls) {
    group.add(buildWall(wall, wallHeight));
  }

  // Openings (doors and windows)
  for (const opening of layout.openings) {
    const mesh = buildOpening(opening, wallHeight, layout.walls);
    if (mesh) group.add(mesh);
  }

  // Centre the model on origin for easier camera positioning
  const centreX = layout.bounds.width / 2;
  const centreZ = layout.bounds.depth / 2;
  group.position.set(-centreX, 0, -centreZ);

  return group;
}
