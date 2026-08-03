export const responseColumns = ["Engines", "Trucks", "Squads", "EMS", "Chiefs", "Special Equipment", "Change of Quarters", "Notifications"] as const;

export type BoxCardSeedLayout = {
  signature: string;
  division: string;
  rows: Array<{ alarm: string; cells: string[] }>;
  interdivisional: string[];
};

export type StickneyBoxCardSeed = {
  id: string;
  title: string;
  boxNumber: string;
  address: string;
  documentPage: number;
  effectiveDate: string;
  reviewDate: string;
  accessNotes: string;
  layout: BoxCardSeedLayout;
};

const row = (alarm: string, cells: string[]): BoxCardSeedLayout["rows"][number] => ({
  alarm,
  cells: responseColumns.map((_, index) => cells[index] ?? ""),
});

const layout = (rows: BoxCardSeedLayout["rows"], interdivisional: string[] = ["", "", ""]): BoxCardSeedLayout => ({
  division: "11",
  signature: "Chief Boyajian",
  rows,
  interdivisional: [0, 1, 2].map((index) => interdivisional[index] ?? ""),
});

const stationFrontDoor = "Station location: 6433 W. 43rd Street. Division Knox Box: on front door.";
const stationNextToFrontDoor = "Station location: 6433 W. 43rd Street. Division Knox Box: next to front door.";
const commandVan = "If command requests a command van, contact Oak Park PD for the UASI-Cook County vehicle; if unavailable, contact Division 10, then Division 19.";

