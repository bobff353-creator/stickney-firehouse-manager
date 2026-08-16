"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LEAGUE,
  DEFAULT_SCORING,
  League,
  PlayerProj,
  Pos,
  POSITIONS,
  ROSTER_TARGETS,
  Scoring,
  SEED_PLAYERS,
} from "./data";
import {
  myNextPickInfo,
  myRoster,
  positionSummaries,
  projectedPoints,
  recommend,
  scoreAvailable,
} from "./engine";

const STORAGE_KEY = "goodfellas-draft-v1";

type Taken = Record<string, "me" | "other">;
type Overrides = Record<string, Partial<PlayerProj>>;

interface Persisted {
  taken: Taken;
  league: League;
  scoring: Scoring;
  overrides: Overrides;
  custom: PlayerProj[];
}

const POS_COLORS: Record<Pos, string> = {
  QB: "#e07a5f",
  RB: "#4caf7d",
  WR: "#4a90d9",
  TE: "#c58af0",
  K: "#c9a227",
  DST: "#8a94a6",
};

const EDIT_FIELDS: Record<Pos, { key: keyof PlayerProj; label: string }[]> = {
  QB: [
    { key: "passYd", label: "Pass Yd" },
    { key: "passTD", label: "Pass TD" },
    { key: "int", label: "INT" },
    { key: "rushYd", label: "Rush Yd" },
    { key: "rushTD", label: "Rush TD" },
    { key: "fumL", label: "Fum Lost" },
  ],
  RB: [
    { key: "rushYd", label: "Rush Yd" },
    { key: "rushTD", label: "Rush TD" },
    { key: "rec", label: "Rec" },
    { key: "recYd", label: "Rec Yd" },
    { key: "recTD", label: "Rec TD" },
    { key: "fumL", label: "Fum Lost" },
  ],
  WR: [
    { key: "rec", label: "Rec" },
    { key: "recYd", label: "Rec Yd" },
    { key: "recTD", label: "Rec TD" },
    { key: "rushYd", label: "Rush Yd" },
    { key: "rushTD", label: "Rush TD" },
    { key: "fumL", label: "Fum Lost" },
  ],
  TE: [
    { key: "rec", label: "Rec" },
    { key: "recYd", label: "Rec Yd" },
    { key: "recTD", label: "Rec TD" },
    { key: "fumL", label: "Fum Lost" },
  ],
  K: [
    { key: "fg", label: "FG" },
    { key: "fg50", label: "FG 50+" },
    { key: "xp", label: "XP" },
  ],
  DST: [{ key: "dstPts", label: "Proj Pts" }],
};

