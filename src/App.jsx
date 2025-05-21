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
  const [playerNames, setPlayerNames] = useState(() => {
    const saved = localStorage.getItem("playerNames");
    return saved ? JSON.parse(saved) : { Men: [[], [], []], Ladies: [[], [], []] };
  });
  const [auth, setAuth] = useState({ role: 'viewer' });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const HOLE_INFO = selectedCompetition === 'Men' ? MENS_HOLE_INFO : LADIES_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition];

  useEffect(() => {
    Papa.parse('/player-names.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const groupedNames = { Men: [[], [], []], Ladies: [[], [], []] };
        result.data.forEach(row => {
          const { Competition, Group, Team, 'Player Name': playerName } = row;
          const comp = Competition.trim().replace('Women', 'Ladies');
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

  const canEdit = (teamIndex, playerIndex) => {
    if (auth.role === 'admin') return true;
    if (auth.role === 'scorer') {
      const { comp, group } = auth;
      return comp === selectedCompetition && playerIndex === group;
    }
    return false;
  };

  const handleLogin = () => {
    const creds = PASSWORDS[passwordInput];
    if (creds) {
      setAuth(creds);
      setLoginError('');
    } else {
      setLoginError('Invalid password.');
    }
    setPasswordInput('');
  };

  const handleScoreChange = (teamIndex, playerIndex, holeIndex, value) => {
    if (!canEdit(teamIndex, playerIndex)) return;
    const newScores = { ...scores };
    if (!newScores[selectedCompetition]) newScores[selectedCompetition] = {};
    if (!newScores[selectedCompetition][teamIndex]) newScores[selectedCompetition][teamIndex] = {};
    if (!newScores[selectedCompetition][teamIndex][playerIndex]) newScores[selectedCompetition][teamIndex][playerIndex] = Array(18).fill('');
    newScores[selectedCompetition][teamIndex][playerIndex][holeIndex] = value;
    setScores(newScores);
  };

  const getPlayerTotal = (teamIndex, playerIndex) => {
    return (scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || []).reduce((sum, x) => sum + (parseInt(x) || 0), 0);
  };

  const renderTable = (players) => (
    <table className="scorecard-table">
      <thead>
        <tr><th>Player</th>{HOLE_INFO.map((_, i) => <th key={i}>{i + 1}</th>)}<th>Total</th></tr>
        <tr><th>Par</th>{HOLE_INFO.map((h, i) => <th key={i}>{h.par}</th>)}<th>-</th></tr>
        <tr><th>S.I.</th>{HOLE_INFO.map((h, i) => <th key={i}>{h.si}</th>)}<th>-</th></tr>
        <tr><th>Yards</th>{HOLE_INFO.map((h, i) => <th key={i}>{h.yards}</th>)}<th>-</th></tr>
      </thead>
      <tbody>
        {players.map(({ teamIndex, playerIndex }, idx) => {
          const playerName = playerNames[selectedCompetition]?.[teamIndex]?.[playerIndex] || `Player ${playerIndex + 1}`;
          const team = teams[teamIndex];
          return (
            <tr key={idx}>
              <td className="player-name-cell">
                <img src={team.logo} alt={team.name} className="club-logo" />
                {playerName}
              </td>
              {HOLE_INFO.map((_, holeIdx) => (
                <td key={holeIdx}>
                  <input
                    type="number"
                    className="hole-input"
                    value={scores[selectedCompetition]?.[teamIndex]?.[playerIndex]?.[holeIdx] || ''}
                    onChange={(e) => handleScoreChange(teamIndex, playerIndex, holeIdx, e.target.value)}
                  />
                </td>
              ))}
              <td className="player-total">{getPlayerTotal(teamIndex, playerIndex)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderAllScores = () => {
    const players = teams.flatMap((_, teamIndex) =>
      [...Array(8)].map((_, playerIndex) => ({ teamIndex, playerIndex }))
    );
    return renderTable(players);
  };

  const renderGroupView = (groupIndex) => {
    const players = teams.map((_, teamIndex) => ({ teamIndex, playerIndex: groupIndex }));
    return (
      <div className="group-section">
        <h2 className="group-header">Group {groupIndex + 1}</h2>
        {renderTable(players)}
      </div>
    );
  };

  const renderSummary = () => {
    const totals = teams.map((team, i) => ({
      name: team.name,
      color: team.color,
      logo: team.logo,
      total: [...Array(8)].reduce((sum, _, p) => {
        const ps = scores[selectedCompetition]?.[i]?.[p] || [];
        return sum + ps.reduce((s, x) => s + (parseInt(x) || 0), 0);
      }, 0)
    })).sort((a, b) => a.total - b.total);

    return (
      <table className="summary-table">
        <thead><tr><th>Team</th><th>Total Score</th></tr></thead>
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

  return (
    <div className="app">
      <div className="top-bar">
        <h1>Danum Cup Scoreboard</h1>
        <div className="login-box">
          {auth.role === 'viewer' ? (
            <>
              <input type="password" placeholder="Scorer Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
              <button onClick={handleLogin}>Login</button>
              {loginError && <div className="login-error">{loginError}</div>}
            </>
          ) : (
            <div className="welcome-msg">Logged in as <strong>{auth.role === 'admin' ? 'Admin' : `${auth.comp} Group ${auth.group + 1}`}</strong></div>
          )}
        </div>
      </div>

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
      {view === 'all' && renderAllScores()}
      {view.startsWith('group-') && renderGroupView(parseInt(view.split('-')[1]))}
    </div>
  );
}

export default App;
