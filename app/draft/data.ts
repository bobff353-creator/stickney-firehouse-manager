// Fantasy draft advisor — data model, league defaults, and seed projections.
//
// League: "Goodfellas" — 12 teams, NON-PPR (standard) with a few important
// twists read off the roster/scoring screenshots:
//   - Passing TD = 6 pts (unusually high; boosts elite QBs)
//   - Passing yards 1 / 25, INT -2
//   - Rushing & Receiving yards 1 / 10, TD 6, NO points per reception
//   - Fumble lost -2
//   - K: FG 3, 50+ bonus +2, XP 1
//   - DST: points-against tiers + sacks/INT/fum/TD/safety (projected directly)
// Starters (start 8): 1 QB, 2 RB, 2 WR, 1 TE, 1 K, 1 DST. Bench 7 (15 total).
//
// Projections below are a calibrated 2026 preseason baseline (Aug 2026) anchored
// to consensus tiers and published stat lines. EVERYTHING is editable in the app
// and re-scores instantly, so tune any number to NFL.com / ESPN / SportsLine /
// Vegas as you like.

export type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export const POSITIONS: Pos[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export interface PlayerProj {
  id: string;
  name: string;
  team: string;
  pos: Pos;
  // Passing
  passYd?: number;
  passTD?: number;
  int?: number;
  // Rushing
  rushYd?: number;
  rushTD?: number;
  // Receiving
  rec?: number; // receptions — shown for context (non-PPR, not scored)
  recYd?: number;
  recTD?: number;
  // Misc
  fumL?: number;
  // Kicker
  fg?: number; // total field goals made
  fg50?: number; // of those, 50+ yards (each gets +2 bonus)
  xp?: number; // extra points
  // DST — projected season fantasy points under league scoring (entered directly)
  dstPts?: number;
}

export interface Scoring {
  passYdPerPt: number; // yards per 1 point
  passTD: number;
  int: number;
  rushYdPerPt: number;
  rushTD: number;
  recYdPerPt: number;
  recTD: number;
  ppr: number; // points per reception (0 for this league)
  fumLost: number;
  fgPt: number;
  fg50Bonus: number;
  xpPt: number;
}

export interface League {
  teams: number;
  myDraftSlot: number; // 1..teams (snake)
  starters: Record<Pos, number>;
  benchSize: number;
}

// ---- Goodfellas league defaults (from screenshots) --------------------------

export const DEFAULT_SCORING: Scoring = {
  passYdPerPt: 25,
  passTD: 6,
  int: -2,
  rushYdPerPt: 10,
  rushTD: 6,
  recYdPerPt: 10,
  recTD: 6,
  ppr: 0,
  fumLost: -2,
  fgPt: 3,
  fg50Bonus: 2,
  xpPt: 1,
};

export const DEFAULT_LEAGUE: League = {
  teams: 12,
  myDraftSlot: 6,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 },
  benchSize: 7,
};

// Typical full-roster targets (starters + sensible bench) for a 15-man roster.
// Used to taper recommendations once starting slots are filled.
export const ROSTER_TARGETS: Record<Pos, number> = {
  QB: 2,
  RB: 5,
  WR: 5,
  TE: 1,
  K: 1,
  DST: 1,
};

// ---- Seed projections (2026 preseason baseline) -----------------------------

function mk(
  id: string,
  name: string,
  team: string,
  pos: Pos,
  stats: Partial<PlayerProj>,
): PlayerProj {
  return { id, name, team, pos, ...stats };
}

