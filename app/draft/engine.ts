// Value engine for the draft advisor.
//
// The core idea: raw projected stats are scored with YOUR league's rules, then
// each player is measured by Value Over Replacement (VOR) — how much better they
// are than the "replacement-level" player at their position (the guy you could
// get for free late). VOR is what makes cross-position comparison fair: a QB who
// scores 400 raw points isn't more valuable than a RB who scores 300 if every
// QB scores ~360 and replacement RBs score ~130.
//
// Everything is computed DYNAMICALLY against the players still available, so as
// people get drafted the replacement level rises and scarcity shows up in real
// time — that's the "drop-off" the advisor keys on.

import {
  League,
  PlayerProj,
  Pos,
  POSITIONS,
  ROSTER_TARGETS,
  Scoring,
} from "./data";

export function projectedPoints(p: PlayerProj, s: Scoring): number {
  if (p.pos === "DST") return p.dstPts ?? 0;
  if (p.pos === "K") {
    const fg = p.fg ?? 0;
    const fg50 = p.fg50 ?? 0;
    const xp = p.xp ?? 0;
    return round1(fg * s.fgPt + fg50 * s.fg50Bonus + xp * s.xpPt);
  }
  let pts = 0;
  pts += (p.passYd ?? 0) / s.passYdPerPt;
  pts += (p.passTD ?? 0) * s.passTD;
  pts += (p.int ?? 0) * s.int;
  pts += (p.rushYd ?? 0) / s.rushYdPerPt;
  pts += (p.rushTD ?? 0) * s.rushTD;
  pts += (p.recYd ?? 0) / s.recYdPerPt;
  pts += (p.recTD ?? 0) * s.recTD;
  pts += (p.rec ?? 0) * s.ppr;
  pts += (p.fumL ?? 0) * s.fumLost;
  return round1(pts);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// League-wide starting demand at a position = teams * starters-per-team.
// This is the classic replacement rank used for VBD/VOR.
export function replacementRank(pos: Pos, league: League): number {
  return league.teams * (league.starters[pos] ?? 0);
}

export interface Scored extends PlayerProj {
  pts: number;
  vor: number; // pts - replacement pts at this position (dynamic)
  posRankAvail: number; // rank among AVAILABLE players at this position (1 = best)
  dropToNext: number; // pts lost stepping down to the next available player at pos
  tier: number; // tier within position (1 = top), based on value cliffs
}

export interface PosSummary {
  pos: Pos;
  bestAvail: Scored | null;
  bestVor: number;
  replacementPts: number;
  dropToNext: number; // cliff right below the best available
  availCount: number;
  // Estimated best-available value at YOUR next pick (scarcity of waiting)
  nextPickBestVor: number;
  waitCost: number; // bestVor - nextPickBestVor (how much value you lose by waiting)
}

export interface DraftState {
  // player id -> "me" | "other"
  taken: Record<string, "me" | "other">;
}

// Score every AVAILABLE player, compute dynamic replacement + VOR + drop-offs.
export function scoreAvailable(
  players: PlayerProj[],
  scoring: Scoring,
  league: League,
  taken: Record<string, "me" | "other">,
): Scored[] {
  const avail = players.filter((p) => !taken[p.id]);

  // Group available by position, sorted by projected points desc.
  const byPos: Record<Pos, PlayerProj[]> = {
    QB: [], RB: [], WR: [], TE: [], K: [], DST: [],
  };
  for (const p of avail) byPos[p.pos].push(p);
  for (const pos of POSITIONS) {
    byPos[pos].sort((a, b) => projectedPoints(b, scoring) - projectedPoints(a, scoring));
  }

  // Replacement points per position: the projected points of the player at the
  // league-wide starter-demand rank, measured among players still available.
  const replacementPts: Record<Pos, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0,
  };
  for (const pos of POSITIONS) {
    const list = byPos[pos];
    const rank = Math.max(1, replacementRank(pos, league));
    // clamp to the last available player if the pool is thin
    const idx = Math.min(rank - 1, list.length - 1);
    replacementPts[pos] = idx >= 0 ? projectedPoints(list[idx], scoring) : 0;
  }

  const scored: Scored[] = [];
  for (const pos of POSITIONS) {
    const list = byPos[pos];
    // Build value cliffs -> tiers: a new tier starts when the drop from the
    // previous player exceeds a position-scaled threshold.
    const vals = list.map((p) => projectedPoints(p, scoring));
    const cliff = tierThreshold(pos);
    let tier = 1;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const pts = vals[i];
      const nextPts = i + 1 < vals.length ? vals[i + 1] : pts;
      const dropToNext = round1(pts - nextPts);
      if (i > 0 && vals[i - 1] - pts > cliff) tier++;
      scored.push({
        ...p,
        pts,
        vor: round1(pts - replacementPts[pos]),
        posRankAvail: i + 1,
        dropToNext,
        tier,
      });
    }
  }

  scored.sort((a, b) => b.vor - a.vor);
  return scored;
}

