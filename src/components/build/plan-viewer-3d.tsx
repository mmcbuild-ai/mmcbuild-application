"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  buildFloorPlan3D,
  buildSuggestionHighlight,
  type SpatialLayout,
  type SuggestionOverlay,
} from "@/lib/build/spatial";

// ============================================
// Sub-components rendered inside Canvas
// ============================================

function BuildingModel({ layout }: { layout: SpatialLayout }) {
  const group = useMemo(() => buildFloorPlan3D(layout), [layout]);
  return <primitive object={group} />;
}

function SuggestionHighlights({
  overlays,
  layout,
}: {
  overlays: SuggestionOverlay[];
  layout: SpatialLayout;
}) {
  return (
    <>
      {overlays.map((overlay) => {
        const colour = parseInt(overlay.colour.replace("#", ""), 16);
        const group = buildSuggestionHighlight(
          overlay.affected_wall_ids,
          layout.walls,
          layout.wall_height || 2.4,
          colour
        );
        return <primitive key={overlay.id} object={group} />;
      })}
    </>
  );
}

function RoomLabels({ layout }: { layout: SpatialLayout }) {
  const centreX = layout.bounds.width / 2;
  const centreZ = layout.bounds.depth / 2;

  return (
    <>
      {layout.rooms.map((room) => {
        // Calculate room centre from polygon
        const cx =
          room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length - centreX;
        const cz =
          room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length - centreZ;

        return (
          <Html
            key={room.id}
            position={[cx, 0.1, cz]}
            center
            distanceFactor={15}
            style={{ pointerEvents: "none" }}
          >
            <div className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 shadow-sm whitespace-nowrap">
              {room.name}
              {room.area_m2 ? (
                <span className="ml-1 text-zinc-400">
                  {room.area_m2.toFixed(0)}m²
                </span>
              ) : null}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function SceneSetup({ layout }: { layout: SpatialLayout }) {
  const maxDim = Math.max(layout.bounds.width, layout.bounds.depth);
  const cameraDistance = maxDim * 1.2;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance, cameraDistance * 0.8, cameraDistance]}
        fov={45}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={cameraDistance * 3}
      />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[maxDim, maxDim * 1.5, maxDim * 0.5]}
        intensity={0.8}
        castShadow
      />
      <directionalLight position={[-maxDim, maxDim, -maxDim]} intensity={0.3} />
      <Grid
        args={[50, 50]}
        cellSize={1}
        sectionSize={5}
        fadeDistance={30}
        position={[0, -0.01, 0]}
        cellColor="#e0e0e0"
        sectionColor="#c0c0c0"
      />
    </>
  );
}

// ============================================
// Main exported component
// ============================================

interface PlanViewer3DProps {
  layout: SpatialLayout;
  suggestions?: SuggestionOverlay[];
  className?: string;
  label?: string;
}

export function PlanViewer3D({
  layout,
  suggestions = [],
  className = "",
  label,
}: PlanViewer3DProps) {
  const [showLabels, setShowLabels] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  return (
    <div className={`relative rounded-lg border bg-zinc-50 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b bg-white px-3 py-1.5 rounded-t-lg">
        <span className="text-sm font-medium text-zinc-700">{label || "3D Plan View"}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`rounded px-2 py-0.5 text-xs ${
              showLabels
                ? "bg-zinc-200 text-zinc-800"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            Labels
          </button>
          {suggestions.length > 0 && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`rounded px-2 py-0.5 text-xs ${
                showSuggestions
                  ? "bg-teal-100 text-teal-800"
                  : "bg-zinc-100 text-zinc-400"
              }`}
            >
              Suggestions
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="h-[500px] w-full">
        <Canvas shadows>
          <Suspense fallback={null}>
            <SceneSetup layout={layout} />
            <BuildingModel layout={layout} />
            {showLabels && <RoomLabels layout={layout} />}
            {showSuggestions && suggestions.length > 0 && (
              <SuggestionHighlights overlays={suggestions} layout={layout} />
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* Footer — confidence + controls hint */}
      <div className="flex items-center justify-between border-t bg-white px-3 py-1.5 rounded-b-lg text-xs text-zinc-500">
        <span>
          Confidence: {(layout.confidence * 100).toFixed(0)}%
          {layout.notes && ` — ${layout.notes}`}
        </span>
        <span>Scroll to zoom · Drag to rotate · Right-drag to pan</span>
      </div>
    </div>
  );
}
