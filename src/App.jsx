import React, { useEffect, useState } from 'react';
import { ref, set, child, onValue } from 'firebase/database';
import { db } from './firebase';
import './App.css';

const MENS_HOLE_INFO = [
  { par: 4, si: 11, yards: 392 }, { par: 4, si: 5, yards: 386 },
  { par: 4, si: 13, yards: 386 }, { par: 3, si: 15, yards: 175 },
  { par: 4, si: 1, yards: 427 }, { par: 3, si: 17, yards: 137 },
  { par: 4, si: 7, yards: 400 }, { par: 4, si: 3, yards: 411 },
  { par: 4, si: 9, yards: 373 }, { par: 4, si: 12, yards: 359 },
  { par: 3, si: 14, yards: 198 }, { par: 5, si: 6, yards: 530 },
  { par: 4, si: 2, yards: 447 }, { par: 4, si: 10, yards: 372 },
  { par: 4, si: 4, yards: 437 }, { par: 4, si: 16, yards: 291 },
  { par: 3, si: 18, yards: 152 }, { par: 4, si: 8, yards: 388 }
];

const LADIES_HOLE_INFO = [
  { par: 4, si: 5, yards: 368 }, { par: 4, si: 9, yards: 335 },
  { par: 4, si: 3, yards: 357 }, { par: 3, si: 13, yards: 152 },
  { par: 5, si: 15, yards: 373 }, { par: 3, si: 17, yards: 123 },
  { par: 4, si: 7, yards: 340 }, { par: 5, si: 11, yards: 407 },
  { par: 4, si: 1, yards: 361 }, { par: 4, si: 6, yards: 331 },
  { par: 3, si: 14, yards: 167 }, { par: 5, si: 4, yards: 453 },
  { par: 5, si: 12, yards: 393 }, { par: 4, si: 8, yards: 334 },
  { par: 4, si: 2, yards: 381 }, { par: 4, si: 16, yards: 248 },
  { par: 3, si: 18, yards: 128 }, { par: 4, si: 10, yards: 318 }
];

const COMPETITIONS = {
  Men: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c', logo: '/logos/doncaster-gc.png' },
    { name: 'Wheatley Golf Club', color: '#0a2e20', logo: '/logos/wheatley-gc.png' },
    { name: 'Doncaster Town Moor Golf Club', color: '#1b365d', logo: '/logos/doncaster-town-moor-gc.png' }
  ],
  Ladies: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c', logo: '/logos/doncaster-gc.png' },
    { name: 'Wheatley Golf Club', color: '#0a2e20', logo: '/logos/wheatley-gc.png' },
    { name: 'Hickleton Golf Club', color: '#1172a2', logo: '/logos/hickleton-gc.png' }
  ]
};

const PASSWORDS = {
  DCadmin2025: { role: 'admin' },
  ...Object.fromEntries([...Array(8)].flatMap((_, i) => [
    [`MenG${i + 1}`, { role: 'scorer', comp: 'Men', group: i }],
    [`LadiesG${i + 1}`, { role: 'scorer', comp: 'Ladies', group: i }]
  ]))
};