export default function DraftAdvisor() {
  const [taken, setTaken] = useState<Taken>({});
  const [league, setLeague] = useState<League>(DEFAULT_LEAGUE);
  const [scoring, setScoring] = useState<Scoring>(DEFAULT_SCORING);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [custom, setCustom] = useState<PlayerProj[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [posFilter, setPosFilter] = useState<Pos | "ALL" | "REC">("REC");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDrafted, setShowDrafted] = useState(false);

  // ---- Load / persist ----
  // Read saved draft after mount (localStorage is client-only, so this keeps the
  // first render identical on server and client and avoids a hydration mismatch).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        if (p.taken) setTaken(p.taken);
        if (p.league) setLeague({ ...DEFAULT_LEAGUE, ...p.league });
        if (p.scoring) setScoring({ ...DEFAULT_SCORING, ...p.scoring });
        if (p.overrides) setOverrides(p.overrides);
        if (p.custom) setCustom(p.custom);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const data: Persisted = { taken, league, scoring, overrides, custom };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }, [taken, league, scoring, overrides, custom, loaded]);

  // ---- Build effective player list (seed + custom, with overrides applied) ----
  const players: PlayerProj[] = useMemo(() => {
    const base = [...SEED_PLAYERS, ...custom];
    return base.map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p));
  }, [custom, overrides]);

  const scored = useMemo(
    () => scoreAvailable(players, scoring, league, taken),
    [players, scoring, league, taken],
  );
  const roster = useMemo(
    () => myRoster(players, taken, league),
    [players, taken, league],
  );
  const summaries = useMemo(
    () => positionSummaries(scored, league, taken),
    [scored, league, taken],
  );
  const recs = useMemo(
    () => recommend(scored, league, roster, summaries, 6),
    [scored, league, roster, summaries],
  );

  const totalPicksMade = Object.keys(taken).length;
  const nextPick = myNextPickInfo(league, totalPicksMade);
  const onTheClock = nextPick.picksAway === 0;

  // ---- Actions ----
  const draftMe = (id: string) => setTaken((t) => ({ ...t, [id]: "me" }));
  const draftOther = (id: string) => setTaken((t) => ({ ...t, [id]: "other" }));
  const undo = (id: string) =>
    setTaken((t) => {
      const n = { ...t };
      delete n[id];
      return n;
    });
  const resetDraft = () => {
    if (confirm("Clear all drafted players and start over? (Projection edits are kept.)")) {
      setTaken({});
    }
  };
  const resetAll = () => {
    if (confirm("Reset EVERYTHING to defaults — drafted players, projection edits, and settings?")) {
      setTaken({});
      setOverrides({});
      setCustom([]);
      setLeague(DEFAULT_LEAGUE);
      setScoring(DEFAULT_SCORING);
    }
  };

  // ---- Board filtering ----
  const board = useMemo(() => {
    let list = scored;
    if (posFilter === "REC") {
      // "Skill" view: hide K/DST which pollute the value board until late.
      list = list.filter((p) => p.pos !== "K" && p.pos !== "DST");
    } else if (posFilter !== "ALL") {
      list = list.filter((p) => p.pos === posFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 120);
  }, [scored, posFilter, search]);

  const draftedList = useMemo(
    () =>
      players
        .filter((p) => taken[p.id])
        .map((p) => ({ p, who: taken[p.id], pts: projectedPoints(p, scoring) }))
        .sort((a, b) => b.pts - a.pts),
    [players, taken, scoring],
  );

  const editingPlayer = editId ? players.find((p) => p.id === editId) ?? null : null;

  return (
    <div className="dadv">
      <style>{STYLE}</style>

      <header className="dadv-top">
        <div className="dadv-brand">
          <span className="dadv-badge">GF</span>
          <div>
            <h1>Goodfellas Draft Advisor</h1>
            <p>
              {league.teams}-team · non-PPR · 6-pt pass TD · start 1QB/2RB/2WR/1TE/1K/1DST
            </p>
          </div>
        </div>
        <div className="dadv-clock">
          <div className={`dadv-pick ${onTheClock ? "live" : ""}`}>
            {onTheClock ? (
              <>
                <b>YOU&apos;RE ON THE CLOCK</b>
                <small>Round {nextPick.round}, Pick {nextPick.pickInRound} (overall {nextPick.overall})</small>
              </>
            ) : (
              <>
                <b>Your next pick in {nextPick.picksAway}</b>
                <small>Round {nextPick.round}, Pick {nextPick.pickInRound} (overall {nextPick.overall})</small>
              </>
            )}
          </div>
          <button className="dadv-gear" onClick={() => setShowSettings((s) => !s)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {showSettings && (
        <Settings
          league={league}
          setLeague={setLeague}
          scoring={scoring}
          setScoring={setScoring}
          onResetDraft={resetDraft}
          onResetAll={resetAll}
          onAddCustom={(p) => setCustom((c) => [...c, p])}
        />
      )}

      {/* Recommendation panel */}
      <section className="dadv-recs">
        <div className="dadv-section-head">
          <h2>Best picks now</h2>
          <span className="dadv-hint">Need-adjusted value for YOUR roster</span>
        </div>
        <div className="dadv-rec-grid">
          {recs.map((r, i) => (
            <div key={r.player.id} className="dadv-rec-card">
              <div className="dadv-rec-rank">{i + 1}</div>
              <div className="dadv-rec-main">
                <div className="dadv-rec-name">
                  <span className="dadv-pos" style={{ background: POS_COLORS[r.player.pos] }}>
                    {r.player.pos}
                  </span>
                  <b>{r.player.name}</b>
                  <span className="dadv-team">{r.player.team}</span>
                </div>
                <div className="dadv-rec-nums">
                  <span className="dadv-vor" title="Value over replacement">
                    VOR +{r.player.vor.toFixed(0)}
                  </span>
                  <span>{r.player.pts.toFixed(0)} pts</span>
                  <span>{r.player.pos}{r.player.posRankAvail} avail</span>
                </div>
                <ul className="dadv-reasons">
                  {r.reasons.slice(0, 3).map((reason, j) => (
                    <li key={j}>{reason}</li>
                  ))}
                </ul>
              </div>
              <button className="dadv-take" onClick={() => draftMe(r.player.id)}>
                Draft
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Roster needs */}
      <section className="dadv-roster">
        <div className="dadv-section-head">
          <h2>Your roster</h2>
          <span className="dadv-hint">{roster.totalDrafted} drafted</span>
        </div>
        <div className="dadv-need-strip">
          {POSITIONS.map((pos) => {
            const have = roster.counts[pos];
            const startNeed = roster.startersNeeded[pos];
            const target = ROSTER_TARGETS[pos];
            const status = startNeed > 0 ? "need" : have < target ? "depth" : "full";
            return (
              <div key={pos} className={`dadv-need ${status}`}>
                <span className="dadv-need-pos" style={{ color: POS_COLORS[pos] }}>{pos}</span>
                <span className="dadv-need-count">{have}</span>
                <span className="dadv-need-label">
                  {startNeed > 0 ? `need ${startNeed}` : have < target ? "depth" : "set"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Position strength / scarcity */}
      <section className="dadv-scarcity">
        <div className="dadv-section-head">
          <h2>Position strength &amp; drop-off</h2>
          <span className="dadv-hint">How strong each spot is right now — and the cost of waiting</span>
        </div>
        <div className="dadv-scar-table">
          <div className="dadv-scar-row head">
            <span>Pos</span>
            <span>Best available</span>
            <span>VOR</span>
            <span>Drop to next</span>
            <span>Cost to wait</span>
          </div>
          {[...summaries]
            .sort((a, b) => b.waitCost - a.waitCost)
            .map((s) => (
              <div key={s.pos} className="dadv-scar-row">
                <span className="dadv-scar-pos" style={{ color: POS_COLORS[s.pos] }}>{s.pos}</span>
                <span className="dadv-scar-name">
                  {s.bestAvail ? `${s.bestAvail.name}` : "—"}
                </span>
                <span className={valClass(s.bestVor)}>{s.bestVor > 0 ? "+" : ""}{s.bestVor.toFixed(0)}</span>
                <span className={s.dropToNext >= 15 ? "cliff" : ""}>−{s.dropToNext.toFixed(0)}</span>
                <span className={s.waitCost >= 15 ? "cliff" : s.waitCost > 0 ? "warn" : ""}>
                  {s.waitCost > 0 ? `−${s.waitCost.toFixed(0)}` : "—"}
                </span>
              </div>
            ))}
        </div>
        <p className="dadv-foot">
          <b>Cost to wait</b> estimates how much value at a position disappears before your next
          pick — a big number means draft that position now.
        </p>
      </section>

      {/* Player board */}
      <section className="dadv-board">
        <div className="dadv-section-head">
          <h2>Player board</h2>
          <button className="dadv-link" onClick={() => setShowDrafted((s) => !s)}>
            {showDrafted ? "Hide drafted" : `Drafted (${draftedList.length})`}
          </button>
        </div>

        <div className="dadv-filters">
          {(["REC", "ALL", ...POSITIONS] as const).map((f) => (
            <button
              key={f}
              className={`dadv-filter ${posFilter === f ? "on" : ""}`}
              onClick={() => setPosFilter(f)}
              style={posFilter === f && f !== "ALL" && f !== "REC" ? { background: POS_COLORS[f as Pos] } : undefined}
            >
              {f === "REC" ? "Skill" : f}
            </button>
          ))}
          <input
            className="dadv-search"
            placeholder="Search player / team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {showDrafted && (
          <div className="dadv-drafted">
            {draftedList.length === 0 && <p className="dadv-empty">Nobody drafted yet.</p>}
            {draftedList.map(({ p, who }) => (
              <div key={p.id} className="dadv-drow">
                <span className="dadv-pos sm" style={{ background: POS_COLORS[p.pos] }}>{p.pos}</span>
                <b>{p.name}</b>
                <span className="dadv-team">{p.team}</span>
                <span className={`dadv-who ${who}`}>{who === "me" ? "My team" : "Taken"}</span>
                <button className="dadv-undo" onClick={() => undo(p.id)}>Undo</button>
              </div>
            ))}
          </div>
        )}

        <div className="dadv-rows">
          <div className="dadv-row head">
            <span className="c-pos">Pos</span>
            <span className="c-name">Player</span>
            <span className="c-num">Pts</span>
            <span className="c-num">VOR</span>
            <span className="c-num">Next</span>
            <span className="c-act" />
          </div>
          {board.map((p) => (
            <div key={p.id} className="dadv-row">
              <span className="c-pos">
                <span className="dadv-pos sm" style={{ background: POS_COLORS[p.pos] }}>
                  {p.pos}{p.posRankAvail}
                </span>
              </span>
              <span className="c-name">
                <b>{p.name}</b>
                <small>{p.team} · tier {p.tier}</small>
              </span>
              <span className="c-num">{p.pts.toFixed(0)}</span>
              <span className={`c-num ${valClass(p.vor)}`}>{p.vor > 0 ? "+" : ""}{p.vor.toFixed(0)}</span>
              <span className={`c-num ${p.dropToNext >= 15 ? "cliff" : ""}`}>−{p.dropToNext.toFixed(0)}</span>
              <span className="c-act">
                <button className="dadv-mini me" onClick={() => draftMe(p.id)} title="Draft to my team">＋Me</button>
                <button className="dadv-mini gone" onClick={() => draftOther(p.id)} title="Taken by another team">Gone</button>
                <button className="dadv-mini edit" onClick={() => setEditId(p.id)} title="Edit projection">✎</button>
              </span>
            </div>
          ))}
          {board.length === 0 && <p className="dadv-empty">No players match.</p>}
        </div>
      </section>

      {editingPlayer && (
        <EditModal
          player={editingPlayer}
          scoring={scoring}
          onClose={() => setEditId(null)}
          onSave={(patch) => {
            setOverrides((o) => ({ ...o, [editingPlayer.id]: { ...o[editingPlayer.id], ...patch } }));
            setEditId(null);
          }}
          onReset={() => {
            setOverrides((o) => {
              const n = { ...o };
              delete n[editingPlayer.id];
              return n;
            });
            setEditId(null);
          }}
          isEdited={!!overrides[editingPlayer.id]}
        />
      )}

      <footer className="dadv-bottom">
        Baseline 2026 projections (Aug 2026) — tune any number with ✎ and the board re-ranks
        instantly. Your draft is saved in this browser.
      </footer>
    </div>
  );
}

function valClass(v: number): string {
  if (v >= 40) return "val-hi";
  if (v >= 15) return "val-mid";
  if (v > 0) return "val-lo";
  return "val-neg";
}

// ---- Settings panel ----
function Settings({
  league,
  setLeague,
  scoring,
  setScoring,
  onResetDraft,
  onResetAll,
  onAddCustom,
}: {
  league: League;
  setLeague: (l: League) => void;
  scoring: Scoring;
  setScoring: (s: Scoring) => void;
  onResetDraft: () => void;
  onResetAll: () => void;
  onAddCustom: (p: PlayerProj) => void;
}) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [pos, setPos] = useState<Pos>("RB");

  return (
    <section className="dadv-settings">
      <div className="dadv-set-grid">
        <label>
          Teams
          <input
            type="number"
            min={4}
            max={20}
            value={league.teams}
            onChange={(e) => setLeague({ ...league, teams: clampNum(e.target.value, 4, 20, league.teams) })}
          />
        </label>
        <label>
          Your draft slot
          <input
            type="number"
            min={1}
            max={league.teams}
            value={league.myDraftSlot}
            onChange={(e) => setLeague({ ...league, myDraftSlot: clampNum(e.target.value, 1, league.teams, league.myDraftSlot) })}
          />
        </label>
        <label>
          Bench size
          <input
            type="number"
            min={0}
            max={15}
            value={league.benchSize}
            onChange={(e) => setLeague({ ...league, benchSize: clampNum(e.target.value, 0, 15, league.benchSize) })}
          />
        </label>
        <label>
          Pass TD pts
          <input
            type="number"
            value={scoring.passTD}
            onChange={(e) => setScoring({ ...scoring, passTD: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          Pass yd / pt
          <input
            type="number"
            value={scoring.passYdPerPt}
            onChange={(e) => setScoring({ ...scoring, passYdPerPt: Number(e.target.value) || 25 })}
          />
        </label>
        <label>
          PPR
          <input
            type="number"
            step="0.5"
            value={scoring.ppr}
            onChange={(e) => setScoring({ ...scoring, ppr: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="dadv-add">
        <span>Add a player</span>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Team" value={team} onChange={(e) => setTeam(e.target.value)} />
        <select value={pos} onChange={(e) => setPos(e.target.value as Pos)}>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onAddCustom({
              id: `custom-${Date.now()}`,
              name: name.trim(),
              team: team.trim() || "FA",
              pos,
            });
            setName("");
            setTeam("");
          }}
        >
          Add
        </button>
      </div>

      <div className="dadv-danger">
        <button onClick={onResetDraft}>Clear drafted (keep edits)</button>
        <button onClick={onResetAll} className="hard">Reset everything</button>
      </div>
    </section>
  );
}

// ---- Edit projection modal ----
function EditModal({
  player,
  scoring,
  onClose,
  onSave,
  onReset,
  isEdited,
}: {
  player: PlayerProj;
  scoring: Scoring;
  onClose: () => void;
  onSave: (patch: Partial<PlayerProj>) => void;
  onReset: () => void;
  isEdited: boolean;
}) {
  const fields = EDIT_FIELDS[player.pos];
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key as string] = String((player[f.key] as number | undefined) ?? 0);
    return o;
  });

  const preview: PlayerProj = {
    ...player,
    ...Object.fromEntries(fields.map((f) => [f.key, Number(vals[f.key as string]) || 0])),
  };

  return (
    <div className="dadv-modal-bg" onClick={onClose}>
      <div className="dadv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dadv-modal-head">
          <span className="dadv-pos" style={{ background: POS_COLORS[player.pos] }}>{player.pos}</span>
          <b>{player.name}</b>
          <span className="dadv-team">{player.team}</span>
        </div>
        <div className="dadv-modal-fields">
          {fields.map((f) => (
            <label key={f.key as string}>
              {f.label}
              <input
                type="number"
                value={vals[f.key as string]}
                onChange={(e) => setVals((v) => ({ ...v, [f.key as string]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="dadv-modal-preview">
          Projected points: <b>{projectedPoints(preview, scoring).toFixed(1)}</b>
        </div>
        <div className="dadv-modal-actions">
          {isEdited && <button className="ghost" onClick={onReset}>Reset to baseline</button>}
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() =>
              onSave(Object.fromEntries(fields.map((f) => [f.key, Number(vals[f.key as string]) || 0])))
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function clampNum(v: string, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const STYLE = `
.dadv { --bg:#0d1420; --panel:#141d2b; --panel2:#1a2536; --line:#26344a; --text:#e8eef6; --muted:#8ea0b8; --accent:#4a90d9; --good:#4caf7d; --warn:#d9a441; --bad:#d96a5f;
  max-width:1080px; margin:0 auto; padding:14px; color:var(--text);
  font-family: var(--font-geist-sans), system-ui, sans-serif; }
.dadv * { box-sizing:border-box; }
.dadv h1 { margin:0; font-size:19px; letter-spacing:-.02em; }
.dadv h2 { margin:0; font-size:15px; letter-spacing:-.01em; }
.dadv p { margin:0; }

.dadv-top { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center;
  background:linear-gradient(135deg,#16223a,#0f1826); border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
.dadv-brand { display:flex; gap:12px; align-items:center; }
.dadv-badge { width:44px; height:44px; border-radius:11px; display:grid; place-items:center; font-weight:900;
  background:linear-gradient(145deg,#e8b642,#ba7420); color:#10233a; font-size:15px; }
.dadv-brand p { color:var(--muted); font-size:11.5px; margin-top:3px; }
.dadv-clock { display:flex; gap:10px; align-items:center; }
.dadv-pick { background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:8px 14px; display:flex; flex-direction:column; }
.dadv-pick b { font-size:12.5px; }
.dadv-pick small { color:var(--muted); font-size:11px; }
.dadv-pick.live { background:linear-gradient(135deg,#1d5a3c,#2f6b4f); border-color:#3c8a63; }
.dadv-pick.live b { color:#c7f2da; }
.dadv-gear { background:var(--panel2); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 12px; font-size:12px; cursor:pointer; }

.dadv-section-head { display:flex; align-items:baseline; justify-content:space-between; margin:22px 2px 10px; }
.dadv-hint { color:var(--muted); font-size:11.5px; }
.dadv-link, .dadv-danger button, .dadv-add button { cursor:pointer; }
.dadv-link { background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; }

.dadv-rec-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:10px; }
.dadv-rec-card { display:flex; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px; }
.dadv-rec-rank { width:24px; height:24px; border-radius:7px; background:var(--panel2); display:grid; place-items:center; font-weight:800; font-size:12px; color:var(--muted); flex:0 0 auto; }
.dadv-rec-main { flex:1; min-width:0; }
.dadv-rec-name { display:flex; gap:7px; align-items:center; }
.dadv-rec-name b { font-size:14px; }
.dadv-pos { font-size:10px; font-weight:800; color:#0d1420; padding:2px 6px; border-radius:5px; letter-spacing:.02em; }
.dadv-pos.sm { font-size:10px; padding:2px 5px; }
.dadv-team { color:var(--muted); font-size:11px; }
.dadv-rec-nums { display:flex; gap:10px; margin:6px 0; font-size:11.5px; color:var(--muted); flex-wrap:wrap; }
.dadv-vor { color:var(--good); font-weight:800; }
.dadv-reasons { margin:0; padding-left:15px; font-size:11px; color:var(--muted); line-height:1.5; }
.dadv-take { align-self:center; background:var(--good); color:#08130d; border:none; border-radius:9px; padding:9px 12px; font-weight:800; cursor:pointer; flex:0 0 auto; }

.dadv-need-strip { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
.dadv-need { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:9px; display:flex; flex-direction:column; align-items:center; gap:2px; }
.dadv-need.need { border-color:#7a4b2a; background:#241a12; }
.dadv-need.full { opacity:.72; }
.dadv-need-pos { font-weight:800; font-size:12px; }
.dadv-need-count { font-size:20px; font-weight:800; }
.dadv-need-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }

.dadv-scar-table { border:1px solid var(--line); border-radius:11px; overflow:hidden; }
.dadv-scar-row { display:grid; grid-template-columns:44px 1fr 54px 76px 74px; gap:6px; padding:9px 11px; align-items:center; font-size:12.5px; border-top:1px solid var(--line); }
.dadv-scar-row.head { background:var(--panel2); color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.03em; border-top:none; }
.dadv-scar-pos { font-weight:800; }
.dadv-scar-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dadv-foot, .dadv-bottom { color:var(--muted); font-size:11px; margin-top:9px; line-height:1.5; }

.dadv-filters { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; align-items:center; }
.dadv-filter { background:var(--panel2); color:var(--text); border:1px solid var(--line); border-radius:8px; padding:6px 11px; font-size:12px; font-weight:700; cursor:pointer; }
.dadv-filter.on { color:#0d1420; background:var(--accent); border-color:transparent; }
.dadv-search { flex:1; min-width:140px; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:7px 11px; color:var(--text); font-size:12.5px; }

.dadv-rows { border:1px solid var(--line); border-radius:11px; overflow:hidden; }
.dadv-row { display:grid; grid-template-columns:52px 1fr 42px 50px 46px auto; gap:6px; padding:8px 10px; align-items:center; border-top:1px solid var(--line); font-size:13px; }
.dadv-row.head { background:var(--panel2); color:var(--muted); font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; border-top:none; }
.dadv-row .c-name { display:flex; flex-direction:column; min-width:0; }
.dadv-row .c-name b { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dadv-row .c-name small { color:var(--muted); font-size:10.5px; }
.c-num { text-align:right; font-variant-numeric:tabular-nums; }
.c-act { display:flex; gap:4px; justify-content:flex-end; }
.dadv-mini { border:1px solid var(--line); background:var(--panel2); color:var(--text); border-radius:7px; padding:5px 7px; font-size:11px; font-weight:700; cursor:pointer; }
.dadv-mini.me { background:var(--good); color:#08130d; border-color:transparent; }
.dadv-mini.gone { color:var(--muted); }
.dadv-mini.edit { color:var(--accent); }

.val-hi { color:#5fd39b; font-weight:800; }
.val-mid { color:#8fd0a8; font-weight:700; }
.val-lo { color:var(--text); }
.val-neg { color:var(--muted); }
.cliff { color:var(--warn); font-weight:800; }
.warn { color:var(--warn); }

.dadv-drafted { border:1px solid var(--line); border-radius:11px; margin-bottom:10px; overflow:hidden; }
.dadv-drow { display:flex; gap:8px; align-items:center; padding:7px 10px; border-top:1px solid var(--line); font-size:12.5px; }
.dadv-drow:first-child { border-top:none; }
.dadv-who { margin-left:auto; font-size:11px; padding:2px 7px; border-radius:5px; }
.dadv-who.me { background:#1d3a2a; color:#9fe6c0; }
.dadv-who.other { background:#2a2230; color:var(--muted); }
.dadv-undo { background:none; border:1px solid var(--line); color:var(--muted); border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer; }
.dadv-empty { color:var(--muted); font-size:12px; padding:14px; text-align:center; }

.dadv-settings { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; margin-top:12px; }
.dadv-set-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }
.dadv-settings label { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); }
.dadv-settings input, .dadv-settings select, .dadv-add input, .dadv-add select { background:var(--panel2); border:1px solid var(--line); border-radius:8px; padding:7px 9px; color:var(--text); font-size:13px; }
.dadv-add { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:14px; padding-top:14px; border-top:1px solid var(--line); font-size:12px; color:var(--muted); }
.dadv-add button { background:var(--accent); color:#0d1420; border:none; border-radius:8px; padding:8px 13px; font-weight:800; cursor:pointer; }
.dadv-danger { display:flex; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid var(--line); }
.dadv-danger button { background:var(--panel2); border:1px solid var(--line); color:var(--text); border-radius:8px; padding:8px 12px; font-size:12px; }
.dadv-danger button.hard { background:#3a1d1d; border-color:#6b3535; color:#f0c0c0; }

.dadv-modal-bg { position:fixed; inset:0; background:rgba(6,10,16,.7); display:grid; place-items:center; padding:16px; z-index:50; }
.dadv-modal { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; width:100%; max-width:420px; }
.dadv-modal-head { display:flex; gap:8px; align-items:center; margin-bottom:12px; }
.dadv-modal-head b { font-size:15px; }
.dadv-modal-fields { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.dadv-modal-fields label { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); }
.dadv-modal-fields input { background:var(--panel2); border:1px solid var(--line); border-radius:8px; padding:8px; color:var(--text); font-size:14px; }
.dadv-modal-preview { margin:14px 0; font-size:13px; color:var(--muted); }
.dadv-modal-preview b { color:var(--good); font-size:16px; }
.dadv-modal-actions { display:flex; gap:8px; justify-content:flex-end; }
.dadv-modal-actions button { border-radius:9px; padding:9px 14px; font-weight:800; font-size:13px; cursor:pointer; border:1px solid var(--line); }
.dadv-modal-actions .ghost { background:var(--panel2); color:var(--text); }
.dadv-modal-actions .primary { background:var(--good); color:#08130d; border-color:transparent; }

@media (max-width:640px) {
  .dadv-top { flex-direction:column; align-items:stretch; }
  .dadv-clock { justify-content:space-between; }
  .dadv-need-strip { grid-template-columns:repeat(3,1fr); }
  .dadv-scar-row { grid-template-columns:38px 1fr 44px 60px 58px; font-size:11.5px; }
  .dadv-row { grid-template-columns:48px 1fr 34px 44px auto; }
  .dadv-row .c-num:nth-child(5) { display:none; }
  .dadv-row.head .c-num:nth-child(5) { display:none; }
}
`;
