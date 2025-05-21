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

const WOMENS_HOLE_INFO = [
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
  Women: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c', logo: '/logos/doncaster-gc.png' },
    { name: 'Wheatley Golf Club', color: '#0a2e20', logo: '/logos/wheatley-gc.png' },
    { name: 'Hickleton Golf Club', color: '#1172a2', logo: '/logos/hickleton-gc.png' },
  ],
};

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});
  const [view, setView] = useState('summary');

  const getInitialPlayerNames = () => {
    const saved = localStorage.getItem("playerNames");
    return saved ? JSON.parse(saved) : {
      Men: [[], [], []],
      Women: [[], [], []]
    };
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
            if (!groupedNames[comp][teamIndex]) {
              groupedNames[comp][teamIndex] = [];
            }
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
        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Player</th>
              {HOLE_INFO.map((_, i) => <th key={i}>H{i + 1}</th>)}
              <th>Total</th>
            </tr>
            <tr>
              <th></th>
              {HOLE_INFO.map((hole, i) => <th key={i}>S.I. {hole.si}</th>)}
              <th></th>
            </tr>
            <tr>
              <th></th>
              {HOLE_INFO.map((hole, i) => <th key={i}>{hole.yards}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupPlayers.map(({ teamIndex, playerIndex }) => {
              const team = teams[teamIndex];
              const player = playerNames[selectedCompetition]?.[teamIndex]?.[playerIndex] || `Player ${playerIndex + 1}`;
              return (
                <tr key={teamIndex}>
                  <td className="player-name-cell">
                    <img src={team.logo} alt={team.name} className="club-logo" />
                    {player}
                  </td>
                  {HOLE_INFO.map((_, i) => (
                    <td key={i}>
                      <input
                        className="hole-input"
                        type="number"
                        min="1"
                        max="12"
                        value={scores[selectedCompetition]?.[teamIndex]?.[playerIndex]?.[i] || ''}
                        onChange={(e) => handleScoreChange(teamIndex, playerIndex, i, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>{getPlayerTotal(teamIndex, playerIndex)}</td>
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
      {view === 'all' && (
  <div className="teams">
    {[...Array(8)].map((_, groupIndex) => (
      <div key={groupIndex} className="team-card">
        <h2>Group {groupIndex + 1}</h2>
        <table className="all-scores-table">
          <thead>
            <tr>
              <th>Player</th>
              {HOLE_INFO.map((_, i) => (
                <th key={`hole-${i}`}>H{i + 1}</th>
              ))}
              <th>Total</th>
            </tr>
            <tr>
              <th>S.I.</th>
              {HOLE_INFO.map((hole, i) => (
                <th key={`si-${i}`}>S.I. {hole.si}</th>
              ))}
              <th></th>
            </tr>
            <tr>
              <th>Yards</th>
              {HOLE_INFO.map((hole, i) => (
                <th key={`yards-${i}`}>{hole.yards}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, teamIndex) => {
              const playerName = playerNames[selectedCompetition]?.[teamIndex]?.[groupIndex] || `Player ${groupIndex + 1}`;
              return (
                <tr key={`${team.name}-${groupIndex}`}>
                  <td className="player-label">
                    <img src={team.logo} alt={team.name} className="club-logo" />
                    {playerName}
                  </td>
                  {HOLE_INFO.map((_, holeIndex) => (
                    <td key={holeIndex}>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="hole-input"
                        value={scores[selectedCompetition]?.[teamIndex]?.[groupIndex]?.[holeIndex] || ''}
                        onChange={(e) =>
                          handleScoreChange(teamIndex, groupIndex, holeIndex, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td className="player-total">{getPlayerTotal(teamIndex, groupIndex)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ))}
  </div>
)}

      {view.startsWith('group-') && renderGroupView(parseInt(view.split('-')[1], 10))}
    </div>
  );
}

export default App;