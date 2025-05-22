import React, { useState, useEffect } from 'react';
import './App.css';

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzj6sRJbrBBZBL_mhTLaEVfXxHmoriye45C5-SVARmdY2RxVuamXdOzieqBFPLkDJE_Vg/exec';

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

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [view, setView] = useState('summary');

  useEffect(() => {
    fetch(SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        setScores(data?.scores || {});
        setPlayerNames(data?.names || { Men: [[], [], []], Ladies: [[], [], []] });
      })
      .catch((err) => {
        console.error('Failed to fetch Google Sheet data:', err);
      });
  }, []);

  const HOLE_INFO = selectedCompetition === 'Men' ? MENS_HOLE_INFO : LADIES_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition] || [];

  const getPlayerTotal = (teamIndex, playerIndex) => {
    return (scores[selectedCompetition]?.[teamIndex]?.[playerIndex] || []).reduce(
      (sum, val) => sum + (parseInt(val) || 0),
      0
    );
  };

  const renderGroup = (groupIndex) => (
    <div className="team-card" key={groupIndex}>
      <h2>Group {groupIndex + 1}</h2>
      <div className="players">
        <div className="hole-header">
          <span className="player-label">Player</span>
          {HOLE_INFO.map((_, index) => (
            <div key={index} className="hole-info">H{index + 1}</div>
          ))}
          <span className="player-total">Total</span>
        </div>
        <div className="hole-header sub-row">
          <span className="player-label"></span>
          {HOLE_INFO.map((hole, index) => (
            <div key={index} className="hole-info">S.I. {hole.si}</div>
          ))}
          <span className="player-total"></span>
        </div>
        <div className="hole-header sub-row">
          <span className="player-label"></span>
          {HOLE_INFO.map((hole, index) => (
            <div key={index} className="hole-info">{hole.yards} yds</div>
          ))}
          <span className="player-total"></span>
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
                className="hole-input"
                value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                disabled
              />
            ))}
            <span className="player-total">{getPlayerTotal(teamIndex, groupIndex)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAllScores = () => [...Array(8)].map((_, groupIndex) => renderGroup(groupIndex));

  const renderSummary = () => {
    const teamTotals = teams.map((team, i) => {
      const total = [...Array(8)].reduce((sum, pIdx) => sum + getPlayerTotal(i, pIdx), 0);
      return { ...team, total };
    }).sort((a, b) => a.total - b.total);

    return (
      <table className="summary-table">
        <thead>
          <tr><th>Team</th><th>Total Score</th></tr>
        </thead>
        <tbody>
          {teamTotals.map((team, idx) => (
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

  return (
    <div className="app">
      <h1>Danum Cup Scoreboard</h1>
      <div className="tabs">
        {['Men', 'Ladies'].map((comp) => (
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
      {view.startsWith('group-') && renderGroup(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;