// Position-scaled value gap that separates tiers (in fantasy points).
function tierThreshold(pos: Pos): number {
  switch (pos) {
    case "QB": return 22;
    case "RB": return 18;
    case "WR": return 16;
    case "TE": return 16;
    case "K": return 6;
    case "DST": return 8;
  }
}

// ---- Snake draft pick timing ------------------------------------------------

// Overall pick numbers (1-indexed) that belong to me, given a snake order.
export function myPickNumbers(league: League, rounds: number): number[] {
  const picks: number[] = [];
  const t = league.teams;
  const slot = clamp(league.myDraftSlot, 1, t);
  for (let r = 1; r <= rounds; r++) {
    const pick = r % 2 === 1 ? (r - 1) * t + slot : (r - 1) * t + (t - slot + 1);
    picks.push(pick);
  }
  return picks;
}

// How many picks until my next turn, given how many total picks have been made.
export function picksUntilMyNext(league: League, totalPicksMade: number): number {
  const rounds = league.starters.QB + 20; // plenty
  const mine = myPickNumbers(league, rounds);
  const currentPick = totalPicksMade + 1; // the pick about to happen
  const next = mine.find((p) => p >= currentPick);
  if (next == null) return 0;
  return next - currentPick; // 0 = it's my pick right now
}

export function myNextPickInfo(
  league: League,
  totalPicksMade: number,
): { round: number; pickInRound: number; overall: number; picksAway: number } {
  const rounds = league.starters.QB + 24;
  const mine = myPickNumbers(league, rounds);
  const currentPick = totalPicksMade + 1;
  const overall = mine.find((p) => p >= currentPick) ?? currentPick;
  const round = Math.ceil(overall / league.teams);
  const pickInRound = overall - (round - 1) * league.teams;
  return { round, pickInRound, overall, picksAway: overall - currentPick };
}

// ---- Roster + needs ---------------------------------------------------------

export interface RosterInfo {
  counts: Record<Pos, number>;
  startersFilled: Record<Pos, number>;
  startersNeeded: Record<Pos, number>;
  totalDrafted: number;
}

export function myRoster(
  players: PlayerProj[],
  taken: Record<string, "me" | "other">,
  league: League,
): RosterInfo {
  const counts: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  let totalDrafted = 0;
  for (const p of players) {
    if (taken[p.id] === "me") {
      counts[p.pos]++;
      totalDrafted++;
    }
  }
  const startersFilled: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  const startersNeeded: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const pos of POSITIONS) {
    startersFilled[pos] = Math.min(counts[pos], league.starters[pos]);
    startersNeeded[pos] = Math.max(0, league.starters[pos] - counts[pos]);
  }
  return { counts, startersFilled, startersNeeded, totalDrafted };
}

// ---- Position summaries (strength + scarcity of waiting) --------------------

export function positionSummaries(
  scored: Scored[],
  league: League,
  taken: Record<string, "me" | "other">,
): PosSummary[] {
  const totalPicksMade = Object.keys(taken).length;
  const gap = picksUntilMyNext(league, totalPicksMade); // players taken before my next pick

  // Approximate who survives to my next pick: assume the top `gap` available
  // players by VOR get taken. Everyone ranked beyond that is "likely available."
  const orderedByVor = [...scored].sort((a, b) => b.vor - a.vor);
  const survivorIds = new Set(orderedByVor.slice(gap).map((p) => p.id));

  const summaries: PosSummary[] = [];
  for (const pos of POSITIONS) {
    const list = scored
      .filter((p) => p.pos === pos)
      .sort((a, b) => b.vor - a.vor);
    const best = list[0] ?? null;
    const nextBestSurvivor = list.find((p) => survivorIds.has(p.id)) ?? null;
    const bestVor = best ? best.vor : 0;
    const nextPickBestVor = nextBestSurvivor ? nextBestSurvivor.vor : 0;
    summaries.push({
      pos,
      bestAvail: best,
      bestVor,
      replacementPts: best ? round1(best.pts - best.vor) : 0,
      dropToNext: best ? best.dropToNext : 0,
      availCount: list.length,
      nextPickBestVor,
      waitCost: round1(bestVor - nextPickBestVor),
    });
  }
  return summaries;
}