export const stickneyBoxCards: StickneyBoxCardSeed[] = [
  {
    id: "sfd-box-300-e", title: "Structure Fire - East of Ridgeland Avenue", boxNumber: "300-E", address: "East of Ridgeland Avenue", documentPage: 1, effectiveDate: "2026-02-01", reviewDate: "2026-01-10",
    accessNotes: `${stationNextToFrontDoor}\nDivision 11 chiefs: use the Blackboard Connect system for chief callback. Pleasantview Rehab may be used when command requests rehab; WSCDC will verify the request on any alarm level. If command requests a command van or rehab, contact Division 10, then Division 19.`,
    layout: layout([
      row("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney\nForest View\nCicero"]),
      row("Full Still (working fire)", ["Berwyn\nForest Park", "Cicero", "Lyons", "Brookfield", "", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("Box", ["River Forest\nNorth Riverside", "Oak Park", "", "", "Division 11 Chiefs*", "Pleasantview Rehab\nAsk command if a command vehicle is required"]),
      row("2nd", ["Bridgeview\nLaGrange Park", "Riverside", "Evergreen Park", "LaGrange"]),
      row("3rd", ["Roberts Park\nPleasantview", "Brookfield"]),
      row("4th", ["Westchester\nHinsdale", "Tri-State"]),
    ], ["Division 12", "Division 9 (Chicago)", ""]),
  },
  {
    id: "sfd-box-300-w", title: "Structure Fire - West of Ridgeland Avenue", boxNumber: "300-W", address: "West of Ridgeland Avenue", documentPage: 2, effectiveDate: "2026-02-01", reviewDate: "2026-04-10",
    accessNotes: `${stationNextToFrontDoor}\nDivision 11 chiefs: use the Blackboard Connect system for chief callback. Pleasantview Rehab may be used when command requests rehab; WSCDC will verify the request on any alarm level. If command requests a command van, contact Division 10.`,
    layout: layout([
      row("Still", ["Stickney\nForest View", "McCook", "", "Stickney", "Stickney\nForest View"]),
      row("Full Still (working fire)", ["Berwyn\nCicero", "Central Stickney", "Lyons", "Brookfield", "Lyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("Box", ["River Forest\nForest Park\nNorth Riverside", "Oak Park", "", "", "Division 11 Chiefs*", "Pleasantview Rehab\nAsk command if a command vehicle is required"]),
      row("2nd", ["Bridgeview\nLaGrange Park", "Riverside", "Evergreen Park", "LaGrange"]),
      row("3rd", ["Roberts Park\nTri-State", "Bedford Park"]),
      row("4th", ["Westchester\nHinsdale", "Pleasantview"]),
    ], ["Division 9 (Chicago)", "Division 12", ""]),
  },
  {
    id: "sfd-box-399", title: "Ambulance (MCI / ASHER)", boxNumber: "399", address: "Entire Village", documentPage: 3, effectiveDate: "2025-03-01", reviewDate: "2025-01-23",
    accessNotes: `${stationFrontDoor}\n${commandVan}\nIf command determines more manpower or equipment is necessary, refer to Fire Box 300-W or 300-E.`,
    layout: layout([
      row("Still", ["Stickney\nForest View", "", "", "Stickney", "Stickney"]), row("Full Still (working fire)", []),
      row("Box", ["", "Central Stickney", "", "Cicero\nForest View\nCentral Stickney\nBerwyn\nLyons", "Forest View\nLyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("2nd", ["", "", "", "North Riverside\nForest Park\nRiverside\nOak Park\nRiver Forest", "Division 11 Chiefs", "Rehab / command van (if needed)"]),
      row("3rd", ["", "", "", "McCook\nMaywood\nBrookfield\nBroadview\nLaGrange"]),
      row("4th", ["", "", "", "Bridgeview\nWestchester\nOak Brook\nPleasantview\nWestern Springs"]),
    ], ["Ambulance Task Force", "", ""]),
  },
  {
    id: "sfd-box-1000", title: "Hazardous Materials", boxNumber: "1000", address: "Entire Town", documentPage: 4, effectiveDate: "2025-03-01", reviewDate: "2025-11-17",
    accessNotes: `${stationFrontDoor}\nDivision 11 chiefs: use the Blackboard Connect notification system. If command requests a command van, contact Division 10.`,
    layout: layout([
      row("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney\nForest View"]),
      row("Full Still (working fire)", ["", "", "", "", "", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("Box", ["Cicero", "", "", "North Riverside", "Division 11*", "Two HazMat personnel from each town\n1100 Command\nBedford Park HazMat Squad\nOperations or technician level\nDecon Unit - Division 19"]),
      row("2nd", ["Lyons", "", "", "", "", "One additional member from a Division 11 department\nDivision 21 HazMat Team"]),
      row("3rd", ["", "", "", "", "", "Ask command if a command vehicle is required\nDivision 10 HazMat Team"]), row("4th", ["", "", "", "", "", "Division 20 HazMat Team"]), row("5th", ["", "", "", "", "", "Division 12 HazMat Team"]),
    ]),
  },
  {
    id: "sfd-box-303-e", title: "Extrication / Pin-In - East of Ridgeland", boxNumber: "303-E", address: "East of Ridgeland Avenue", documentPage: 5, effectiveDate: "2025-03-01", reviewDate: "2025-01-23", accessNotes: `${stationFrontDoor}\n${commandVan}`,
    layout: layout([
      row("Still", ["Stickney", "", "", "Stickney", "Stickney"]), row("Full Still (working fire)", []),
      row("Box", ["Forest View", "Cicero", "Lyons", "Central Stickney\nCicero", "Forest View\nCicero\nLyons", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("2nd", ["", "Berwyn", "", "", "Berwyn", "Additional ambulances: upgrade to Ambulance Box Card 399"]), row("3rd", []), row("4th", []),
    ]),
  },
  {
    id: "sfd-box-303-w", title: "Extrication / Pin-In - West of Ridgeland", boxNumber: "303-W", address: "West of Ridgeland Avenue", documentPage: 6, effectiveDate: "2025-03-01", reviewDate: "2025-01-23", accessNotes: `${stationFrontDoor}\n${commandVan}`,
    layout: layout([
      row("Still", ["Stickney", "", "", "Stickney", "Stickney"]), row("Full Still (working fire)", []),
      row("Box", ["Forest View", "Berwyn", "Lyons", "Riverside\nNorth Riverside", "Forest View\nLyons\nBerwyn", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("2nd", ["", "Cicero", "", "", "", "Additional ambulances: upgrade to Ambulance Box Card 399"]), row("3rd", []), row("4th", []),
    ]),
  },
  {
    id: "sfd-box-305", title: "Technical Rescue", boxNumber: "305", address: "Entire Town", documentPage: 7, effectiveDate: "2025-03-01", reviewDate: "2025-01-17",
    accessNotes: "Station location: 6433 W. 43rd Street. Division Knox Box: near front door.\nDivision 11 chiefs: use the Blackboard Connect notification system. For additional resources, request assistance through Cook County EMA and the statewide deployment plan. If command requests a command van, contact Division 10.",
    layout: layout([
      row("Still", ["Stickney\nForest View", "Central Stickney", "", "Stickney", "Stickney"]),
      row("Full Still (working fire)", ["Lyons\nCicero", "Berwyn", "", "", "Lyons\nCicero", "", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("Box", ["Riverside", "", "", "Cicero\nBerwyn", "Division 11*", "2 TRT personnel from each Division 11 department\n1111 TRT Truck\n1112 TRT Trailer\nRehab Unit"]),
      row("2nd", ["McCook", "", "Bedford Park", "River Forest", "", "All additional Division 11 TRT members\nDivision 20 TRT"]),
      row("3rd", ["Bridgeview", "Brookfield", "", "", "", "Ask command if a command vehicle is required\nDivision 10 TRT"]), row("4th", ["", "", "", "", "", "Division 21 TRT"]),
    ]),
  },
  {
    id: "sfd-box-301", title: "Fire Investigators", boxNumber: "301", address: "Entire Town", documentPage: 8, effectiveDate: "2025-03-01", reviewDate: "2025-01-17",
    accessNotes: `${stationFrontDoor}\n${commandVan}\nCicero FD is primarily responsible for transporting 1105. If unavailable, responsibility passes in order to Forest Park, Berwyn, Oak Park, River Forest, then Stickney.`,
    layout: layout([
      row("Still", []), row("Full Still (working fire)", []),
      row("Box", ["", "", "", "", "One fire investigator from each Division 11 town\nContact Investigators Coordinator", "1105 - upon request\nState Fire Marshal upon request"]),
      row("2nd", ["", "", "", "", "One additional investigator from each Division 11 town", "Ask command if a command vehicle is required"]), row("3rd", []), row("4th", []),
    ], ["Division 10", "", ""]),
  },
  {
    id: "sfd-box-306", title: "Divers", boxNumber: "306", address: "Entire Town", documentPage: 9, effectiveDate: "2025-03-01", reviewDate: "2025-01-17", accessNotes: "Station location: 6433 W. 43rd Street. Division Knox Box: near front door.\nIf command requests a command van, contact Division 10.",
    layout: layout([
      row("Still", ["Stickney\nForest View", "", "", "Stickney", "Stickney"]),
      row("Full Still (working fire)", ["", "", "", "", "Riverside\nLyons", "Lyons & Riverside boats\nNotify Coast Guard", "Summit (Engine)\nBedford Park (Ambulance)"]),
      row("Box", ["Berwyn", "", "", "Cicero", "Division 11", "Division 9 - CFD Dive Team\nDivision 10 Rehab Unit\nAsk command if a command vehicle is required"]),
      row("2nd", ["", "", "", "North Riverside"]), row("3rd", []), row("4th", []), row("5th", []),
    ], ["Division 12 - Under/Swift Water", "", ""]),
  },
];
