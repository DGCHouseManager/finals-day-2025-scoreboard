import React, { useState } from 'react';
import './App.css';

const MENS_HOLE_INFO = [ /* ... hole info ... */ ];
const WOMENS_HOLE_INFO = [ /* ... hole info ... */ ];

const COMPETITIONS = {
  Men: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c' },
    { name: 'Wheatley Golf Club', color: '#0a2e20' },
    { name: 'Doncaster Town Moor Golf Club', color: '#1b365d' },
  ],
  Women: [
    { name: 'Doncaster Golf Club', color: '#6d0c2c' },
    { name: 'Wheatley Golf Club', color: '#0a2e20' },
    { name: 'Hickleton Golf Club', color: '#1172a2' },
  ],
};

function App() {
  const [selectedCompetition, setSelectedCompetition] = useState('Men');
  const [scores, setScores] = useState({});

  const competition = selectedCompetition.toLowerCase();
  const HOLE_INFO = competition === "men" ? MENS_HOLE_INFO : WOMENS_HOLE_INFO;
  const teams = COMPETITIONS[selectedCompetition];

  return (
    <div className="app">
      <h1>Danum Cup Scoreboard</h1>
      {/* Rendered components go here */}
    </div>
  );
}

export default App;