const PLAYER_NAMES = {
  Men: {
    0: ["Kyle Johnson-Rolfe", "Max Reynolds", "James Pickersgill"],
    1: ["Andrew Wilkinson", "Neil Stones", "Cameron Hanrahan"],
    2: ["Luke Gregory", "Nathan Bradey", "Peter Fletcher"],
    3: ["Samuel Fry", "Ashley Ibbotson", "Tony Cobb"],
    4: ["Ashley Moore", "Nigel Etheridge", "Jason Pemberton"],
    5: ["Paul Foster", "Russ Carter", "Stuart Hanson"],
    6: ["Matthew Tighe", "Jonathan Ellis", "Anthony Dewsnap"],
    7: ["Stuart Booth", "Nicholas Brown", "John Simpson"]
  },
  Ladies: {
    0: ["Ellie Parker", "Karen Wilkinson", "Emma Brannon"],
    1: ["Bet Sworowski", "Melanie Southwell", "Deonne Pyatt"],
    2: ["Lindsey Griffin", "Sarah Barlow", "Carol Ellis"],
    3: ["Tracey Aveling", "Alison Allsopp", "Teresa Harrison"],
    4: ["Louise Parkin", "Gwynille Banks", "Gill Shepherd"],
    5: ["Maria Clark", "Ann Moran", "Jane Guest"],
    6: ["Susan Cribb", "Kathleen Houseman", "Trina Swain"],
    7: ["Liz Nevens", "Helen Talbot", "Carole Thorp"]
  }
};

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState("Men");
  const [view, setView] = useState("summary");
  const [scores, setScores] = useState({});
  const [auth, setAuth] = useState(null);

  const HOLE_INFO = selectedCompetition === "Men" ? MENS_HOLE_INFO : (selectedCompetition === "Ladies" ? LADIES_HOLE_INFO : []);
  const teams = COMPETITIONS[selectedCompetition] || [];

  useEffect(() => {
    const scoresRef = child(ref(db), 'scores');

    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const rawData = snapshot.val() || {};
      console.log("Realtime update from Firebase:", rawData);

      const structured = { Men: {}, Ladies: {} };

      Object.values(rawData).forEach(row => {
        const comp = row.Competition;
        const teamIndex = COMPETITIONS[comp]?.findIndex(t => t.name === row["Team Name"]);
        const groupIndex = parseInt(row.Group, 10) - 1;
        if (teamIndex === -1 || groupIndex < 0) return;

        const holeScores = Array(18).fill('');
        for (let i = 1; i <= 18; i++) {
          holeScores[i - 1] = row[`Hole ${i}`] || '';
        }

        if (!structured[comp][teamIndex]) structured[comp][teamIndex] = {};
        structured[comp][teamIndex][groupIndex] = holeScores;
      });

      setScores(structured);
    }, (error) => {
      console.error("Realtime Firebase error:", error);
      alert("Failed to load scores.");
    });

    return () => unsubscribe();
  }, []);

  const getPlayerTotal = (teamIndex, groupIndex) => {
    const vals = scores[selectedCompetition]?.[teamIndex]?.[groupIndex] || [];
    return vals.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const canEdit = (teamIndex, groupIndex) => {
    if (auth?.role === "admin") return true;
    if (auth?.role === "scorer") {
      return auth.comp === selectedCompetition && auth.group === groupIndex;
    }
    return false;
  };

  const handleLogin = () => {
    const input = prompt("Enter scorer password:");
    const creds = PASSWORDS[input];
    if (creds) {
      setAuth(creds);
      if (creds.role === "scorer") {
        setSelectedCompetition(creds.comp);
        setView(`group-${creds.group}`);
      }
    } else {
      alert("Invalid password.");
    }
  };

  const handleScoreChange = (teamIndex, groupIndex, holeIndex, value) => {
    const updated = {
      Competition: selectedCompetition,
      "Team Name": COMPETITIONS[selectedCompetition][teamIndex].name,
      Group: `${groupIndex + 1}`,
      "Player Name": PLAYER_NAMES[selectedCompetition]?.[groupIndex]?.[teamIndex] || `Player ${groupIndex + 1}`
    };

    for (let i = 1; i <= 18; i++) {
      updated[`Hole ${i}`] = scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[i - 1] || '';
    }

    updated[`Hole ${holeIndex + 1}`] = value;

    set(ref(db, `scores/${selectedCompetition}-${teamIndex}-${groupIndex}`), updated)
      .then(() => console.log("Saved to Firebase"))
      .catch(err => console.error("Error saving to Firebase:", err));

    setScores(prev => {
      const next = { ...prev };
      next[selectedCompetition] ||= {};
      next[selectedCompetition][teamIndex] ||= {};
      next[selectedCompetition][teamIndex][groupIndex] ||= Array(18).fill('');
      next[selectedCompetition][teamIndex][groupIndex][holeIndex] = value;
      return next;
    });
  };

  const renderGroupTable = (groupIndex) => (
    <div className="group-section" key={groupIndex}>
      <h2 className="group-header">Group {groupIndex + 1}</h2>
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Player</th>
            {HOLE_INFO.map((_, i) => <th key={i}>H{i + 1}</th>)}
            <th>Total</th>
          </tr>
          <tr className="sub-header">
            <th>S.I.</th>
            {HOLE_INFO.map((h, i) => <th key={i}>{h.si}</th>)}
            <th></th>
          </tr>
          <tr className="sub-header">
            <th>Yards</th>
            {HOLE_INFO.map((h, i) => <th key={i}>{h.yards}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, teamIndex) => (
            <tr key={teamIndex}>
              <td className="player-name-cell">
                <img src={team.logo} className="club-logo" alt={team.name} />
                {PLAYER_NAMES[selectedCompetition]?.[groupIndex]?.[teamIndex] || `Player ${groupIndex + 1}`}
              </td>
              {HOLE_INFO.map((_, holeIndex) => (
                <td key={holeIndex}>
                  <input
                    type="number"
                    className="hole-input"
                    value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                    onChange={e => handleScoreChange(teamIndex, groupIndex, holeIndex, e.target.value)}
                    disabled={!canEdit(teamIndex, groupIndex)}
                  />
                </td>
              ))}
              <td className="player-total">{getPlayerTotal(teamIndex, groupIndex)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSummary = () => {
    const totals = teams.map((team, teamIndex) => {
      const groupScores = Object.values(scores[selectedCompetition]?.[teamIndex] || {});
      const total = groupScores.reduce(
        (teamSum, playerScores) =>
          teamSum + (Array.isArray(playerScores)
            ? playerScores.reduce((sum, v) => sum + (parseInt(v) || 0), 0)
            : 0),
        0
      );

      return {
        name: team.name,
        color: team.color,
        logo: team.logo,
        total
      };
    }).sort((a, b) => a.total - b.total);

    return (
      <table className="summary-table">
        <thead>
          <tr><th>Team</th><th>Total Score</th></tr>
        </thead>
        <tbody>
          {totals.map((team, i) => (
            <tr key={i}>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: team.color }}>
                <img src={team.logo} alt={team.name} style={{ height: '24px' }} />
                {team.name}
              </td>
              <td>{team.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="app">
      <h1>Danum Cup Scoreboard</h1>

      <div className="tabs">
        {["Men", "Ladies"].map(comp => (
          <button key={comp} className={`tab ${selectedCompetition === comp ? 'active' : ''}`} onClick={() => setSelectedCompetition(comp)}>
            {comp}
          </button>
        ))}
      </div>

      <div className="group-navigation">
        <label>View:</label>
        <select value={view} onChange={e => setView(e.target.value)}>
          <option value="summary">Summary</option>
          <option value="all">All Scores</option>
          {[...Array(8)].map((_, i) => (
            <option key={i} value={`group-${i}`}>Group {i + 1}</option>
          ))}
        </select>
        <button style={{ marginLeft: '20px' }} onClick={handleLogin}>Scorer Login</button>
      </div>

      {view === 'summary' && renderSummary()}
      {view === 'all' && [...Array(8)].map((_, i) => renderGroupTable(i))}
      {view.startsWith('group-') && renderGroupTable(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;