import React, { useState, useEffect } from 'react';
import './App.css';

const MENS_HOLE_INFO = [ /* ... same data ... */ ];
const LADIES_HOLE_INFO = [ /* ... same data ... */ ];

const COMPETITIONS = {
  Men: [ /* ... same data ... */ ],
  Ladies: [ /* ... same data ... */ ],
};

const PASSWORDS = {
  DCadmin2025: { role: 'admin' },
  ...Object.fromEntries([...Array(8)].flatMap((_, i) => [
    [`MenG${i + 1}`, { role: 'scorer', comp: 'Men', group: i }],
    [`LadiesG${i + 1}`, { role: 'scorer', comp: 'Ladies', group: i }]
  ]))
};

const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbzj6sRJbrBBZBL_mhTLaEVfXxHmoriye45C5-SVARmdY2RxVuamXdOzieqBFPLkDJE_Vg/exec";

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [view, setView] = useState('summary');
  const [auth, setAuth] = useState(null);

  const HOLE_INFO = selectedCompetition === 'Men' ? MENS_HOLE_INFO : LADIES_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition];

  useEffect(() => {
    fetch(SHEET_ENDPOINT)
      .then(res => res.json())
      .then(data => setScores(data))
      .catch(err => console.error("Failed to load scores:", err));
  }, []);

  const canEdit = (teamIndex, playerIndex) => {
    if (auth === 'admin') return true;
    if (auth?.role === 'scorer') {
      return auth.group === playerIndex && auth.comp === selectedCompetition;
    }
    return false;
  };

  const getPlayerTotal = (teamIndex, playerIndex) => {
    return (scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || [])
      .reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const updateScore = (teamIndex, playerIndex, holeIndex, value) => {
    const updated = {
      comp: selectedCompetition,
      team: teamIndex,
      player: playerIndex,
      hole: holeIndex,
      score: value
    };
    fetch(SHEET_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(updated),
      headers: { "Content-Type": "application/json" }
    });

    setScores(prev => {
      const next = { ...prev };
      next[selectedCompetition] ||= {};
      next[selectedCompetition][teamIndex] ||= {};
      next[selectedCompetition][teamIndex][playerIndex] ||= Array(18).fill('');
      next[selectedCompetition][teamIndex][playerIndex][holeIndex] = value;
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
            {HOLE_INFO.map(h => <th key={h.si}>{h.si}</th>)}
            <th></th>
          </tr>
          <tr className="sub-header">
            <th>Yards</th>
            {HOLE_INFO.map(h => <th key={h.yards}>{h.yards}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, teamIndex) => (
            <tr key={teamIndex}>
              <td className="player-name-cell">
                <img src={team.logo} alt={team.name} className="club-logo" />
                Player {groupIndex + 1}
              </td>
              {HOLE_INFO.map((_, holeIndex) => (
                <td key={holeIndex}>
                  <input
                    type="number"
                    className="hole-input"
                    value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                    onChange={(e) => updateScore(teamIndex, groupIndex, holeIndex, e.target.value)}
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
    const totals = teams.map((team, i) => ({
      name: team.name,
      color: team.color,
      logo: team.logo,
      total: [...Array(8)].reduce((sum, g) => sum + getPlayerTotal(i, g), 0)
    })).sort((a, b) => a.total - b.total);

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

  const handleLogin = () => {
    const input = prompt("Enter scorer password:");
    const creds = PASSWORDS[input];
    if (creds) {
      setAuth(creds);
      if (creds.role === 'scorer') {
        setSelectedCompetition(creds.comp);
        setView(`group-${creds.group}`);
      }
    } else {
      alert("Invalid password.");
    }
  };

  return (
    <div className="app">
      <h1>Danum Cup Scoreboard</h1>
      <div className="tabs">
        {["Men", "Ladies"].map(comp => (
          <button
            key={comp}
            className={`tab ${selectedCompetition === comp ? 'active' : ''}`}
            onClick={() => setSelectedCompetition(comp)}
          >
            {comp}
          </button>
        ))}
      </div>

      <div className="group-navigation">
        <label>View:</label>
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="summary">Summary</option>
          <option value="all">All Scores</option>
          {[...Array(8)].map((_, i) => (
            <option key={i} value={`group-${i}`}>Group {i + 1}</option>
          ))}
        </select>
        <button onClick={handleLogin} style={{ marginLeft: '20px' }}>Scorer Login</button>
      </div>

      {view === 'summary' && renderSummary()}
      {view === 'all' && [...Array(8)].map((_, i) => renderGroupTable(i))}
      {view.startsWith('group-') && renderGroupTable(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;
