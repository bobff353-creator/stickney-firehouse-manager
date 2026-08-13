const NHTSA_VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export type VinDecode = {
  vin: string;
  modelYear: string;
  make: string;
  manufacturer: string;
  model: string;
  series: string;
  trim: string;
  bodyClass: string;
  vehicleType: string;
  cabType: string;
  engineManufacturer: string;
  engineModel: string;
  engineConfiguration: string;
  engineCylinders: string;
  displacementLiters: string;
  fuelTypePrimary: string;
  driveType: string;
  transmissionStyle: string;
  transmissionSpeeds: string;
  gvwr: string;
  brakeSystemType: string;
  plantCompanyName: string;
  plantCity: string;
  plantState: string;
  plantCountry: string;
  decodeMessage: string;
  sourceName: string;
  sourceUrl: string;
  decodedAt: string;
};

function value(row: Record<string, unknown>, key: string) {
  const current = row[key];
  return typeof current === "string" ? current.trim() : current == null ? "" : String(current);
}

export function normalizeVin(input: unknown) {
  return typeof input === "string" ? input.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export function parseVpicResult(vin: string, row: Record<string, unknown>): VinDecode {
  // A blank vPIC field means NHTSA did not report it; it does not prove the feature is absent.
  return {
    vin,
    modelYear: value(row, "ModelYear"),
    make: value(row, "Make"),
    manufacturer: value(row, "Manufacturer"),
    model: value(row, "Model"),
    series: value(row, "Series"),
    trim: value(row, "Trim"),
    bodyClass: value(row, "BodyClass"),
    vehicleType: value(row, "VehicleType"),
    cabType: value(row, "CabType") || value(row, "BodyCabType"),
    engineManufacturer: value(row, "EngineManufacturer"),
    engineModel: value(row, "EngineModel"),
    engineConfiguration: value(row, "EngineConfiguration"),
    engineCylinders: value(row, "EngineCylinders"),
    displacementLiters: value(row, "DisplacementL"),
    fuelTypePrimary: value(row, "FuelTypePrimary"),
    driveType: value(row, "DriveType"),
    transmissionStyle: value(row, "TransmissionStyle"),
    transmissionSpeeds: value(row, "TransmissionSpeeds"),
    gvwr: value(row, "GVWR"),
    brakeSystemType: value(row, "BrakeSystemType"),
    plantCompanyName: value(row, "PlantCompanyName"),
    plantCity: value(row, "PlantCity"),
    plantState: value(row, "PlantState"),
    plantCountry: value(row, "PlantCountry"),
    decodeMessage: value(row, "ErrorText"),
    sourceName: "NHTSA vPIC",
    sourceUrl: "https://vpic.nhtsa.dot.gov/decoder/",
    decodedAt: new Date().toISOString(),
  };
}

export async function decodeVinWithVpic(input: unknown) {
  const vin = normalizeVin(input);
  if (!isValidVin(vin)) {
    throw new Error("Enter or scan a valid 17-character VIN. The letters I, O, and Q are not used in VINs.");
  }
  const response = await fetch(
    `${NHTSA_VPIC_BASE}/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
    { cache: "no-store", signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok) throw new Error("The official NHTSA VIN service is temporarily unavailable.");
  const payload = await response.json() as { Results?: Array<Record<string, unknown>> };
  const row = payload.Results?.[0];
  if (!row) throw new Error("NHTSA did not return a VIN record.");
  const decoded = parseVpicResult(vin, row);
  if (!decoded.make && !decoded.manufacturer && !decoded.model && !decoded.modelYear) {
    throw new Error(decoded.decodeMessage || "NHTSA could not identify this VIN. Confirm every character and try again.");
  }
  return decoded;
}
