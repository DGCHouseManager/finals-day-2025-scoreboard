// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

const MENS_HOLE_INFO = [
  { par: 4, si: 11, yards: 392 }, { par: 4, si: 5, yards: 386 },
  { par: 4, si: 13, yards: 386 }, { par: 3, si: 15, yards: 175 },
  { par: 4, si: 1, yards: 427 }, { par: 3, si: 17, yards: 137 },
  { par: 4, si: 7, yards: 400 }, { par: 4, si: 3, yards: 411 },
  { par: 4, si: 9, yards: 373 }, { par: 4, si: 12, yards: 359 },
  { par: 3, si: 14, yards: 198 }, { par: 5, si: 6, yards: 530 },
  { par: 4, si: 2, yards: 447 }, { par: 4, si: 10, yards: 372 },
  { par: 4, si: 4, yards: 437 }, { par: 4, si: 16, yards: 291 },
  { par: 3, si: 18, yards: 152 }, { par: 4, si: 8, yards: 388 },
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
  { par: 3, si: 18, yards: 128 }, { par: 4, si: 10, yards: 318 },
];

const COMPETITIONS = {
  Men: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c', logo: '/logos/doncaster-gc.png' },
    { name: 'Wheatley Golf Club', color: '#0a2e20', logo: '/logos/wheatley-gc.png' },
    { name: 'Doncaster Town Moor Golf Club', color: '#1b365d', logo: '/logos/doncaster-town-moor-gc.png' },
  ],
  Ladies: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c', logo: '/logos/doncaster-gc.png' },
    { name: 'Wheatley Golf Club', color: '#0a2e20', logo: '/logos/wheatley-gc.png' },
    { name: 'Hickleton Golf Club', color: '#1172a2', logo: '/logos/hickleton-gc.png' },
  ],
};

const PASSWORDS = {
  DCadmin2025: { role: 'admin' },
  ...Object.fromEntries([...Array(8)].flatMap((_, i) => [
    [`MenG${i + 1}`, { role: 'scorer', comp: 'Men', group: i }],
    [`LadiesG${i + 1}`, { role: 'scorer', comp: 'Ladies', group: i }]
  ]))
};

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [view, setView] = useState('summary');
  const [auth, setAuth] = useState(null); // null, 'admin', or { groupIndex: number }

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
            groupedNames[comp][teamIndex] ||= [];
            groupedNames[comp][teamIndex][groupIndex] = playerName;
          }
        });
        setPlayerNames(groupedNames);
        localStorage.setItem("playerNames", JSON.stringify(groupedNames));
      }
    });
  }, []);

  const HOLE_INFO = selectedCompetition.toLowerCase() === 'men' ? MENS_HOLE_INFO : WOMENS_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition];

  const canEdit = (teamIndex, playerIndex) => {
    if (auth === 'admin') return true;
    if (auth && typeof auth.groupIndex === 'number') return auth.groupIndex === playerIndex;
    return false;
  };

  const handleScoreChange = (teamIndex, playerIndex, holeIndex, value) => {
    const newScores = { ...scores };
    newScores[selectedCompetition] ||= {};
    newScores[selectedCompetition][teamIndex] ||= {};
    newScores[selectedCompetition][teamIndex][playerIndex] ||= Array(18).fill('');
    newScores[selectedCompetition][teamIndex][playerIndex][holeIndex] = value;
    setScores(newScores);
  };

  const handleNameChange = (teamIndex, playerIndex, value) => {
    const newNames = { ...playerNames };
    newNames[selectedCompetition][teamIndex][playerIndex] = value;
    setPlayerNames(newNames);
    localStorage.setItem("playerNames", JSON.stringify(newNames));
  };

  const getPlayerTotal = (teamIndex, playerIndex) => {
    return (scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || [])
      .reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const renderGroupTable = (groupIndex) => (
    <div className="team-card" key={groupIndex}>
      <h2>Group {groupIndex + 1}</h2>
      <div className="players">
        <div className="hole-header">
          <span className="player-label">Player</span>
          {HOLE_INFO.map((_, index) => <div key={index} className="hole-info">H{index + 1}</div>)}
          <span className="player-total">Total</span>
        </div>
        <div className="hole-header sub-row">
          <span className="player-label">&nbsp;</span>
          {HOLE_INFO.map((hole, index) => <div key={index} className="hole-info">S.I. {hole.si}</div>)}
          <span className="player-total">&nbsp;</span>
        </div>
        <div className="hole-header sub-row">
          <span className="player-label">&nbsp;</span>
          {HOLE_INFO.map((hole, index) => <div key={index} className="hole-info">{hole.yards} yds</div>)}
          <span className="player-total">&nbsp;</span>
        </div>
        {teams.map((team, teamIndex) => (
          <div key={teamIndex} className="player-row">
            <span className="player-label">
              <img src={team.logo} alt={team.name} className="club-logo" />
              {playerNames[selectedCompetition]?.[teamIndex]?.[groupIndex] || `Player ${groupIndex + 1}`}
            </span>
            {[...Array(18)].map((_, holeIndex) => (
              <input
                key={holeIndex}
                type="number"
                min="1"
                max="12"
                className="hole-input"
                disabled={!canEdit(teamIndex, groupIndex)}
                value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                onChange={(e) => handleScoreChange(teamIndex, groupIndex, holeIndex, e.target.value)}
              />
            ))}
            <span className="player-total">{getPlayerTotal(teamIndex, groupIndex)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAllScores = () => [...Array(8)].map((_, groupIndex) => renderGroupTable(groupIndex));

  const renderSummary = () => {
    const totals = teams.map((team, i) => ({
      name: team.name,
      color: team.color,
      logo: team.logo,
      total: [...Array(8)].reduce((sum, pIdx) => sum + getPlayerTotal(i, pIdx), 0)
    })).sort((a, b) => a.total - b.total);

    return (
      <table className="summary-table">
        <thead>
          <tr><th>Team</th><th>Total Score</th></tr>
        </thead>
        <tbody>
          {totals.map((team, idx) => (
            <tr key={idx}>
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
    if (!input) return;
    if (input === "DCadmin2025") {
      setAuth("admin");
    } else {
      const match = input.match(/^(Men|Ladies)G([1-8])$/i);
      if (match) {
        const groupIndex = parseInt(match[2], 10) - 1;
        setSelectedCompetition(match[1] === "Men" ? "Men" : "Ladies");
        setAuth({ groupIndex });
        setView(`group-${groupIndex}`);
      } else {
        alert("Invalid password");
      }
    }
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
        <label htmlFor="view-select">View:</label>
        <select id="view-select" value={view} onChange={(e) => setView(e.target.value)}>
          <option value="summary">Summary</option>
          <option value="all">All Scores</option>
          {[...Array(8)].map((_, i) => (
            <option key={i} value={`group-${i}`}>Group {i + 1}</option>
          ))}
        </select>
        <button style={{ marginLeft: '20px' }} onClick={handleLogin}>Scorer Login</button>
      </div>
      {view === 'summary' && renderSummary()}
      {view === 'all' && renderAllScores()}
      {view.startsWith('group-') && renderGroupTable(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;
