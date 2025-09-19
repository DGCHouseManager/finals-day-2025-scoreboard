import React, { useEffect, useState, useMemo } from "react";
import { ref, set, child, onValue } from "firebase/database";
import { db } from "./firebase";
import "./App.css";

// Handicap + scoring helpers
import {
  siForHole,
  computeSinglesDiffAndReceiver as computeSinglesDiffAndReceiver_UTIL,
  strokesForSinglesHole as strokesForSinglesHole_UTIL,
  computeFourballAllowances,
  strokesForFourballHole, // kept for parity, not used in forced-SI paths
  computeFoursomesDiff,
  strokesForFoursomesHole,
  computeMatchStatus,
} from "./matchUtils";

/* =========================
   Course hole info (you supplied)
   ========================= */
const MENS_HOLE_INFO = [
  { number: 1, par: 4, si: 11 },
  { number: 2, par: 4, si: 5 },
  { number: 3, par: 4, si: 13 },
  { number: 4, par: 3, si: 15 },
  { number: 5, par: 4, si: 1 },
  { number: 6, par: 3, si: 17 },
  { number: 7, par: 4, si: 7 },
  { number: 8, par: 4, si: 3 },
  { number: 9, par: 4, si: 9 },
  { number: 10, par: 4, si: 12 },
  { number: 11, par: 3, si: 14 },
  { number: 12, par: 5, si: 6 },
  { number: 13, par: 4, si: 2 },
  { number: 14, par: 4, si: 10 },
  { number: 15, par: 4, si: 4 },
  { number: 16, par: 4, si: 16 },
  { number: 17, par: 3, si: 18 },
  { number: 18, par: 4, si: 8 },
];

const LADIES_HOLE_INFO = [
  { number: 1, par: 4, si: 5 },
  { number: 2, par: 4, si: 9 },
  { number: 3, par: 4, si: 3 },
  { number: 4, par: 3, si: 13 },
  { number: 5, par: 5, si: 15 },
  { number: 6, par: 3, si: 17 },
  { number: 7, par: 4, si: 7 },
  { number: 8, par: 5, si: 11 },
  { number: 9, par: 4, si: 1 },
  { number: 10, par: 4, si: 6 },
  { number: 11, par: 3, si: 14 },
  { number: 12, par: 5, si: 4 },
  { number: 13, par: 5, si: 12 },
  { number: 14, par: 4, si: 8 },
  { number: 15, par: 4, si: 2 },
  { number: 16, par: 4, si: 16 },
  { number: 17, par: 3, si: 18 },
  { number: 18, par: 4, si: 10 },
];

/* =========================
   Lightweight passwords (no Firebase Auth)
   ========================= */
const PASSWORDS = {
  FDadmin2025: { role: "admin" },
  Mens4Ball: { role: "scorer", match: "mens-fourball" },
  MensFoursomes: { role: "scorer", match: "mens-foursomes" },
  MixedFoursomes: { role: "scorer", match: "mixed-foursomes" },
  Captains: { role: "scorer", match: "captains-prize" },
  ClubChamps: { role: "scorer", match: "mens-club-champ" },
  Juniors: { role: "scorer", match: "junior-singles" },
  LadiesClarvis: { role: "scorer", match: "clarvis-ladies" },
};

const parseScore = (v) => {
  if (v === "" || v === null || typeof v === "undefined") return null;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 15) return null;  // allow 0–15 only
  return n;
};

/* =========================
   Local helpers (wrappers)
   ========================= */
function computeSinglesDiffAndReceiver(sides) {
  const a = sides?.A?.players?.[0];
  const b = sides?.B?.players?.[0];
  return computeSinglesDiffAndReceiver_UTIL({
    A: { handicap: parseInt(a?.handicap ?? 0, 10) || 0 },
    B: { handicap: parseInt(b?.handicap ?? 0, 10) || 0 },
  });
}

function strokesForSinglesHole(i, side, receiver, diff, matchMeta) {
  return strokesForSinglesHole_UTIL(
    i,
    side,
    receiver,
    diff,
    matchMeta,
    MENS_HOLE_INFO,
    LADIES_HOLE_INFO
  );
}

function getHoleInfoSet(siSet) {
  return siSet === "ladies" ? LADIES_HOLE_INFO : MENS_HOLE_INFO;
}

/* Dormie label */
function appendDormie(status, aWon, bWon, through, total) {
  const diff = Math.abs(aWon - bWon);
  const remaining = total - through;
  if (
    remaining > 0 &&
    diff === remaining &&
    diff > 0 &&
    !status.startsWith("A wins") &&
    !status.startsWith("B wins")
  ) {
    return `${status} (Dormie)`;
  }
  return status;
}

/* =========================
   Main App
   ========================= */
