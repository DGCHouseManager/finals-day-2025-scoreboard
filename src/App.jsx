// File: App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

const MENS_HOLE_INFO = [/* ... */]; // unchanged
const LADIES_HOLE_INFO = [/* ... */]; // renamed from WOMENS_HOLE_INFO

const COMPETITIONS = {
  Men: [/* ... */],
  Ladies: [/* ... */]
};

const PASSWORDS = {
  DCadmin2025: { role: 'admin' },
  MenG1: { role: 'scorer', comp: 'Men', group: 0 },
  MenG2: { role: 'scorer', comp: 'Men', group: 1 },
  MenG3: { role: 'scorer', comp: 'Men', group: 2 },
  MenG4: { role: 'scorer', comp: 'Men', group: 3 },
  MenG5: { role: 'scorer', comp: 'Men', group: 4 },
  MenG6: { role: 'scorer', comp: 'Men', group: 5 },
  MenG7: { role: 'scorer', comp: 'Men', group: 6 },
  MenG8: { role: 'scorer', comp: 'Men', group: 7 },
  LadiesG1: { role: 'scorer', comp: 'Ladies', group: 0 },
  LadiesG2: { role: 'scorer', comp: 'Ladies', group: 1 },
  LadiesG3: { role: 'scorer', comp: 'Ladies', group: 2 },
  LadiesG4: { role: 'scorer', comp: 'Ladies', group: 3 },
  LadiesG5: { role: 'scorer', comp: 'Ladies', group: 4 },
  LadiesG6: { role: 'scorer', comp: 'Ladies', group: 5 },
  LadiesG7: { role: 'scorer', comp: 'Ladies', group: 6 },
  LadiesG8: { role: 'scorer', comp: 'Ladies', group: 7 },
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
              <input
                type="password"
                placeholder="Scorer Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
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
      {view === 'all' && <div>📋 All Scores view goes here (you can adapt from previous layout)</div>}
      {view.startsWith('group-') && <div>📋 Group View logic here (reinsert your renderGroupView method here)</div>}
    </div>
  );
}

export default App;
