/**
 * Generator inputs. The building block mirrors the FR_Procedural_Building
 * modifier interface on FR_Building; the interior block mirrors the
 * FR_Interior_Rooms / FR_Interior_Curtains modifiers on FR_Rooms / FR_Curtains.
 */
export type BalconyType = "existing" | "exterior";
export type DetailPattern = "off" | "same" | "alternate" | "random";
export type DetailStyle = "refends" | "pilasters" | "ornamented";

export interface BuildingParams {
  baysX: number;
  baysY: number;
  floors: number;
  dormers: boolean;
  balcony: BalconyType;
  detailPattern: DetailPattern;
  detailStyle: DetailStyle;
  detailSeed: number;
  detailDepth: number;
  // interiors
  roomSeed: number;
  maxDepth: number;
  curtainSeed: number;
  noCurtainChance: number;
  closedChance: number;
}

/** the values saved in FrenchBuilding.blend */
export function defaultParams(): BuildingParams {
  return {
    baysX: 6,
    baysY: 3,
    floors: 3,
    dormers: true,
    balcony: "exterior",
    detailPattern: "alternate",
    detailStyle: "pilasters",
    detailSeed: 0,
    detailDepth: 1,
    roomSeed: 0,
    maxDepth: 4.6,
    curtainSeed: 0,
    noCurtainChance: 0.3,
    closedChance: 0.32,
  };
}

/** building bounding box in meters (footprint + height to the roof ridge) */
export function buildingSize(p: BuildingParams): { width: number; length: number; height: number } {
  return {
    width: p.baysX * 3 + 2,
    length: p.baysY * 3 + 2,
    height: p.floors * 3.2 + 4.2 + 4.0,
  };
}