export const SEED_PLAYERS: PlayerProj[] = [
  // ---------------- Quarterbacks ----------------
  mk("qb-allen", "Josh Allen", "BUF", "QB", { passYd: 3950, passTD: 30, int: 8, rushYd: 660, rushTD: 6, fumL: 3 }),
  mk("qb-jackson", "Lamar Jackson", "BAL", "QB", { passYd: 3850, passTD: 31, int: 6, rushYd: 620, rushTD: 5, fumL: 3 }),
  mk("qb-daniels", "Jayden Daniels", "WAS", "QB", { passYd: 3800, passTD: 25, int: 9, rushYd: 660, rushTD: 6, fumL: 4 }),
  mk("qb-burrow", "Joe Burrow", "CIN", "QB", { passYd: 4600, passTD: 38, int: 9, rushYd: 180, rushTD: 2, fumL: 3 }),
  mk("qb-hurts", "Jalen Hurts", "PHI", "QB", { passYd: 3250, passTD: 22, int: 8, rushYd: 600, rushTD: 13, fumL: 3 }),
  mk("qb-mahomes", "Patrick Mahomes", "KC", "QB", { passYd: 4250, passTD: 30, int: 9, rushYd: 340, rushTD: 3, fumL: 3 }),
  mk("qb-mayfield", "Baker Mayfield", "TB", "QB", { passYd: 4200, passTD: 34, int: 12, rushYd: 220, rushTD: 4, fumL: 4 }),
  mk("qb-prescott", "Dak Prescott", "DAL", "QB", { passYd: 4400, passTD: 33, int: 10, rushYd: 150, rushTD: 2, fumL: 3 }),
  mk("qb-goff", "Jared Goff", "DET", "QB", { passYd: 4300, passTD: 32, int: 9, rushYd: 40, rushTD: 1, fumL: 2 }),
  mk("qb-herbert", "Justin Herbert", "LAC", "QB", { passYd: 4150, passTD: 28, int: 10, rushYd: 260, rushTD: 3, fumL: 3 }),
  mk("qb-nix", "Bo Nix", "DEN", "QB", { passYd: 3900, passTD: 28, int: 11, rushYd: 420, rushTD: 4, fumL: 3 }),
  mk("qb-purdy", "Brock Purdy", "SF", "QB", { passYd: 4100, passTD: 29, int: 11, rushYd: 200, rushTD: 3, fumL: 3 }),
  mk("qb-williams", "Caleb Williams", "CHI", "QB", { passYd: 3950, passTD: 27, int: 10, rushYd: 420, rushTD: 3, fumL: 4 }),
  mk("qb-murray", "Kyler Murray", "ARI", "QB", { passYd: 3850, passTD: 25, int: 10, rushYd: 520, rushTD: 5, fumL: 4 }),
  mk("qb-stroud", "C.J. Stroud", "HOU", "QB", { passYd: 4150, passTD: 27, int: 9, rushYd: 220, rushTD: 3, fumL: 3 }),
  mk("qb-fields", "Justin Fields", "NYJ", "QB", { passYd: 3000, passTD: 17, int: 8, rushYd: 720, rushTD: 7, fumL: 5 }),
  mk("qb-maye", "Drake Maye", "NE", "QB", { passYd: 3900, passTD: 24, int: 10, rushYd: 380, rushTD: 3, fumL: 3 }),
  mk("qb-penix", "Michael Penix Jr.", "ATL", "QB", { passYd: 4000, passTD: 26, int: 12, rushYd: 150, rushTD: 2, fumL: 3 }),
  mk("qb-mccarthy", "J.J. McCarthy", "MIN", "QB", { passYd: 3800, passTD: 26, int: 11, rushYd: 250, rushTD: 3, fumL: 3 }),
  mk("qb-lawrence", "Trevor Lawrence", "JAX", "QB", { passYd: 3850, passTD: 24, int: 11, rushYd: 320, rushTD: 3, fumL: 3 }),
  mk("qb-darnold", "Sam Darnold", "SEA", "QB", { passYd: 3850, passTD: 27, int: 11, rushYd: 180, rushTD: 2, fumL: 3 }),
  mk("qb-tua", "Tua Tagovailoa", "MIA", "QB", { passYd: 3900, passTD: 25, int: 10, rushYd: 60, rushTD: 1, fumL: 2 }),

  // ---------------- Running Backs ----------------
  mk("rb-gibbs", "Jahmyr Gibbs", "DET", "RB", { rushYd: 1410, rushTD: 12, rec: 70, recYd: 640, recTD: 4, fumL: 2 }),
  mk("rb-bijan", "Bijan Robinson", "ATL", "RB", { rushYd: 1400, rushTD: 11, rec: 62, recYd: 520, recTD: 3, fumL: 2 }),
  mk("rb-cmc", "Christian McCaffrey", "SF", "RB", { rushYd: 1150, rushTD: 9, rec: 78, recYd: 620, recTD: 3, fumL: 2 }),
  mk("rb-taylor", "Jonathan Taylor", "IND", "RB", { rushYd: 1350, rushTD: 12, rec: 35, recYd: 250, recTD: 1, fumL: 2 }),
  mk("rb-cook", "James Cook", "BUF", "RB", { rushYd: 1180, rushTD: 12, rec: 40, recYd: 300, recTD: 1, fumL: 2 }),
  mk("rb-henry", "Derrick Henry", "BAL", "RB", { rushYd: 1300, rushTD: 13, rec: 12, recYd: 90, recTD: 0, fumL: 2 }),
  mk("rb-jeanty", "Ashton Jeanty", "LV", "RB", { rushYd: 1300, rushTD: 10, rec: 45, recYd: 350, recTD: 2, fumL: 2 }),
  mk("rb-achane", "De'Von Achane", "MIA", "RB", { rushYd: 950, rushTD: 7, rec: 78, recYd: 600, recTD: 3, fumL: 2 }),
  mk("rb-hampton", "Omarion Hampton", "LAC", "RB", { rushYd: 1150, rushTD: 8, rec: 40, recYd: 320, recTD: 1, fumL: 2 }),
  mk("rb-walker", "Kenneth Walker III", "SEA", "RB", { rushYd: 1080, rushTD: 9, rec: 38, recYd: 280, recTD: 1, fumL: 3 }),
  mk("rb-jacobs", "Josh Jacobs", "GB", "RB", { rushYd: 1150, rushTD: 11, rec: 36, recYd: 280, recTD: 1, fumL: 2 }),
  mk("rb-brown", "Chase Brown", "CIN", "RB", { rushYd: 1100, rushTD: 8, rec: 50, recYd: 380, recTD: 2, fumL: 2 }),
  mk("rb-kyren", "Kyren Williams", "LAR", "RB", { rushYd: 1150, rushTD: 11, rec: 34, recYd: 250, recTD: 1, fumL: 3 }),
  mk("rb-irving", "Bucky Irving", "TB", "RB", { rushYd: 1080, rushTD: 7, rec: 55, recYd: 430, recTD: 2, fumL: 2 }),
  mk("rb-hall", "Breece Hall", "NYJ", "RB", { rushYd: 950, rushTD: 6, rec: 52, recYd: 420, recTD: 2, fumL: 2 }),
  mk("rb-conner", "James Conner", "ARI", "RB", { rushYd: 1000, rushTD: 9, rec: 40, recYd: 320, recTD: 1, fumL: 2 }),
  mk("rb-kamara", "Alvin Kamara", "NO", "RB", { rushYd: 850, rushTD: 6, rec: 60, recYd: 480, recTD: 2, fumL: 2 }),
  mk("rb-mixon", "Joe Mixon", "HOU", "RB", { rushYd: 1050, rushTD: 9, rec: 40, recYd: 300, recTD: 1, fumL: 2 }),
  mk("rb-hubbard", "Chuba Hubbard", "CAR", "RB", { rushYd: 1050, rushTD: 8, rec: 40, recYd: 300, recTD: 1, fumL: 2 }),
  mk("rb-henderson", "TreVeyon Henderson", "NE", "RB", { rushYd: 900, rushTD: 7, rec: 40, recYd: 320, recTD: 2, fumL: 1 }),
  mk("rb-pacheco", "Isiah Pacheco", "KC", "RB", { rushYd: 850, rushTD: 7, rec: 30, recYd: 220, recTD: 1, fumL: 2 }),
  mk("rb-swift", "D'Andre Swift", "CHI", "RB", { rushYd: 900, rushTD: 6, rec: 42, recYd: 320, recTD: 1, fumL: 2 }),
  mk("rb-harvey", "RJ Harvey", "DEN", "RB", { rushYd: 850, rushTD: 7, rec: 35, recYd: 280, recTD: 2, fumL: 1 }),
  mk("rb-jones", "Aaron Jones", "MIN", "RB", { rushYd: 850, rushTD: 5, rec: 45, recYd: 360, recTD: 2, fumL: 2 }),
  mk("rb-pollard", "Tony Pollard", "TEN", "RB", { rushYd: 900, rushTD: 6, rec: 40, recYd: 300, recTD: 1, fumL: 2 }),
  mk("rb-kaleb", "Kaleb Johnson", "PIT", "RB", { rushYd: 900, rushTD: 8, rec: 25, recYd: 180, recTD: 1, fumL: 1 }),
  mk("rb-judkins", "Quinshon Judkins", "CLE", "RB", { rushYd: 850, rushTD: 6, rec: 25, recYd: 180, recTD: 1, fumL: 2 }),
  mk("rb-warren", "Jaylen Warren", "PIT", "RB", { rushYd: 700, rushTD: 4, rec: 45, recYd: 360, recTD: 1, fumL: 1 }),
  mk("rb-brobinson", "Brian Robinson Jr.", "WAS", "RB", { rushYd: 850, rushTD: 8, rec: 25, recYd: 180, recTD: 1, fumL: 2 }),
  mk("rb-tracy", "Tyrone Tracy Jr.", "NYG", "RB", { rushYd: 800, rushTD: 5, rec: 40, recYd: 300, recTD: 1, fumL: 2 }),
  mk("rb-etienne", "Travis Etienne Jr.", "JAX", "RB", { rushYd: 800, rushTD: 5, rec: 35, recYd: 260, recTD: 1, fumL: 2 }),
  mk("rb-mason", "Jordan Mason", "MIN", "RB", { rushYd: 800, rushTD: 6, rec: 20, recYd: 150, recTD: 0, fumL: 1 }),
  mk("rb-skattebo", "Cam Skattebo", "NYG", "RB", { rushYd: 700, rushTD: 6, rec: 30, recYd: 220, recTD: 1, fumL: 2 }),
  mk("rb-stevenson", "Rhamondre Stevenson", "NE", "RB", { rushYd: 750, rushTD: 5, rec: 30, recYd: 220, recTD: 1, fumL: 2 }),
  mk("rb-charbonnet", "Zach Charbonnet", "SEA", "RB", { rushYd: 600, rushTD: 6, rec: 30, recYd: 240, recTD: 1, fumL: 1 }),
  mk("rb-javonte", "Javonte Williams", "DAL", "RB", { rushYd: 750, rushTD: 5, rec: 30, recYd: 220, recTD: 1, fumL: 2 }),
  mk("rb-najee", "Najee Harris", "LAC", "RB", { rushYd: 700, rushTD: 5, rec: 25, recYd: 180, recTD: 1, fumL: 2 }),
  mk("rb-benson", "Trey Benson", "ARI", "RB", { rushYd: 650, rushTD: 5, rec: 25, recYd: 190, recTD: 1, fumL: 1 }),
  mk("rb-white", "Rachaad White", "TB", "RB", { rushYd: 500, rushTD: 4, rec: 40, recYd: 320, recTD: 1, fumL: 1 }),
  mk("rb-chubb", "Nick Chubb", "HOU", "RB", { rushYd: 600, rushTD: 5, rec: 15, recYd: 100, recTD: 0, fumL: 1 }),
  mk("rb-spears", "Tyjae Spears", "TEN", "RB", { rushYd: 550, rushTD: 4, rec: 30, recYd: 240, recTD: 1, fumL: 1 }),
  mk("rb-tuten", "Bhayshul Tuten", "JAX", "RB", { rushYd: 550, rushTD: 4, rec: 20, recYd: 160, recTD: 0, fumL: 1 }),
  mk("rb-bigsby", "Tank Bigsby", "JAX", "RB", { rushYd: 650, rushTD: 5, rec: 15, recYd: 100, recTD: 0, fumL: 1 }),
  mk("rb-blue", "Jaydon Blue", "DAL", "RB", { rushYd: 500, rushTD: 4, rec: 30, recYd: 240, recTD: 1, fumL: 1 }),
  mk("rb-allen", "Braelon Allen", "NYJ", "RB", { rushYd: 500, rushTD: 4, rec: 20, recYd: 150, recTD: 0, fumL: 1 }),
  mk("rb-ford", "Jerome Ford", "CLE", "RB", { rushYd: 450, rushTD: 3, rec: 30, recYd: 240, recTD: 0, fumL: 1 }),
  mk("rb-corum", "Blake Corum", "LAR", "RB", { rushYd: 400, rushTD: 3, rec: 20, recYd: 150, recTD: 0, fumL: 1 }),
  mk("rb-guerendo", "Isaac Guerendo", "SF", "RB", { rushYd: 450, rushTD: 3, rec: 20, recYd: 160, recTD: 0, fumL: 1 }),
  mk("rb-sampson", "Dylan Sampson", "CLE", "RB", { rushYd: 400, rushTD: 3, rec: 25, recYd: 190, recTD: 0, fumL: 1 }),
  mk("rb-davis", "Ray Davis", "BUF", "RB", { rushYd: 400, rushTD: 3, rec: 20, recYd: 150, recTD: 0, fumL: 1 }),

  // ---------------- Wide Receivers ----------------
  mk("wr-chase", "Ja'Marr Chase", "CIN", "WR", { rec: 95, recYd: 1450, recTD: 12, fumL: 1 }),
  mk("wr-jefferson", "Justin Jefferson", "MIN", "WR", { rec: 95, recYd: 1350, recTD: 9, fumL: 1 }),
  mk("wr-lamb", "CeeDee Lamb", "DAL", "WR", { rec: 100, recYd: 1400, recTD: 9, fumL: 1 }),
  mk("wr-nacua", "Puka Nacua", "LAR", "WR", { rec: 100, recYd: 1350, recTD: 7, fumL: 1 }),
  mk("wr-nabers", "Malik Nabers", "NYG", "WR", { rec: 100, recYd: 1300, recTD: 8, fumL: 1 }),
  mk("wr-arsb", "Amon-Ra St. Brown", "DET", "WR", { rec: 105, recYd: 1250, recTD: 10, fumL: 1 }),
  mk("wr-collins", "Nico Collins", "HOU", "WR", { rec: 85, recYd: 1300, recTD: 8, fumL: 1 }),
  mk("wr-btj", "Brian Thomas Jr.", "JAX", "WR", { rec: 85, recYd: 1300, recTD: 9, fumL: 1 }),
  mk("wr-london", "Drake London", "ATL", "WR", { rec: 95, recYd: 1250, recTD: 9, fumL: 1 }),
  mk("wr-ajbrown", "A.J. Brown", "PHI", "WR", { rec: 80, recYd: 1250, recTD: 8, fumL: 1 }),
  mk("wr-rice", "Rashee Rice", "KC", "WR", { rec: 99, recYd: 1099, recTD: 10, fumL: 1 }),
  mk("wr-jsn", "Jaxon Smith-Njigba", "SEA", "WR", { rec: 90, recYd: 1150, recTD: 6, fumL: 1 }),
  mk("wr-mcconkey", "Ladd McConkey", "LAC", "WR", { rec: 90, recYd: 1150, recTD: 6, fumL: 1 }),
  mk("wr-higgins", "Tee Higgins", "CIN", "WR", { rec: 80, recYd: 1100, recTD: 9, fumL: 1 }),
  mk("wr-hill", "Tyreek Hill", "MIA", "WR", { rec: 85, recYd: 1150, recTD: 7, fumL: 1 }),
  mk("wr-gwilson", "Garrett Wilson", "NYJ", "WR", { rec: 90, recYd: 1150, recTD: 7, fumL: 1 }),
  mk("wr-mhj", "Marvin Harrison Jr.", "ARI", "WR", { rec: 80, recYd: 1150, recTD: 9, fumL: 1 }),
  mk("wr-mclaurin", "Terry McLaurin", "WAS", "WR", { rec: 80, recYd: 1100, recTD: 9, fumL: 1 }),
  mk("wr-adams", "Davante Adams", "LAR", "WR", { rec: 80, recYd: 1050, recTD: 9, fumL: 1 }),
  mk("wr-metcalf", "DK Metcalf", "PIT", "WR", { rec: 70, recYd: 1050, recTD: 8, fumL: 1 }),
  mk("wr-devonta", "DeVonta Smith", "PHI", "WR", { rec: 80, recYd: 1050, recTD: 7, fumL: 1 }),
  mk("wr-worthy", "Xavier Worthy", "KC", "WR", { rec: 80, recYd: 1050, recTD: 7, fumL: 1 }),
  mk("wr-egbuka", "Emeka Egbuka", "TB", "WR", { rec: 78, recYd: 1050, recTD: 7, fumL: 1 }),
  mk("wr-sutton", "Courtland Sutton", "DEN", "WR", { rec: 75, recYd: 1000, recTD: 8, fumL: 1 }),
  mk("wr-flowers", "Zay Flowers", "BAL", "WR", { rec: 82, recYd: 1050, recTD: 6, fumL: 1 }),
  mk("wr-pickens", "George Pickens", "DAL", "WR", { rec: 72, recYd: 1050, recTD: 7, fumL: 1 }),
  mk("wr-waddle", "Jaylen Waddle", "MIA", "WR", { rec: 80, recYd: 1000, recTD: 6, fumL: 1 }),
  mk("wr-jamesonw", "Jameson Williams", "DET", "WR", { rec: 65, recYd: 1000, recTD: 7, fumL: 1 }),
  mk("wr-odunze", "Rome Odunze", "CHI", "WR", { rec: 75, recYd: 1000, recTD: 7, fumL: 1 }),
  mk("wr-djmoore", "DJ Moore", "CHI", "WR", { rec: 82, recYd: 1000, recTD: 6, fumL: 1 }),
  mk("wr-evans", "Mike Evans", "TB", "WR", { rec: 65, recYd: 950, recTD: 9, fumL: 1 }),
  mk("wr-olave", "Chris Olave", "NO", "WR", { rec: 80, recYd: 1000, recTD: 5, fumL: 1 }),
  mk("wr-ridley", "Calvin Ridley", "TEN", "WR", { rec: 75, recYd: 1000, recTD: 6, fumL: 1 }),
  mk("wr-tmcmillan", "Tetairoa McMillan", "CAR", "WR", { rec: 70, recYd: 900, recTD: 6, fumL: 1 }),
  mk("wr-addison", "Jordan Addison", "MIN", "WR", { rec: 72, recYd: 950, recTD: 7, fumL: 1 }),
  mk("wr-pittman", "Michael Pittman Jr.", "IND", "WR", { rec: 72, recYd: 800, recTD: 6, fumL: 1 }),
  mk("wr-jeudy", "Jerry Jeudy", "CLE", "WR", { rec: 75, recYd: 950, recTD: 5, fumL: 1 }),
  mk("wr-pearsall", "Ricky Pearsall", "SF", "WR", { rec: 72, recYd: 950, recTD: 6, fumL: 1 }),
  mk("wr-jennings", "Jauan Jennings", "SF", "WR", { rec: 75, recYd: 900, recTD: 6, fumL: 1 }),
  mk("wr-hunter", "Travis Hunter", "JAX", "WR", { rec: 70, recYd: 900, recTD: 6, fumL: 1 }),
  mk("wr-godwin", "Chris Godwin", "TB", "WR", { rec: 75, recYd: 850, recTD: 5, fumL: 1 }),
  mk("wr-diggs", "Stefon Diggs", "NE", "WR", { rec: 78, recYd: 900, recTD: 6, fumL: 1 }),
  mk("wr-shakir", "Khalil Shakir", "BUF", "WR", { rec: 78, recYd: 900, recTD: 4, fumL: 1 }),
  mk("wr-deebo", "Deebo Samuel", "WAS", "WR", { rec: 65, recYd: 850, recTD: 5, rushYd: 200, rushTD: 2, fumL: 2 }),
  mk("wr-golden", "Matthew Golden", "GB", "WR", { rec: 62, recYd: 850, recTD: 6, fumL: 1 }),
  mk("wr-coleman", "Keon Coleman", "BUF", "WR", { rec: 60, recYd: 850, recTD: 7, fumL: 1 }),
  mk("wr-meyers", "Jakobi Meyers", "LV", "WR", { rec: 78, recYd: 900, recTD: 5, fumL: 1 }),
  mk("wr-kupp", "Cooper Kupp", "SEA", "WR", { rec: 78, recYd: 850, recTD: 5, fumL: 1 }),
  mk("wr-reed", "Jayden Reed", "GB", "WR", { rec: 60, recYd: 800, recTD: 6, fumL: 1 }),
  mk("wr-downs", "Josh Downs", "IND", "WR", { rec: 70, recYd: 800, recTD: 5, fumL: 1 }),
  mk("wr-jhiggins", "Jayden Higgins", "HOU", "WR", { rec: 62, recYd: 800, recTD: 5, fumL: 1 }),
  mk("wr-mims", "Marvin Mims Jr.", "DEN", "WR", { rec: 55, recYd: 750, recTD: 6, fumL: 1 }),
  mk("wr-wandale", "Wan'Dale Robinson", "NYG", "WR", { rec: 82, recYd: 750, recTD: 3, fumL: 1 }),
  mk("wr-mooney", "Darnell Mooney", "ATL", "WR", { rec: 58, recYd: 800, recTD: 5, fumL: 1 }),
  mk("wr-kirk", "Christian Kirk", "HOU", "WR", { rec: 65, recYd: 750, recTD: 5, fumL: 1 }),
  mk("wr-qjohnston", "Quentin Johnston", "LAC", "WR", { rec: 55, recYd: 750, recTD: 7, fumL: 1 }),
  mk("wr-bateman", "Rashod Bateman", "BAL", "WR", { rec: 50, recYd: 700, recTD: 6, fumL: 1 }),
  mk("wr-legette", "Xavier Legette", "CAR", "WR", { rec: 55, recYd: 700, recTD: 4, fumL: 1 }),
  mk("wr-tharris", "Tre Harris", "LAC", "WR", { rec: 55, recYd: 700, recTD: 5, fumL: 1 }),
  mk("wr-kwilliams", "Kyle Williams", "NE", "WR", { rec: 55, recYd: 700, recTD: 4, fumL: 1 }),
  mk("wr-tillman", "Cedric Tillman", "CLE", "WR", { rec: 60, recYd: 700, recTD: 5, fumL: 1 }),
  mk("wr-doubs", "Romeo Doubs", "GB", "WR", { rec: 55, recYd: 700, recTD: 5, fumL: 1 }),
  mk("wr-mitchell", "Adonai Mitchell", "IND", "WR", { rec: 50, recYd: 650, recTD: 5, fumL: 1 }),
  mk("wr-shaheed", "Rashid Shaheed", "NO", "WR", { rec: 55, recYd: 800, recTD: 5, fumL: 1 }),
  mk("wr-bech", "Jack Bech", "LV", "WR", { rec: 52, recYd: 650, recTD: 4, fumL: 1 }),

  // ---------------- Tight Ends ----------------
  mk("te-bowers", "Brock Bowers", "LV", "TE", { rec: 90, recYd: 1050, recTD: 7, fumL: 1 }),
  mk("te-mcbride", "Trey McBride", "ARI", "TE", { rec: 100, recYd: 1000, recTD: 6, fumL: 1 }),
  mk("te-laporta", "Sam LaPorta", "DET", "TE", { rec: 70, recYd: 800, recTD: 7, fumL: 1 }),
  mk("te-kittle", "George Kittle", "SF", "TE", { rec: 65, recYd: 800, recTD: 7, fumL: 1 }),
  mk("te-hock", "T.J. Hockenson", "MIN", "TE", { rec: 75, recYd: 800, recTD: 5, fumL: 1 }),
  mk("te-andrews", "Mark Andrews", "BAL", "TE", { rec: 60, recYd: 700, recTD: 7, fumL: 1 }),
  mk("te-njoku", "David Njoku", "CLE", "TE", { rec: 65, recYd: 700, recTD: 5, fumL: 1 }),
  mk("te-kelce", "Travis Kelce", "KC", "TE", { rec: 70, recYd: 700, recTD: 5, fumL: 1 }),
  mk("te-kraft", "Tucker Kraft", "GB", "TE", { rec: 55, recYd: 700, recTD: 7, fumL: 1 }),
  mk("te-engram", "Evan Engram", "DEN", "TE", { rec: 70, recYd: 700, recTD: 4, fumL: 1 }),
  mk("te-warren", "Tyler Warren", "IND", "TE", { rec: 58, recYd: 650, recTD: 5, fumL: 1 }),
  mk("te-loveland", "Colston Loveland", "CHI", "TE", { rec: 55, recYd: 650, recTD: 5, fumL: 1 }),
  mk("te-ferguson", "Jake Ferguson", "DAL", "TE", { rec: 65, recYd: 650, recTD: 4, fumL: 1 }),
  mk("te-kincaid", "Dalton Kincaid", "BUF", "TE", { rec: 55, recYd: 600, recTD: 5, fumL: 1 }),
  mk("te-goedert", "Dallas Goedert", "PHI", "TE", { rec: 50, recYd: 550, recTD: 5, fumL: 1 }),
  mk("te-pitts", "Kyle Pitts", "ATL", "TE", { rec: 55, recYd: 600, recTD: 4, fumL: 1 }),
  mk("te-hhenry", "Hunter Henry", "NE", "TE", { rec: 60, recYd: 600, recTD: 4, fumL: 1 }),
  mk("te-likely", "Isaiah Likely", "BAL", "TE", { rec: 45, recYd: 500, recTD: 4, fumL: 1 }),
  mk("te-strange", "Brenton Strange", "JAX", "TE", { rec: 50, recYd: 550, recTD: 3, fumL: 1 }),
  mk("te-ertz", "Zach Ertz", "WAS", "TE", { rec: 55, recYd: 550, recTD: 5, fumL: 1 }),

  // ---------------- Kickers ----------------
  mk("k-aubrey", "Brandon Aubrey", "DAL", "K", { fg: 36, fg50: 10, xp: 45 }),
  mk("k-dicker", "Cameron Dicker", "LAC", "K", { fg: 34, fg50: 6, xp: 44 }),
  mk("k-fairbairn", "Ka'imi Fairbairn", "HOU", "K", { fg: 34, fg50: 6, xp: 40 }),
  mk("k-boswell", "Chris Boswell", "PIT", "K", { fg: 33, fg50: 6, xp: 38 }),
  mk("k-little", "Cam Little", "JAX", "K", { fg: 32, fg50: 7, xp: 38 }),
  mk("k-bates", "Jake Bates", "DET", "K", { fg: 32, fg50: 6, xp: 48 }),
  mk("k-loop", "Tyler Loop", "BAL", "K", { fg: 31, fg50: 5, xp: 44 }),
  mk("k-myers", "Jason Myers", "SEA", "K", { fg: 31, fg50: 4, xp: 42 }),
  mk("k-mclaughlin", "Chase McLaughlin", "TB", "K", { fg: 31, fg50: 4, xp: 42 }),
  mk("k-reichard", "Will Reichard", "MIN", "K", { fg: 30, fg50: 4, xp: 44 }),
  mk("k-lutz", "Wil Lutz", "DEN", "K", { fg: 31, fg50: 4, xp: 42 }),
  mk("k-butker", "Harrison Butker", "KC", "K", { fg: 30, fg50: 4, xp: 42 }),
  mk("k-mcpherson", "Evan McPherson", "CIN", "K", { fg: 29, fg50: 5, xp: 44 }),
  mk("k-koo", "Younghoe Koo", "ATL", "K", { fg: 29, fg50: 4, xp: 40 }),

  // ---------------- Defense / Special Teams ----------------
  mk("dst-den", "Broncos D/ST", "DEN", "DST", { dstPts: 165 }),
  mk("dst-hou", "Texans D/ST", "HOU", "DST", { dstPts: 155 }),
  mk("dst-phi", "Eagles D/ST", "PHI", "DST", { dstPts: 150 }),
  mk("dst-min", "Vikings D/ST", "MIN", "DST", { dstPts: 145 }),
  mk("dst-bal", "Ravens D/ST", "BAL", "DST", { dstPts: 142 }),
  mk("dst-pit", "Steelers D/ST", "PIT", "DST", { dstPts: 140 }),
  mk("dst-buf", "Bills D/ST", "BUF", "DST", { dstPts: 138 }),
  mk("dst-det", "Lions D/ST", "DET", "DST", { dstPts: 132 }),
  mk("dst-gb", "Packers D/ST", "GB", "DST", { dstPts: 130 }),
  mk("dst-kc", "Chiefs D/ST", "KC", "DST", { dstPts: 128 }),
  mk("dst-sea", "Seahawks D/ST", "SEA", "DST", { dstPts: 126 }),
  mk("dst-lac", "Chargers D/ST", "LAC", "DST", { dstPts: 124 }),
  mk("dst-ari", "Cardinals D/ST", "ARI", "DST", { dstPts: 120 }),
  mk("dst-cle", "Browns D/ST", "CLE", "DST", { dstPts: 118 }),
  mk("dst-was", "Commanders D/ST", "WAS", "DST", { dstPts: 116 }),
  mk("dst-tb", "Buccaneers D/ST", "TB", "DST", { dstPts: 114 }),
];
