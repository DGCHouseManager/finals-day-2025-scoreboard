// src/matchUtils.js
// Helpers for handicap allowances and nett scoring logic

// --- Stroke Index helpers ---
export function siForHole(holeIndex, siSet, MENS_HOLE_INFO, LADIES_HOLE_INFO) {
  const hole = siSet === "ladies"
    ? LADIES_HOLE_INFO[holeIndex % 18]
    : MENS_HOLE_INFO[holeIndex % 18];
  return hole?.si || holeIndex + 1;
}

// --- Singles handicap ---
export function computeSinglesDiffAndReceiver(players) {
  const hA = players?.A?.handicap || 0;
  const hB = players?.B?.handicap || 0;

  if (hA === hB) return { receiver: null, diff: 0 };

  if (hA > hB) {
    return { receiver: "A", diff: hA - hB };
  } else {
    return { receiver: "B", diff: hB - hA };
  }
}

export function strokesForSinglesHole(holeIndex, side, receiver, diff, matchMeta, MENS_HOLE_INFO, LADIES_HOLE_INFO) {
  if (!receiver || side !== receiver) return 0;
  const si = siForHole(holeIndex, matchMeta?.siSet, MENS_HOLE_INFO, LADIES_HOLE_INFO);
  return si <= diff ? 1 : 0;
}

// --- Fourball handicap ---
// Each player gets 90% of their handicap difference from the lowest in the group
export function computeFourballAllowances(players) {
  const h = [
    { side: "A", idx: 0, h: players?.A?.players?.[0]?.handicap || 0 },
    { side: "A", idx: 1, h: players?.A?.players?.[1]?.handicap || 0 },
    { side: "B", idx: 0, h: players?.B?.players?.[0]?.handicap || 0 },
    { side: "B", idx: 1, h: players?.B?.players?.[1]?.handicap || 0 },
  ];
  const lowest = Math.min(...h.map(x => x.h));
  return h.map(p => ({
    ...p,
    allowance: Math.round((p.h - lowest) * 0.9)
  }));
}

export function strokesForFourballHole(holeIndex, player, allowances, matchMeta, MENS_HOLE_INFO, LADIES_HOLE_INFO) {
  const si = siForHole(holeIndex, matchMeta?.siSet, MENS_HOLE_INFO, LADIES_HOLE_INFO);
  return si <= player.allowance ? 1 : 0;
}

// --- Foursomes handicap ---
// Each side: 50% of combined handicaps. Difference = allowance to higher side
export function computeFoursomesDiff(players) {
  const hA = (players?.A?.players?.[0]?.handicap || 0) + (players?.A?.players?.[1]?.handicap || 0);
  const hB = (players?.B?.players?.[0]?.handicap || 0) + (players?.B?.players?.[1]?.handicap || 0);
  const effA = Math.round(hA / 2);
  const effB = Math.round(hB / 2);

  if (effA === effB) return { receiver: null, diff: 0 };

  if (effA > effB) {
    return { receiver: "A", diff: effA - effB };
  } else {
    return { receiver: "B", diff: effB - effA };
  }
}

export function strokesForFoursomesHole(holeIndex, side, receiver, diff, matchMeta, MENS_HOLE_INFO, LADIES_HOLE_INFO) {
  if (!receiver || side !== receiver) return 0;
  const si = siForHole(holeIndex, matchMeta?.siSet, MENS_HOLE_INFO, LADIES_HOLE_INFO);
  return si <= diff ? 1 : 0;
}

// --- Running status utility (common across formats) ---
export function computeMatchStatus(aHolesWon, bHolesWon, holesPlayed, totalHoles) {
  const diff = aHolesWon - bHolesWon;
  const holesRemaining = totalHoles - holesPlayed;

  if (diff === 0 && holesRemaining === 0) return "Halved";
  if (diff > 0 && diff > holesRemaining) return `A wins ${diff}&${holesRemaining}`;
  if (diff < 0 && -diff > holesRemaining) return `B wins ${-diff}&${holesRemaining}`;
  if (diff > 0) return `A ${diff} UP`;
  if (diff < 0) return `B ${-diff} UP`;
  return "AS"; // all square
}
