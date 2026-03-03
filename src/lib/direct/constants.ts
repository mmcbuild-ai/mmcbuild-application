import type { TradeType, AustralianState } from "./types";

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  builder: "Builder",
  architect: "Architect",
  structural_engineer: "Structural Engineer",
  certifier: "Building Certifier",
  electrician: "Electrician",
  plumber: "Plumber",
  carpenter: "Carpenter",
  steel_fabricator: "Steel Fabricator",
  clt_specialist: "CLT Specialist",
  modular_manufacturer: "Modular Manufacturer",
  prefab_supplier: "Prefab Supplier",
  facade_specialist: "Facade Specialist",
  sustainability_consultant: "Sustainability Consultant",
  quantity_surveyor: "Quantity Surveyor",
  project_manager: "Project Manager",
  interior_designer: "Interior Designer",
  landscaper: "Landscaper",
  other: "Other",
};

export const STATE_LABELS: Record<AustralianState, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

export const AUSTRALIAN_STATES: AustralianState[] = [
  "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT",
];

export const MMC_SPECIALISATIONS = [
  "Cross-Laminated Timber (CLT)",
  "Modular Construction",
  "Prefab Panels",
  "Structural Insulated Panels (SIPs)",
  "Insulated Concrete Forms (ICF)",
  "3D Printing",
  "Flat Pack",
  "Volumetric Modular",
  "Hybrid Construction",
  "Mass Timber",
  "Prefab Bathrooms/Pods",
  "Steel Frame Modular",
  "Timber Frame Prefab",
] as const;

export const TRADE_TYPES: TradeType[] = Object.keys(TRADE_TYPE_LABELS) as TradeType[];
