/**
 * Minimal ambient declarations for clipper-lib 6.4.2 — covers only the
 * polygon-offset surface used by the v3 roof renderer. The package ships
 * no first-party types.
 */
declare module "clipper-lib" {
  export interface IntPoint {
    X: number;
    Y: number;
  }

  export type Path = IntPoint[];
  export type Paths = Path[];

  export const JoinType: {
    jtSquare: number;
    jtRound: number;
    jtMiter: number;
  };

  export const EndType: {
    etClosedPolygon: number;
    etClosedLine: number;
    etOpenButt: number;
    etOpenSquare: number;
    etOpenRound: number;
  };

  export class ClipperOffset {
    constructor(miterLimit?: number, arcTolerance?: number);
    AddPath(path: Path, joinType: number, endType: number): void;
    AddPaths(paths: Paths, joinType: number, endType: number): void;
    Execute(solution: Paths, delta: number): void;
    Clear(): void;
  }

  export const Clipper: {
    Orientation(poly: Path): boolean;
    Area(poly: Path): number;
  };

  const ClipperLib: {
    JoinType: typeof JoinType;
    EndType: typeof EndType;
    ClipperOffset: typeof ClipperOffset;
    Clipper: typeof Clipper;
  };

  export default ClipperLib;
}
