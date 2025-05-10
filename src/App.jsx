import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

const MENS_HOLE_INFO = [/* unchanged */];
const WOMENS_HOLE_INFO = [/* unchanged */];
const COMPETITIONS = { /* unchanged */ };

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [view, setView] = useState('summary');
  const getInitialPlayerNames = () => {
    const saved = localStorage.getItem("playerNames");
    return saved ? JSON.parse(saved) : { Men: [[], [], []], Women: [[], [], []] };
  };
  const [playerNames, setPlayerNames] = useState(getInitialPlayerNames);

  useEffect(() => {
    Papa.parse('/player-names.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const groupedNames = { Men: [[], [], []], Women: [[], [], []] };
        result.data.forEach(row => {
          const { Competition, Group, Team, 'Player Name': playerName } = row;
          const comp = Competition.trim();
          const groupIndex = parseInt(Group, 10) - 1;
          const teamIndex = COMPETITIONS[comp]?.findIndex(t => t.name === Team);
          if (teamIndex !== -1 && playerName) {
            if (!groupedNames[comp][teamIndex]) groupedNames[comp][teamIndex] = [];
            groupedNames[comp][teamIndex][groupIndex] = playerName;
          }
        });
        setPlayerNames(groupedNames);
        localStorage.setItem("playerNames", JSON.stringify(groupedNames));
      }
    });
  }, []);

  const competition = selectedCompetition.toLowerCase();
  const HOLE_INFO = competition === 'men' ? MENS_HOLE_INFO : WOMENS_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition];

  const handleScoreChange = (teamIndex, playerIndex, holeIndex, value) => {
    const newScores = { ...scores };
    if (!newScores[selectedCompetition]) newScores[selectedCompetition] = {};
    if (!newScores[selectedCompetition][teamIndex]) newScores[selectedCompetition][teamIndex] = {};
    if (!newScores[selectedCompetition][teamIndex][playerIndex]) newScores[selectedCompetition][teamIndex][playerIndex] = Array(18).fill('');
    newScores[selectedCompetition][teamIndex][playerIndex][holeIndex] = value;
    setScores(newScores);
  };

  const handleNameChange = (teamIndex, playerIndex, value) => {
    const newNames = { ...playerNames };
    if (!newNames[selectedCompetition]) newNames[selectedCompetition] = [];
    if (!newNames[selectedCompetition][teamIndex]) newNames[selectedCompetition][teamIndex] = [];
    newNames[selectedCompetition][teamIndex][playerIndex] = value;
    setPlayerNames(newNames);
    localStorage.setItem("playerNames", JSON.stringify(newNames));
  };

  const getPlayerTotal = (teamIndex, playerIndex) => {
    const playerScores = scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || [];
    return playerScores.reduce((sum, score) => sum + (parseInt(score) || 0), 0);
  };

  const getTeamTotal = (teamIndex) => {
    let total = 0;
    for (let i = 0; i < 8; i++) {
      total += getPlayerTotal(teamIndex, i);
    }
    return total;
  };

  const renderSummary = () => {
    const totals = teams
      .map((team, i) => ({ name: team.name, color: team.color, logo: team.logo, total: getTeamTotal(i) }))
      .sort((a, b) => a.total - b.total);
    return (
      <table className="summary-table">
        <thead>
          <tr><th>Team</th><th>Total Score</th></tr>
        </thead>
        <tbody>
          {totals.map((team, index) => (
            <tr key={index}>
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

  const renderGroupView = (groupIndex) => {
    const groupPlayers = teams.map((_, teamIndex) => ({ teamIndex, playerIndex: groupIndex }));

    return (
      <div className="group-card">
        <h2 className="group-header">Group {groupIndex + 1}</h2>
        <table className="group-table">
          <thead>
            <tr>
              <th>Player</th>
              {HOLE_INFO.map((_, i) => <th key={`h${i}`}>Hole {i + 1}</th>)}
              <th>Total</th>
            </tr>
            <tr>
              <th>Par</th>
              {HOLE_INFO.map((hole, i) => <td key={`p${i}`}>{hole.par}</td>)}
              <td></td>
            </tr>
            <tr>
              <th>S.I.</th>
              {HOLE_INFO.map((hole, i) => <td key={`s${i}`}>{hole.si}</td>)}
              <td></td>
            </tr>
            <tr>
              <th>Yards</th>
              {HOLE_INFO.map((hole, i) => <td key={`y${i}`}>{hole.yards}</td>)}
              <td></td>
            </tr>
          </thead>
          <tbody>
            {groupPlayers.map(({ teamIndex, playerIndex }) => {
              const team = teams[teamIndex];
              return (
                <tr key={`${teamIndex}-${playerIndex}`}>
                  <td className="player-label">
                    <img src={team.logo} alt={team.name} className="club-logo" />
                    {playerNames[selectedCompetition]?.[teamIndex]?.[playerIndex] || `Player ${playerIndex + 1}`}
                  </td>
                  {HOLE_INFO.map((_, holeIndex) => (
                    <td key={holeIndex}>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="hole-input"
                        value={scores[selectedCompetition]?.[teamIndex]?.[playerIndex]?.[holeIndex] || ''}
                        onChange={(e) => handleScoreChange(teamIndex, playerIndex, holeIndex, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="player-total">{getPlayerTotal(teamIndex, playerIndex)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app">
      <h1>Danum Cup Scoreboard</h1>
      <div className="tabs">
        {Object.keys(COMPETITIONS).map((comp) => (
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
          {[...Array(8)].map((_, i) => (
            <option key={i} value={`group-${i}`}>Group {i + 1}</option>
          ))}
        </select>
      </div>
      {view === 'summary' && renderSummary()}
      {view === 'all' && <div className="teams">{/* All Scores view will be refactored separately */}</div>}
      {view.startsWith('group-') && renderGroupView(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;
