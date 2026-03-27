/**
 * Spatial data types for 3D plan representation.
 * These types define the structured output from AI vision extraction.
 */

export interface Point2D {
  x: number; // metres from origin
  y: number; // metres from origin
}

export interface Wall {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number; // metres (e.g. 0.09 for 90mm stud)
  type: "external" | "internal" | "party";
  material?: string; // e.g. "timber_frame", "brick_veneer", "sip_panel"
}

export interface Room {
  id: string;
  name: string;
  polygon: Point2D[]; // closed polygon defining room boundary
  area_m2: number;
  floor_level: number; // 0 = ground, 1 = first floor, etc.
  type?: string; // e.g. "living", "bedroom", "bathroom", "kitchen", "garage"
}

export interface Opening {
  id: string;
  type: "door" | "window" | "bifold" | "sliding_door" | "garage_door";
  position: Point2D; // centre point on wall
  width: number; // metres
  height: number; // metres
  wall_id?: string; // which wall this opening is in
  sill_height?: number; // metres from floor (windows)
}

export interface SpatialLayout {
  /** Extracted rooms with boundaries */
  rooms: Room[];
  /** Walls with start/end coordinates */
  walls: Wall[];
  /** Doors, windows, and other openings */
  openings: Opening[];
  /** Overall bounding box */
  bounds: {
    min: Point2D;
    max: Point2D;
    width: number; // metres
    depth: number; // metres
  };
  /** Number of storeys detected */
  storeys: number;
  /** Default wall height in metres */
  wall_height: number;
  /** Extraction confidence (0-1) */
  confidence: number;
  /** Any notes from the AI about extraction quality */
  notes?: string;
}

export interface SuggestionOverlay {
  id: string;
  /** Which walls/rooms are affected */
  affected_wall_ids: string[];
  affected_room_ids: string[];
  /** Display properties */
  colour: string; // hex colour for the overlay
  label: string;
  description: string;
  /** From the existing suggestion data */
  technology_category: string;
  estimated_cost_savings: number | null;
  estimated_time_savings: number | null;
}