function App() {
  const [matchList, setMatchList] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchMeta, setMatchMeta] = useState(null);
  const [matchSides, setMatchSides] = useState(null);

  // Auth
  const [auth, setAuth] = useState(null);
  const isAdmin = auth?.role === "admin";
  const canEditThisMatch = useMemo(() => {
    if (!auth) return false;
    if (auth.role === "admin") return true;
    if (auth.role === "scorer" && auth.match && selectedMatchId) {
      return auth.match === selectedMatchId;
    }
    return false;
  }, [auth, selectedMatchId]);

  // View mode: score (inputs) or spectator (read-only)
  const [mode, setMode] = useState("score");

  // Singles state
  const [singlesScores, setSinglesScores] = useState([]); // [{A,B},...]
  const [singlesStatus, setSinglesStatus] = useState("");

  // Fourball state
  const [fourballScores, setFourballScores] = useState([]); // [{A:{p0,p1}, B:{p0,p1}}, ...]
  const [fourballStatus, setFourballStatus] = useState("");

  // Foursomes state
  const [foursomesScores, setFoursomesScores] = useState([]); // [{A,B},...]
  const [foursomesStatus, setFoursomesStatus] = useState("");

  /* -------------------------
     Load match list (stable)
     ------------------------- */
  useEffect(() => {
    const matchesRef = child(ref(db), "events/finals-2025/matches");
    return onValue(matchesRef, (snap) => {
      const val = snap.val() || {};
      const items = Object.keys(val).map((id) => ({
        id,
        name: val[id]?.meta?.name || id,
      }));
      setMatchList(items);
      setSelectedMatchId((prev) => {
        if (prev && items.some((m) => m.id === prev)) return prev;
        return items[0]?.id || "";
      });
    });
  }, []);

  /* -------------------------
     Load match meta + sides
     ------------------------- */
  useEffect(() => {
    if (!selectedMatchId) return;
    const base = `events/finals-2025/matches/${selectedMatchId}`;

    const unsubs = [];

    unsubs.push(
      onValue(child(ref(db), `${base}/meta`), (snap) => {
        const meta = snap.val() || null;
        setMatchMeta(meta);

        const holes = meta?.holes || 18;
        if (meta?.format === "singles") {
          setSinglesScores(Array.from({ length: holes }, () => ({ A: "", B: "" })));
          setSinglesStatus("");
        } else if (meta?.format === "fourball") {
          setFourballScores(
            Array.from({ length: holes }, () => ({
              A: { p0: "", p1: "" },
              B: { p0: "", p1: "" },
            }))
          );
          setFourballStatus("");
        } else if (meta?.format === "foursomes") {
          setFoursomesScores(Array.from({ length: holes }, () => ({ A: "", B: "" })));
          setFoursomesStatus("");
        }
      })
    );

    unsubs.push(
      onValue(child(ref(db), `${base}/sides`), (snap) => {
        setMatchSides(snap.val() || null);
      })
    );

    return () => unsubs.forEach((u) => (typeof u === "function" ? u() : undefined));
  }, [selectedMatchId]);

  /* -------------------------
     Scores listeners (per format)
     ------------------------- */
  useEffect(() => {
    if (!selectedMatchId || !matchMeta?.format) return;
    const base = `events/finals-2025/matches/${selectedMatchId}`;
    const holes = matchMeta?.holes || 18;

    if (matchMeta.format === "singles") {
      return onValue(child(ref(db), `${base}/scores_singles`), (snap) => {
        const v = snap.val() || {};
        const arr = Array.from({ length: holes }, (_, i) => {
          const h = String(i + 1);
          return { A: v[h]?.A ?? "", B: v[h]?.B ?? "" };
        });
        setSinglesScores(arr);
        setSinglesStatus(computeSinglesStatus(arr, holes, matchMeta, matchSides));
      });
    }

    if (matchMeta.format === "fourball") {
      return onValue(child(ref(db), `${base}/scores_fourball`), (snap) => {
        const v = snap.val() || {};
        const arr = Array.from({ length: holes }, (_, i) => {
          const h = String(i + 1);
          return {
            A: { p0: v[h]?.A?.p0 ?? "", p1: v[h]?.A?.p1 ?? "" },
            B: { p0: v[h]?.B?.p0 ?? "", p1: v[h]?.B?.p1 ?? "" },
          };
        });
        setFourballScores(arr);
        setFourballStatus(computeFourballStatus(arr, holes, matchMeta, matchSides));
      });
    }

    if (matchMeta.format === "foursomes") {
      return onValue(child(ref(db), `${base}/scores_foursomes`), (snap) => {
        const v = snap.val() || {};
        const arr = Array.from({ length: holes }, (_, i) => {
          const h = String(i + 1);
          return { A: v[h]?.A ?? "", B: v[h]?.B ?? "" };
        });
        setFoursomesScores(arr);
        setFoursomesStatus(computeFoursomesStatus(arr, holes, matchMeta, matchSides));
      });
    }
  }, [selectedMatchId, matchMeta?.format, matchMeta?.holes, matchSides]);

  /* =========================
     Status calculators
     ========================= */
  function computeSinglesStatus(arr, holes, meta, sides) {
    const useNett = meta?.handicapMode === "nett";
    const { receiver, diff } = computeSinglesDiffAndReceiver(sides);
    let aWon = 0;
    let bWon = 0;
    let through = 0;

    for (let i = 0; i < holes; i++) {
      const aG = parseScore(arr[i]?.A);
      const bG = parseScore(arr[i]?.B);

      // Need at least something entered to decide
      if (!Number.isFinite(aG) && !Number.isFinite(bG)) break;

      // --- 0 handling (concession / pick-up) ---
      if (aG === 0 && bG === 0) {
        through = i + 1; // halved hole
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }
      if (aG === 0 && Number.isFinite(bG) && bG > 0) {
        bWon++; through = i + 1;
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }
      if (bG === 0 && Number.isFinite(aG) && aG > 0) {
        aWon++; through = i + 1;
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }

      // If either side still missing (non-zero), we can't decide yet
      if (!Number.isFinite(aG) || !Number.isFinite(bG)) break;

      // --- Normal nett comparison path ---
      const aS = useNett ? strokesForSinglesHole(i, "A", receiver, diff, meta) : 0;
      const bS = useNett ? strokesForSinglesHole(i, "B", receiver, diff, meta) : 0;
      const aN = aG - aS;
      const bN = bG - bS;

      through = i + 1;
      if (aN < bN) aWon++;
      else if (bN < aN) bWon++;

      const status = computeMatchStatus(aWon, bWon, through, holes);
      if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
    }

    return appendDormie(
      computeMatchStatus(aWon, bWon, through, holes),
      aWon, bWon, through, holes
    );
  }

  function computeFourballStatus(arr, holes, meta, sides) {
    // Build allowances once (90% from lowest)
    const allowances = computeFourballAllowances(sides);
    // Force correct SI set for the match
    const siInfo = meta?.siSet === "ladies" ? LADIES_HOLE_INFO : MENS_HOLE_INFO;

    let aWon = 0;
    let bWon = 0;
    let through = 0;

    for (let i = 0; i < holes; i++) {
      const a0 = parseInt(arr[i]?.A?.p0, 10);
      const a1 = parseInt(arr[i]?.A?.p1, 10);
      const b0 = parseInt(arr[i]?.B?.p0, 10);
      const b1 = parseInt(arr[i]?.B?.p1, 10);

      // Need at least one valid score from each side to decide the hole
      if (![a0, a1].some(Number.isFinite) || ![b0, b1].some(Number.isFinite)) break;

      const holeSI = siInfo[i % 18]?.si ?? 99;

      // see if each player receives a stroke on this hole
      const a0Gets = holeSI <= (allowances.find(p => p.side === "A" && p.idx === 0)?.allowance ?? -1);
      const a1Gets = holeSI <= (allowances.find(p => p.side === "A" && p.idx === 1)?.allowance ?? -1);
      const b0Gets = holeSI <= (allowances.find(p => p.side === "B" && p.idx === 0)?.allowance ?? -1);
      const b1Gets = holeSI <= (allowances.find(p => p.side === "B" && p.idx === 1)?.allowance ?? -1);

      const a0n = Number.isFinite(a0) ? a0 - (a0Gets ? 1 : 0) : Infinity;
      const a1n = Number.isFinite(a1) ? a1 - (a1Gets ? 1 : 0) : Infinity;
      const b0n = Number.isFinite(b0) ? b0 - (b0Gets ? 1 : 0) : Infinity;
      const b1n = Number.isFinite(b1) ? b1 - (b1Gets ? 1 : 0) : Infinity;

      const aBest = Math.min(a0n, a1n);
      const bBest = Math.min(b0n, b1n);

      through = i + 1;
      if (aBest < bBest) aWon++;
      else if (bBest < aBest) bWon++;

      const status = computeMatchStatus(aWon, bWon, through, holes);
      if (status.startsWith("A wins") || status.startsWith("B wins")) {
        return status;
      }
    }

    return appendDormie(
      computeMatchStatus(aWon, bWon, through, holes),
      aWon,
      bWon,
      through,
      holes
    );
  }

  function computeFoursomesStatus(arr, holes, meta, sides) {
    const { receiver, diff } = computeFoursomesDiff(sides);

    let aWon = 0;
    let bWon = 0;
    let through = 0;

    for (let i = 0; i < holes; i++) {
      const aG = parseScore(arr[i]?.A);
      const bG = parseScore(arr[i]?.B);

      if (!Number.isFinite(aG) && !Number.isFinite(bG)) break;

      // --- 0 handling ---
      if (aG === 0 && bG === 0) {
        through = i + 1; // halved hole
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }
      if (aG === 0 && Number.isFinite(bG) && bG > 0) {
        bWon++; through = i + 1;
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }
      if (bG === 0 && Number.isFinite(aG) && aG > 0) {
        aWon++; through = i + 1;
        const status = computeMatchStatus(aWon, bWon, through, holes);
        if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
        continue;
      }

      if (!Number.isFinite(aG) || !Number.isFinite(bG)) break;

      // --- Normal nett path ---
      const aS = strokesForFoursomesHole(
        i, "A", receiver, diff, meta, MENS_HOLE_INFO, LADIES_HOLE_INFO
      );
      const bS = strokesForFoursomesHole(
        i, "B", receiver, diff, meta, MENS_HOLE_INFO, LADIES_HOLE_INFO
      );
      const aN = aG - aS;
      const bN = bG - bS;

      through = i + 1;
      if (aN < bN) aWon++;
      else if (bN < aN) bWon++;

      const status = computeMatchStatus(aWon, bWon, through, holes);
      if (status.startsWith("A wins") || status.startsWith("B wins")) return status;
    }

    return appendDormie(
      computeMatchStatus(aWon, bWon, through, holes),
      aWon, bWon, through, holes
    );
  }

  /* =========================
     Handlers (write to Firebase)
     Inputs are read-only unless canEditThisMatch === true
     ========================= */
  const handleSinglesScoreChange = (holeIndex, side, value) => {
    if (!canEditThisMatch || matchMeta?.format !== "singles") return;
    const holeNo = holeIndex + 1;
    const num = parseInt(value, 10);
    const safeVal = Number.isFinite(num) ? num : "";

    setSinglesScores((prev) => {
      const next = prev.map((x) => ({ ...x }));
      next[holeIndex] = { ...next[holeIndex], [side]: safeVal };
      setSinglesStatus(
        computeSinglesStatus(next, matchMeta?.holes || 18, matchMeta, matchSides)
      );
      return next;
    });

    const path = `events/finals-2025/matches/${selectedMatchId}/scores_singles/${holeNo}/${side}`;
    set(ref(db, path), safeVal);
  };

  const handleFourballChange = (holeIndex, side, playerIndex, value) => {
    if (!canEditThisMatch || matchMeta?.format !== "fourball") return;
    const holeNo = holeIndex + 1;
    const key = playerIndex === 0 ? "p0" : "p1";
    const num = parseInt(value, 10);
    const safeVal = Number.isFinite(num) ? num : "";

    setFourballScores((prev) => {
      const next = prev.map((x) => ({
        A: { ...x.A },
        B: { ...x.B },
      }));
      next[holeIndex] = {
        ...next[holeIndex],
        [side]: { ...next[holeIndex][side], [key]: safeVal },
      };
      setFourballStatus(
        computeFourballStatus(next, matchMeta?.holes || 18, matchMeta, matchSides)
      );
      return next;
    });

    const path = `events/finals-2025/matches/${selectedMatchId}/scores_fourball/${holeNo}/${side}/${key}`;
    set(ref(db, path), safeVal);
  };

  const handleFoursomesChange = (holeIndex, side, value) => {
    if (!canEditThisMatch || matchMeta?.format !== "foursomes") return;
    const holeNo = holeIndex + 1;
    const num = parseInt(value, 10);
    const safeVal = Number.isFinite(num) ? num : "";

    setFoursomesScores((prev) => {
      const next = prev.map((x) => ({ ...x }));
      next[holeIndex] = { ...next[holeIndex], [side]: safeVal };
      setFoursomesStatus(
        computeFoursomesStatus(next, matchMeta?.holes || 18, matchMeta, matchSides)
      );
      return next;
    });

    const path = `events/finals-2025/matches/${selectedMatchId}/scores_foursomes/${holeNo}/${side}`;
    set(ref(db, path), safeVal);
  };

  /* =========================
     Render helpers (Rounds + Headers)
     ========================= */
  function renderRoundHeader(label) {
    return (
      <div style={{ marginTop: 16, marginBottom: 6 }}>
        <h4 style={{ margin: 0 }}>{label}</h4>
      </div>
    );
  }

  function splitRounds(totalHoles) {
    if (totalHoles <= 18) return [{ start: 0, end: totalHoles }];
    return [
      { start: 0, end: 18 }, // Round 1
      { start: 18, end: totalHoles }, // Round 2 (18..36)
    ];
  }

  function renderParSiHeader(siSet, start, end, firstColWidth = 140) {
    const info = siSet === "ladies" ? LADIES_HOLE_INFO : MENS_HOLE_INFO;
    const len = end - start;
    return (
      <>
        {/* Hole numbers row (Round 2 shows 1..18 again) */}
        <tr>
          <th style={{ minWidth: firstColWidth }}></th>
          {Array.from({ length: len }, (_, k) => (
            <th key={`hn-${start}-${k}`}>{k + 1}</th>
          ))}
        </tr>
        <tr>
          <th>Par</th>
          {Array.from({ length: len }, (_, k) => {
            const idx = (start + k) % 18;
            return <th key={`par-${start}-${k}`}>{info[idx].par}</th>;
          })}
        </tr>
        <tr>
          <th>SI</th>
          {Array.from({ length: len }, (_, k) => {
            const idx = (start + k) % 18;
            return <th key={`si-${start}-${k}`}>{info[idx].si}</th>;
          })}
        </tr>
      </>
    );
  }

  /* =========================
     Renderers (Scoring)
     ========================= */
  const renderSingles = () => {
    const holes = matchMeta?.holes || 18;
    const rounds = splitRounds(holes);
    const nameA = matchSides?.A?.players?.[0]?.name || "Player A";
    const nameB = matchSides?.B?.players?.[0]?.name || "Player B";

    const useNett = matchMeta?.handicapMode === "nett";
    const { receiver, diff } = computeSinglesDiffAndReceiver(matchSides);

    const strokeGiven = (i, side) =>
      useNett && strokesForSinglesHole(i, side, receiver, diff, matchMeta) > 0;

    const netOf = (gross, i, side) => {
      const g = parseInt(gross, 10);
      if (!Number.isFinite(g)) return "";
      const s = strokeGiven(i, side) ? 1 : 0;
      return g - s;
    };

    return (
      <div style={{ marginTop: 16 }}>
        {/* Title row (sticky) */}
        <div className="sticky-header" style={{ display: "flex", alignItems: "baseline", gap: 12, background: "#fff" }}>
          <h3 style={{ margin: 0 }}>Singles Match</h3>
          <small style={{ marginLeft: 8, color: "#666" }}>
            ({matchMeta?.siSet === "ladies" ? "Ladies SI" : "Men SI"})
          </small>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f7f7f7",
              fontWeight: 600,
            }}
          >
            {singlesStatus || "—"}
          </span>
        </div>

        {/* Rounds */}
        {rounds.map((r, idx) => (
          <div key={`r${idx}`}>
            {renderRoundHeader(idx === 0 ? "Round 1 (Holes 1–18)" : "Round 2 (Holes 1–18)")}
            <div className="scores-table-container" style={{ marginTop: 6 }}>
              <table className="scores-table">
                <thead>{renderParSiHeader(matchMeta?.siSet, r.start, r.end, 140)}</thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameA} (A)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = singlesScores[i]?.A ?? "";
                      return (
                        <td key={`a-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleSinglesScoreChange(i, "A", e.target.value)}
                            style={{
                              width: 48,
                              textAlign: "center",
                              background: strokeGiven(i, "A")
                                ? "rgba(0, 200, 0, 0.08)"
                                : undefined,
                              opacity: canEditThisMatch ? 1 : 0.6,
                              cursor: canEditThisMatch ? "text" : "not-allowed",
                            }}
                            readOnly={!canEditThisMatch}
                            title={
                              canEditThisMatch
                                ? (() => {
                                    const n = netOf(val, i, "A");
                                    return useNett && val !== "" ? `Gross ${val} → Nett ${n}` : "";
                                  })()
                                : "Login to edit"
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameB} (B)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = singlesScores[i]?.B ?? "";
                      return (
                        <td key={`b-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleSinglesScoreChange(i, "B", e.target.value)}
                            style={{
                              width: 48,
                              textAlign: "center",
                              background: strokeGiven(i, "B")
                                ? "rgba(0, 200, 0, 0.08)"
                                : undefined,
                              opacity: canEditThisMatch ? 1 : 0.6,
                              cursor: canEditThisMatch ? "text" : "not-allowed",
                            }}
                            readOnly={!canEditThisMatch}
                            title={
                              canEditThisMatch
                                ? (() => {
                                    const n = netOf(val, i, "B");
                                    return useNett && val !== "" ? `Gross ${val} → Nett ${n}` : "";
                                  })()
                                : "Login to edit"
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFourball = () => {
    const holes = matchMeta?.holes || 18;
    const rounds = splitRounds(holes);
    const nameA0 = matchSides?.A?.players?.[0]?.name || "A1";
    const nameA1 = matchSides?.A?.players?.[1]?.name || "A2";
    const nameB0 = matchSides?.B?.players?.[0]?.name || "B1";
    const nameB1 = matchSides?.B?.players?.[1]?.name || "B2";

    // Stroke tint / tooltips (force SI set from meta)
    const allowances = computeFourballAllowances(matchSides);
    const siInfo4b = matchMeta?.siSet === "ladies" ? LADIES_HOLE_INFO : MENS_HOLE_INFO;

    const strokeGiven4b = (holeIndex, side, playerIdx) => {
      const player = allowances.find((p) => p.side === side && p.idx === playerIdx);
      if (!player) return false;
      const holeSI = siInfo4b[holeIndex % 18]?.si ?? 99;
      return Number.isFinite(player.allowance) && holeSI <= player.allowance;
    };

    const netOf4b = (gross, holeIndex, side, playerIdx) => {
      const g = parseInt(gross, 10);
      if (!Number.isFinite(g)) return "";
      return g - (strokeGiven4b(holeIndex, side, playerIdx) ? 1 : 0);
    };

    const cellStyle4b = (i, side, idx) => ({
      width: 48,
      textAlign: "center",
      background: strokeGiven4b(i, side, idx) ? "rgba(0,200,0,0.08)" : undefined,
      borderColor: strokeGiven4b(i, side, idx) ? "rgba(0,150,0,0.4)" : undefined,
      opacity: canEditThisMatch ? 1 : 0.6,
      cursor: canEditThisMatch ? "text" : "not-allowed",
    });

    const title4b = (i, side, idx, val) =>
      canEditThisMatch
        ? (() => {
            const n = netOf4b(val, i, side, idx);
            return val !== "" ? `Gross ${val} → Nett ${n}` : "";
          })()
        : "Login to edit";

    return (
      <div style={{ marginTop: 16 }}>
        <div className="sticky-header" style={{ display: "flex", alignItems: "baseline", gap: 12, background: "#fff" }}>
          <h3 style={{ margin: 0 }}>Fourball (Best Nett Per Side)</h3>
          <small style={{ marginLeft: 8, color: "#666" }}>
            90% from lowest • ({matchMeta?.siSet === "ladies" ? "Ladies SI" : "Men SI"})
          </small>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f7f7f7",
              fontWeight: 600,
            }}
          >
            {fourballStatus || "—"}
          </span>
        </div>

        {rounds.map((r, idx) => (
          <div key={`r4b${idx}`}>
            {renderRoundHeader(idx === 0 ? "Round 1 (Holes 1–18)" : "Round 2 (Holes 1–18)")}
            <div className="scores-table-container" style={{ marginTop: 6 }}>
              <table className="scores-table">
                <thead>{renderParSiHeader(matchMeta?.siSet, r.start, r.end, 160)}</thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameA0} (A1)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = fourballScores[i]?.A?.p0 ?? "";
                      return (
                        <td key={`a0-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFourballChange(i, "A", 0, e.target.value)}
                            style={cellStyle4b(i, "A", 0)}
                            readOnly={!canEditThisMatch}
                            title={title4b(i, "A", 0, val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameA1} (A2)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = fourballScores[i]?.A?.p1 ?? "";
                      return (
                        <td key={`a1-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFourballChange(i, "A", 1, e.target.value)}
                            style={cellStyle4b(i, "A", 1)}
                            readOnly={!canEditThisMatch}
                            title={title4b(i, "A", 1, val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameB0} (B1)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = fourballScores[i]?.B?.p0 ?? "";
                      return (
                        <td key={`b0-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFourballChange(i, "B", 0, e.target.value)}
                            style={cellStyle4b(i, "B", 0)}
                            readOnly={!canEditThisMatch}
                            title={title4b(i, "B", 0, val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameB1} (B2)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = fourballScores[i]?.B?.p1 ?? "";
                      return (
                        <td key={`b1-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFourballChange(i, "B", 1, e.target.value)}
                            style={cellStyle4b(i, "B", 1)}
                            readOnly={!canEditThisMatch}
                            title={title4b(i, "B", 1, val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFoursomes = () => {
    const holes = matchMeta?.holes || 18;
    const rounds = splitRounds(holes);
    const nameA = `${matchSides?.A?.players?.[0]?.name || "A1"} & ${
      matchSides?.A?.players?.[1]?.name || "A2"
    }`;
    const nameB = `${matchSides?.B?.players?.[0]?.name || "B1"} & ${
      matchSides?.B?.players?.[1]?.name || "B2"
    }`;

    const { receiver: fmReceiver, diff: fmDiff } = computeFoursomesDiff(matchSides);
    const strokeGivenFm = (holeIndex, side) =>
      strokesForFoursomesHole(
        holeIndex,
        side,
        fmReceiver,
        fmDiff,
        matchMeta,
        MENS_HOLE_INFO,
        LADIES_HOLE_INFO
      ) > 0;

    const netOfFm = (gross, i, side) => {
      const g = parseInt(gross, 10);
      if (!Number.isFinite(g)) return "";
      return g - (strokeGivenFm(i, side) ? 1 : 0);
    };

    const cellStyleFm = (i, side) => ({
      width: 48,
      textAlign: "center",
      background: strokeGivenFm(i, side) ? "rgba(0,200,0,0.08)" : undefined,
      borderColor: strokeGivenFm(i, side) ? "rgba(0,150,0,0.4)" : undefined,
      opacity: canEditThisMatch ? 1 : 0.6,
      cursor: canEditThisMatch ? "text" : "not-allowed",
    });

    const titleFm = (i, side, val) =>
      canEditThisMatch
        ? (() => {
            const n = netOfFm(val, i, side);
            return val !== "" ? `Gross ${val} → Nett ${n}` : "";
          })()
        : "Login to edit";

    return (
      <div style={{ marginTop: 16 }}>
        <div className="sticky-header" style={{ display: "flex", alignItems: "baseline", gap: 12, background: "#fff" }}>
          <h3 style={{ margin: 0 }}>Foursomes (Alternate Shot)</h3>
          <small style={{ marginLeft: 8, color: "#666" }}>
            50% combined • ({matchMeta?.siSet === "ladies" ? "Ladies SI" : "Men SI"})
          </small>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f7f7f7",
              fontWeight: 600,
            }}
          >
            {foursomesStatus || "—"}
          </span>
        </div>

        {rounds.map((r, idx) => (
          <div key={`rfm${idx}`}>
            {renderRoundHeader(idx === 0 ? "Round 1 (Holes 1–18)" : "Round 2 (Holes 1–18)")}
            <div className="scores-table-container" style={{ marginTop: 6 }}>
              <table className="scores-table">
                <thead>{renderParSiHeader(matchMeta?.siSet, r.start, r.end, 200)}</thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameA} (A)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = foursomesScores[i]?.A ?? "";
                      return (
                        <td key={`fa-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFoursomesChange(i, "A", e.target.value)}
                            style={cellStyleFm(i, "A")}
                            readOnly={!canEditThisMatch}
                            title={titleFm(i, "A", val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{nameB} (B)</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const val = foursomesScores[i]?.B ?? "";
                      return (
                        <td key={`fb-${i}`}>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            max="15"
                            value={val}
                            onChange={(e) => handleFoursomesChange(i, "B", e.target.value)}
                            style={cellStyleFm(i, "B")}
                            readOnly={!canEditThisMatch}
                            title={titleFm(i, "B", val)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* =========================
     Spectator helpers
     ========================= */
  function holeResultSingles(i, arr, meta, sides) {
  const useNett = meta?.handicapMode === "nett";
  const { receiver, diff } = computeSinglesDiffAndReceiver(sides);

  const aG = parseScore(arr[i]?.A);
  const bG = parseScore(arr[i]?.B);

  // nothing entered
  if (!Number.isFinite(aG) && !Number.isFinite(bG)) return null;

  // 0/0 => halved
  if (aG === 0 && bG === 0) return 0;
  // A=0, B>0 => B wins
  if (aG === 0 && Number.isFinite(bG) && bG > 0) return +1;
  // B=0, A>0 => A wins
  if (bG === 0 && Number.isFinite(aG) && aG > 0) return -1;

  // need both non-zero numbers to compare nett
  if (!Number.isFinite(aG) || !Number.isFinite(bG)) return null;

  const aS = useNett ? strokesForSinglesHole(i, "A", receiver, diff, meta) : 0;
  const bS = useNett ? strokesForSinglesHole(i, "B", receiver, diff, meta) : 0;
  const aN = aG - aS;
  const bN = bG - bS;

  if (aN < bN) return -1;
  if (bN < aN) return +1;
  return 0;
}

  function holeResultFourball(i, arr, meta, sides) {
  // Parse with 0-aware parser
  const a0 = parseScore(arr[i]?.A?.p0);
  const a1 = parseScore(arr[i]?.A?.p1);
  const b0 = parseScore(arr[i]?.B?.p0);
  const b1 = parseScore(arr[i]?.B?.p1);

  // No entries at all
  const anyA = [a0, a1].some(Number.isFinite);
  const anyB = [b0, b1].some(Number.isFinite);
  if (!anyA && !anyB) return null;

  // Concession rules
  const bothAZero = (a0 === 0 || !Number.isFinite(a0)) && (a1 === 0 || !Number.isFinite(a1));
  const bothBZero = (b0 === 0 || !Number.isFinite(b0)) && (b1 === 0 || !Number.isFinite(b1));

  // If both sides picked up entirely -> halved
  if (bothAZero && bothBZero) return 0;

  // If A side both picked up and B has any positive score -> B wins
  if (bothAZero && [b0, b1].some(v => Number.isFinite(v) && v > 0)) return +1;

  // If B side both picked up and A has any positive score -> A wins
  if (bothBZero && [a0, a1].some(v => Number.isFinite(v) && v > 0)) return -1;

  // Otherwise compute best nett per side; 0 means "ignore this player's score"
  const allowances = computeFourballAllowances(sides);
  const siInfo = meta?.siSet === "ladies" ? LADIES_HOLE_INFO : MENS_HOLE_INFO;
  const holeSI = siInfo[i % 18]?.si ?? 99;

  const allow = (side, idx) =>
    allowances.find(p => p.side === side && p.idx === idx)?.allowance ?? -1;

  const nett = (gross, side, idx) => {
    if (!Number.isFinite(gross) || gross <= 0) return Infinity; // ignore 0 or missing
    const gets = holeSI <= allow(side, idx);
    return gross - (gets ? 1 : 0);
  };

  const aBest = Math.min(nett(a0, "A", 0), nett(a1, "A", 1));
  const bBest = Math.min(nett(b0, "B", 0), nett(b1, "B", 1));

  if (!Number.isFinite(aBest) && !Number.isFinite(bBest)) return null;
  if (!Number.isFinite(aBest) && Number.isFinite(bBest)) return +1;
  if (!Number.isFinite(bBest) && Number.isFinite(aBest)) return -1;

  if (aBest < bBest) return -1;
  if (bBest < aBest) return +1;
  return 0;
}


  function holeResultFoursomes(i, arr, meta, sides) {
  const { receiver, diff } = computeFoursomesDiff(sides);

  const aG = parseScore(arr[i]?.A);
  const bG = parseScore(arr[i]?.B);

  if (!Number.isFinite(aG) && !Number.isFinite(bG)) return null;

  // 0 handling
  if (aG === 0 && bG === 0) return 0;
  if (aG === 0 && Number.isFinite(bG) && bG > 0) return +1;
  if (bG === 0 && Number.isFinite(aG) && aG > 0) return -1;

  if (!Number.isFinite(aG) || !Number.isFinite(bG)) return null;

  const aS = strokesForFoursomesHole(
    i, "A", receiver, diff, meta, MENS_HOLE_INFO, LADIES_HOLE_INFO
  );
  const bS = strokesForFoursomesHole(
    i, "B", receiver, diff, meta, MENS_HOLE_INFO, LADIES_HOLE_INFO
  );
  const aN = aG - aS;
  const bN = bG - bS;

  if (aN < bN) return -1;
  if (bN < aN) return +1;
  return 0;
}


  /* =========================
     Spectator view
     ========================= */
  const renderSpectator = () => {
    if (!matchMeta || !matchSides) return null;

    const holes = matchMeta?.holes || 18;
       const rounds = splitRounds(holes);

    const title =
      matchMeta?.format === "singles"
        ? "Singles Match"
        : matchMeta?.format === "fourball"
        ? "Fourball"
        : "Foursomes";

    // Names (spectator-friendly)
    const names =
      matchMeta?.format === "singles"
        ? {
            A: matchSides?.A?.players?.[0]?.name || "Player A",
            B: matchSides?.B?.players?.[0]?.name || "Player B",
          }
        : matchMeta?.format === "fourball"
        ? {
            A: `${matchSides?.A?.players?.[0]?.name || "A1"} & ${
              matchSides?.A?.players?.[1]?.name || "A2"
            }`,
            B: `${matchSides?.B?.players?.[0]?.name || "B1"} & ${
              matchSides?.B?.players?.[1]?.name || "B2"
            }`,
          }
        : {
            A: `${matchSides?.A?.players?.[0]?.name || "A1"} & ${
              matchSides?.A?.players?.[1]?.name || "A2"
            }`,
            B: `${matchSides?.B?.players?.[0]?.name || "B1"} & ${
              matchSides?.B?.players?.[1]?.name || "B2"
            }`,
          };

    // Current status (we already compute per-format)
    const status =
      matchMeta?.format === "singles"
        ? singlesStatus
        : matchMeta?.format === "fourball"
        ? fourballStatus
        : foursomesStatus;

    // Build per-hole result array using the appropriate function
    const results = Array.from({ length: holes }, (_, i) => {
      if (matchMeta.format === "singles")
        return holeResultSingles(i, singlesScores, matchMeta, matchSides);
      if (matchMeta.format === "fourball")
        return holeResultFourball(i, fourballScores, matchMeta, matchSides);
      return holeResultFoursomes(i, foursomesScores, matchMeta, matchSides);
    });

    const cellStyle = (active) => ({
      textAlign: "center",
      padding: "6px 0",
      fontWeight: 700,
      fontSize: 16,
      color: active === "A" ? "#0a7" : active === "B" ? "#06c" : active === "=" ? "#555" : "#bbb",
    });

    return (
      <div style={{ marginTop: 12 }}>
        {/* Big header (sticky) */}
        <div className="sticky-header" style={{ display: "flex", alignItems: "baseline", gap: 12, background: "#fff", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <small style={{ color: "#666" }}>
            ({matchMeta?.siSet === "ladies" ? "Ladies SI" : "Men SI"})
          </small>
          <span
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f7f7f7",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {status || "—"}
          </span>
        </div>

        {/* Names row */}
        <div style={{ marginTop: 8, fontSize: 18, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>
            <b>A:</b> {names.A}
          </span>
          <span>
            <b>B:</b> {names.B}
          </span>
        </div>

        {/* Rounds */}
        {rounds.map((r, idx) => (
          <div key={`sp-${idx}`} style={{ marginTop: 12 }}>
            <h4 style={{ margin: "4px 0" }}>
              {idx === 0 ? "Round 1 (Holes 1–18)" : "Round 2 (Holes 1–18)"}
            </h4>
            <div className="scores-table-container">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 120 }}></th>
                    {Array.from({ length: r.end - r.start }, (_, k) => (
                      <th key={`sp-h-${r.start + k}`} style={{ textAlign: "center" }}>
                        {k + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* A row of dots */}
                  <tr>
                    <td style={{ fontWeight: 600 }}>A</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const res = results[i];
                      return (
                        <td key={`sp-a-${i}`} style={cellStyle(res === -1 ? "A" : null)}>
                          {res === -1 ? "●" : " "}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Halved row */}
                  <tr>
                    <td style={{ fontWeight: 600 }}>=</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const res = results[i];
                      return (
                        <td key={`sp-hv-${i}`} style={cellStyle(res === 0 ? "=" : null)}>
                          {res === 0 ? "–" : " "}
                        </td>
                      );
                    })}
                  </tr>
                  {/* B row of dots */}
                  <tr>
                    <td style={{ fontWeight: 600 }}>B</td>
                    {Array.from({ length: r.end - r.start }, (_, k) => {
                      const i = r.start + k;
                      const res = results[i];
                      return (
                        <td key={`sp-b-${i}`} style={cellStyle(res === 1 ? "B" : null)}>
                          {res === 1 ? "○" : " "}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* =========================
     Login UI (lightweight)
     ========================= */
  const [showLogin, setShowLogin] = useState(false);
  const [pw, setPw] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    const hit = PASSWORDS[pw];
    if (!hit) {
      alert("Incorrect password");
      return;
    }
    setAuth({ ...hit });
    setShowLogin(false);
    setPw("");
  };

  const logout = () => setAuth(null);

  /* =========================
     Main render
     ========================= */
  return (
    <div className="App">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>Finals Day 2025 Scoreboard</h1>

        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {/* Mode toggle */}
          <button
            onClick={() => setMode((m) => (m === "score" ? "spectator" : "score"))}
            title="Switch between Scoring and Spectator view"
          >
            {mode === "score" ? "Switch to Spectator view" : "Switch to Scoring view"}
          </button>

          {/* Login / status */}
          {auth ? (
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#444" }}>
                Logged in as <b>{auth.role}</b>
                {auth.match ? ` (${auth.match})` : ""}
              </span>
              <button onClick={logout}>Log out</button>
            </div>
          ) : (
            <button onClick={() => setShowLogin((s) => !s)}>Scorer/Admin login</button>
          )}
        </div>
      </div>

      {showLogin && !auth && (
        <form onSubmit={handleLogin} style={{ margin: "8px 0", display: "flex", gap: 8 }}>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Enter password"
            style={{ padding: 6, width: 220 }}
          />
          <button type="submit">Login</button>
        </form>
      )}

      <div style={{ margin: "16px 0" }}>
        <label>
          Select Match:&nbsp;
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
          >
            {matchList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "spectator" ? (
        renderSpectator()
      ) : matchMeta?.format === "singles" ? (
        renderSingles()
      ) : matchMeta?.format === "fourball" ? (
        renderFourball()
      ) : matchMeta?.format === "foursomes" ? (
        renderFoursomes()
      ) : null}
    </div>
  );
}

export default App;