// ---- Recommendations --------------------------------------------------------

export interface Recommendation {
  player: Scored;
  score: number; // ranking score (need-adjusted value)
  needFactor: number;
  reasons: string[];
}

export function recommend(
  scored: Scored[],
  league: League,
  roster: RosterInfo,
  summaries: PosSummary[],
  limit = 6,
): Recommendation[] {
  const myPicksMade = roster.totalDrafted;
  const rosterSpots = league.starters.QB + // sum of starters
    league.starters.RB + league.starters.WR + league.starters.TE +
    league.starters.K + league.starters.DST + league.benchSize;
  const myPicksRemaining = Math.max(0, rosterSpots - myPicksMade);
  const summaryByPos: Record<string, PosSummary> = {};
  for (const s of summaries) summaryByPos[s.pos] = s;

  const recs: Recommendation[] = scored.map((p) => {
    const need = needFactor(p.pos, roster, league, myPicksRemaining);
    const sum = summaryByPos[p.pos];
    const reasons: string[] = [];

    // Base score: value over replacement, weighted by roster need.
    let score = p.vor * need;

    // Scarcity boost: if waiting is expensive at this position, nudge it up.
    const waitCost = sum ? sum.waitCost : 0;
    if (waitCost > 0 && need > 0.3) {
      score += Math.min(waitCost, 40) * 0.5;
    }

    // Reasons (human-readable draft logic).
    if (p.vor >= 60) reasons.push(`Elite value (+${p.vor.toFixed(0)} over replacement ${p.pos})`);
    else if (p.vor >= 30) reasons.push(`Strong value (+${p.vor.toFixed(0)} over replacement ${p.pos})`);
    else if (p.vor > 0) reasons.push(`+${p.vor.toFixed(0)} over replacement ${p.pos}`);
    else reasons.push(`Around replacement level at ${p.pos}`);

    if (roster.startersNeeded[p.pos] > 0) {
      reasons.push(`Fills a starting ${p.pos} slot (need ${roster.startersNeeded[p.pos]})`);
    }
    if (p.tier === 1 && p.posRankAvail <= 3) {
      reasons.push(`Top tier still on the board (${p.pos}${p.posRankAvail})`);
    }
    if (p.dropToNext >= tierThreshold(p.pos)) {
      reasons.push(`Cliff below him: next ${p.pos} is −${p.dropToNext.toFixed(0)} pts`);
    }
    if (waitCost >= 15 && need > 0.3) {
      reasons.push(`Costly to wait: best ${p.pos} at your next pick is −${waitCost.toFixed(0)} VOR`);
    }
    if ((p.pos === "K" || p.pos === "DST") && myPicksRemaining > 2) {
      reasons.push(`Streamable — wait until your last picks`);
    }

    return { player: p, score: round1(score), needFactor: round1(need), reasons };
  });

  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, limit);
}

// How much a position matters right now for MY roster (0..1+).
function needFactor(
  pos: Pos,
  roster: RosterInfo,
  league: League,
  myPicksRemaining: number,
): number {
  const have = roster.counts[pos];
  const startNeed = roster.startersNeeded[pos];
  const target = ROSTER_TARGETS[pos];

  // K / DST: only worth it in the final couple of picks (no bench value).
  if (pos === "K" || pos === "DST") {
    if (have >= 1) return 0.02;
    // Draft when you have roughly as many picks left as empty K/DST slots (+buffer).
    return myPicksRemaining <= 3 ? 1.0 : 0.05;
  }

  if (startNeed > 0) return 1.0; // must fill a starting slot
  if (have < target) return 0.6; // useful depth / bye coverage
  return 0.18; // surplus — only for pure value / upside stash
}
