import React, { useState, useEffect } from 'react';
import { SetupView } from './components/SetupView';
import { GameView } from './components/GameView';
import { Lineup, TeamConfig, LogEntry, TeamSide, GameState } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'setup' | 'game'>('setup');
  
  // Team Configuration
  const [teamConfig, setTeamConfig] = useState<TeamConfig>({
    matchName: '',
    myName: '',
    opName: ''
  });

  // Current Game State
  const [currentSet, setCurrentSet] = useState(1);
  const [mySetWins, setMySetWins] = useState(0);
  const [opSetWins, setOpSetWins] = useState(0);
  
  const [myLineup, setMyLineup] = useState<Lineup>(({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }));
  const [opLineup, setOpLineup] = useState<Lineup>(({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }));
  const [myScore, setMyScore] = useState(0);
  const [opScore, setOpScore] = useState(0);
  const [servingTeam, setServingTeam] = useState<TeamSide>('me');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // History Stacks
  const [history, setHistory] = useState<GameState[]>([]);
  const [future, setFuture] = useState<GameState[]>([]);

  // Prevent accidental close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only prompt if there is actual game data
      if (view === 'game' && logs.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard for forcing the browser dialog
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [view, logs]);

  // Helper to capture current state
  const getCurrentState = (): GameState => ({
    currentSet, mySetWins, opSetWins, myLineup, opLineup, myScore, opScore, servingTeam, logs
  });

  // Helper to push state to history before modification
  const pushHistory = () => {
    const current = getCurrentState();
    setHistory(prev => [...prev, current]);
    setFuture([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const previous = history[history.length - 1];
    const current = getCurrentState();

    setFuture(prev => [current, ...prev]); // Push current to future
    setHistory(prev => prev.slice(0, -1)); // Pop from history

    // Restore state
    setCurrentSet(previous.currentSet);
    setMySetWins(previous.mySetWins);
    setOpSetWins(previous.opSetWins);
    setMyLineup(previous.myLineup);
    setOpLineup(previous.opLineup);
    setMyScore(previous.myScore);
    setOpScore(previous.opScore);
    setServingTeam(previous.servingTeam);
    setLogs(previous.logs);
  };

  const handleRedo = () => {
    if (future.length === 0) return;

    const next = future[0];
    const current = getCurrentState();

    setHistory(prev => [...prev, current]); // Push current to history
    setFuture(prev => prev.slice(1)); // Pop from future

    // Restore state
    setCurrentSet(next.currentSet);
    setMySetWins(next.mySetWins);
    setOpSetWins(next.opSetWins);
    setMyLineup(next.myLineup);
    setOpLineup(next.opLineup);
    setMyScore(next.myScore);
    setOpScore(next.opScore);
    setServingTeam(next.servingTeam);
    setLogs(next.logs);
  };

  // Called when "Start Game" is clicked in SetupView
  const handleGameStart = (config: TeamConfig, initialMyLineup: Lineup, initialOpLineup: Lineup, initialServingTeam: TeamSide) => {
    setTeamConfig(config);
    setMyLineup(initialMyLineup);
    setOpLineup(initialOpLineup);
    setMyScore(0);
    setOpScore(0);
    setServingTeam(initialServingTeam);
    
    // NOTE: We do NOT reset logs or currentSet or setWins here, 
    // because this function is called both for Set 1 (New Match) and Set 2+ (Transition).
    // The distinction is handled by handleNewMatch vs handleNextSet.
    
    // Clear history for undo/redo within the new set (optional choice, generally safer to clear undo history on new set start)
    // To preserve undo across sets, we would need to not clear this, but for simplicity/performance we clear undo stack per set start logic often.
    // Here we clear it to start the set "fresh" regarding actions.
    setHistory([]); 
    setFuture([]);
    
    setView('game');
  };

  // 1. COMPLETELY NEW MATCH (Reset Everything)
  const handleNewMatch = () => {
    setTeamConfig({ matchName: '', myName: '', opName: '' });
    setMyLineup({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' });
    setOpLineup({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' });
    setCurrentSet(1);
    setMySetWins(0);
    setOpSetWins(0);
    setLogs([]);
    setHistory([]);
    setFuture([]);
    setView('setup');
  };

  // 2. NEXT SET (Preserve match data, go to setup for new lineup)
  const handleNextSet = () => {
    pushHistory(); // Optional: Save state before transition

    // Determine winner of the set we just finished
    if (myScore > opScore) {
      setMySetWins(prev => prev + 1);
    } else if (opScore > myScore) {
      setOpSetWins(prev => prev + 1);
    }

    // Increment Set Number
    setCurrentSet(prev => prev + 1);

    // Go back to setup, but KEEPS current teamConfig and lineups as defaults (via state)
    setView('setup'); 
  };

  const handleGameAction = (
    newLog: LogEntry | null, 
    scoreUpdate: { isMyPoint: boolean } | null,
    lineupUpdate: { isMyTeam: boolean, newLineup: Lineup } | null,
    newServingTeam: TeamSide | null
  ) => {
    pushHistory();
    
    // Inject currentSet into the new log
    if (newLog) {
      setLogs(prev => [...prev, { ...newLog, setNumber: currentSet }]);
    }
    
    if (scoreUpdate) {
      if (scoreUpdate.isMyPoint) setMyScore(prev => prev + 1);
      else setOpScore(prev => prev + 1);
    }

    if (lineupUpdate) {
       if (lineupUpdate.isMyTeam) setMyLineup(lineupUpdate.newLineup);
       else setOpLineup(lineupUpdate.newLineup);
    }

    if (newServingTeam) {
      setServingTeam(newServingTeam);
    }
  };

  // Handle loading a saved game
  const handleLoadGame = (savedState: GameState, config: TeamConfig) => {
    setTeamConfig(config);
    setCurrentSet(savedState.currentSet || 1); 
    setMySetWins(savedState.mySetWins || 0);
    setOpSetWins(savedState.opSetWins || 0);
    setMyLineup(savedState.myLineup);
    setOpLineup(savedState.opLineup);
    setMyScore(savedState.myScore);
    setOpScore(savedState.opScore);
    setServingTeam(savedState.servingTeam);
    setLogs(savedState.logs);
    
    // Clear history/future to avoid conflicts after load
    setHistory([]);
    setFuture([]);
  };

  return (
    <div className="h-full w-full bg-neutral-900 flex justify-center">
      <div className="w-full max-w-[430px] bg-neutral-900 flex flex-col relative shadow-2xl border-x border-neutral-800 h-full">
        {view === 'setup' ? (
          <SetupView 
            // Pass current state as initial values to persist data when coming from "Next Set"
            initialConfig={teamConfig}
            initialMyLineup={myLineup}
            initialOpLineup={opLineup}
            onStart={handleGameStart} 
          />
        ) : (
          <GameView 
            teamConfig={teamConfig}
            currentSet={currentSet}
            mySetWins={mySetWins}
            opSetWins={opSetWins}
            initialMyLineup={myLineup}
            initialOpLineup={opLineup}
            myScore={myScore}
            opScore={opScore}
            servingTeam={servingTeam}
            logs={logs}
            onGameAction={handleGameAction}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onLoadGame={handleLoadGame}
            onNewSet={handleNextSet}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onExit={handleNewMatch} // New Match Button
          />
        )}
      </div>
    </div>
  );
};

export default App;