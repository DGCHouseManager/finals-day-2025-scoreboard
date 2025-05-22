// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

const MENS_HOLE_INFO = [ /* same as yours */ ];
const LADIES_HOLE_INFO = [ /* same as yours */ ];

const COMPETITIONS = { /* same as yours */ };

const PASSWORDS = {
  DCadmin2025: { role: 'admin' },
  ...Object.fromEntries([...Array(8)].flatMap((_, i) => [
    [`MenG${i + 1}`, { role: 'scorer', comp: 'Men', group: i }],
    [`LadiesG${i + 1}`, { role: 'scorer', comp: 'Ladies', group: i }]
  ]))
};

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzj6sRJbrBBZBL_mhTLaEVfXxHmoriye45C5-SVARmdY2RxVuamXdOzieqBFPLkDJE_Vg/exec';

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [view, setView] = useState('summary');
  const [auth, setAuth] = useState(null);
  const [playerNames, setPlayerNames] = useState({ Men: [[], [], []], Ladies: [[], [], []] });

  const HOLE_INFO = selectedCompetition === 'Men' ? MENS_HOLE_INFO : LADIES_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition] || [];

  useEffect(() => {
  fetch(SHEET_API_URL)
    .then(res => res.json())
    .then(data => {
      setScores(data?.scores || {});
      setPlayerNames(data?.names || { Men: [[], [], []], Ladies: [[], [], []] });
    })
    .catch(console.error);
}, []);

  const handleLogin = () => {
    const input = prompt("Enter scorer password:");
    if (!input) return;
    const match = PASSWORDS[input];
    if (match?.role === 'admin') setAuth('admin');
    else if (match?.role === 'scorer') {
      setSelectedCompetition(match.comp);
      setView(`group-${match.group}`);
      setAuth({ ...match });
    } else {
      alert("Invalid password");
    }
  };

  const canEdit = (teamIndex, playerIndex) => {
    if (auth === 'admin') return true;
    if (auth?.role === 'scorer' && auth.comp === selectedCompetition && auth.group === playerIndex) return true;
    return false;
  };

  const updateSheet = (newScores) => {
    fetch(SHEET_API_URL, {
      method: 'POST',
      body: JSON.stringify({ scores: newScores }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(console.error);
  };

  const handleScoreChange = (teamIndex, playerIndex, holeIndex, value) => {
    const newScores = { ...scores };
    newScores[selectedCompetition] ||= {};
    newScores[selectedCompetition][teamIndex] ||= {};
    newScores[selectedCompetition][teamIndex][playerIndex] ||= Array(18).fill('');
    newScores[selectedCompetition][teamIndex][playerIndex][holeIndex] = value;
    setScores(newScores);
    updateSheet(newScores);
  };

  const getPlayerTotal = (teamIndex, playerIndex) =>
    (scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || []).reduce((sum, val) => sum + (parseInt(val) || 0), 0);

  const renderScoreTable = (groupIndex) => (
    <div className="group-section" key={groupIndex}>
      <h3 className="group-header">Group {groupIndex + 1}</h3>
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Player</th>
            {HOLE_INFO.map((_, i) => <th key={i}>H{i + 1}</th>)}
            <th>Total</th>
          </tr>
          <tr className="sub-header">
            <th></th>
            {HOLE_INFO.map((hole, i) => <th key={i}>S.I. {hole.si}</th>)}
            <th></th>
          </tr>
          <tr className="sub-header">
            <th></th>
            {HOLE_INFO.map((hole, i) => <th key={i}>{hole.yards} yds</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, teamIndex) => (
            <tr key={teamIndex}>
              <td className="player-name-cell">
                <img src={team.logo} alt={team.name} className="club-logo" />
                {playerNames[selectedCompetition]?.[teamIndex]?.[groupIndex] || `Player ${groupIndex + 1}`}
              </td>
              {HOLE_INFO.map((_, holeIndex) => (
                <td key={holeIndex}>
                  <input
                    className="hole-input"
                    type="number"
                    disabled={!canEdit(teamIndex, groupIndex)}
                    value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                    onChange={(e) => handleScoreChange(teamIndex, groupIndex, holeIndex, e.target.value)}
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

  const renderAllScores = () => [...Array(8)].map((_, groupIndex) => renderScoreTable(groupIndex));

  const renderSummary = () => {
    const totals = teams.map((team, i) => ({
      name: team.name,
      total: [...Array(8)].reduce((sum, pIdx) => sum + getPlayerTotal(i, pIdx), 0),
      logo: team.logo,
      color: team.color,
    })).sort((a, b) => a.total - b.total);

    return (
      <table className="summary-table">
        <thead><tr><th>Team</th><th>Total</th></tr></thead>
        <tbody>
          {totals.map((team, idx) => (
            <tr key={idx}>
              <td className="player-name-cell" style={{ color: team.color }}>
                <img src={team.logo} alt={team.name} className="club-logo" />
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
        {["Men", "Ladies"].map((comp) => (
          <button key={comp} className={`tab ${selectedCompetition === comp ? 'active' : ''}`} onClick={() => setSelectedCompetition(comp)}>
            {comp}
          </button>
        ))}
      </div>
      <div className="group-navigation">
        <label htmlFor="view-select">View:</label>
        <select id="view-select" value={view} onChange={(e) => setView(e.target.value)}>
          <option value="summary">Summary</option>
          <option value="all">All Scores</option>
          {[...Array(8)].map((_, i) => <option key={i} value={`group-${i}`}>Group {i + 1}</option>)}
        </select>
        <button style={{ marginLeft: '20px' }} onClick={handleLogin}>Scorer Login</button>
      </div>
      {view === 'summary' && renderSummary()}
      {view === 'all' && renderAllScores()}
      {view.startsWith('group-') && renderScoreTable(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;
