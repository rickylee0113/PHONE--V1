import React, { useState, useMemo } from 'react';
import { LogEntry, TeamConfig, TeamSide, ActionType, ResultType } from '../types';

interface StatsOverlayProps {
  logs: LogEntry[];
  teamConfig: TeamConfig;
  myScore: number;
  opScore: number;
  mySetWins: number;
  opSetWins: number;
  onBack: () => void;
  currentSet: number;
}

interface StatSummary {
  attackKills: number;
  attackTotal: number;
  blocks: number;
  serveAces: number;
  serveErrors: number;
  digs: number; // Added digs for completeness
  totalPoints: number; // Helper for sorting
}

export const StatsOverlay: React.FC<StatsOverlayProps> = ({
  logs,
  teamConfig,
  myScore,
  opScore,
  mySetWins,
  opSetWins,
  onBack,
  currentSet
}) => {
  const [activeTab, setActiveTab] = useState<TeamSide>('me');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Helper: Filter logs for a specific team
  const getTeamLogs = (side: TeamSide) => {
    return logs.filter(l => {
      const isMyAction = l.note === teamConfig.myName;
      const logTeam: TeamSide = isMyAction ? 'me' : 'op';
      return logTeam === side;
    });
  };

  // Helper: Filter logs for a specific player (within the active team context usually)
  const getPlayerLogs = (playerNum: string, side: TeamSide) => {
    return getTeamLogs(side).filter(l => l.playerNumber === playerNum);
  };

  // Helper: Calculate Stats
  const calculateStats = (filteredLogs: LogEntry[]): StatSummary => {
    let stats = {
      attackKills: 0,
      attackTotal: 0,
      blocks: 0,
      serveAces: 0,
      serveErrors: 0,
      digs: 0,
      totalPoints: 0
    };

    filteredLogs.forEach(l => {
      if (l.action === ActionType.ATTACK) {
        stats.attackTotal++;
        if (l.result === ResultType.POINT) stats.attackKills++;
      }
      if (l.action === ActionType.BLOCK && l.result === ResultType.POINT) {
        stats.blocks++;
      }
      if (l.action === ActionType.SERVE) {
        if (l.result === ResultType.POINT) stats.serveAces++;
        if (l.result === ResultType.ERROR) stats.serveErrors++;
      }
      if (l.action === ActionType.DIG) {
        stats.digs++;
      }
    });

    stats.totalPoints = stats.attackKills + stats.blocks + stats.serveAces;
    return stats;
  };

  // Pre-calculate Team Stats for Comparison
  const myTeamStats = calculateStats(getTeamLogs('me'));
  const opTeamStats = calculateStats(getTeamLogs('op'));

  // Calculate stats for the currently selected player (if any)
  const currentPlayerStats = selectedPlayer 
    ? calculateStats(getPlayerLogs(selectedPlayer, activeTab)) 
    : null;

  // Get list of players for the ACTIVE TAB
  const activePlayersList = useMemo(() => {
    const teamLogs = getTeamLogs(activeTab);
    const players = Array.from(new Set(teamLogs.map(l => l.playerNumber))).sort((a: string, b: string) => parseInt(a) - parseInt(b));
    
    // Calculate points for each player to determine top scorers
    const playerPoints = players.map(p => {
        const pStats = calculateStats(teamLogs.filter(l => l.playerNumber === p));
        return { number: p, points: pStats.totalPoints };
    });

    // Sort by points descending
    const sortedByPoints = [...playerPoints].sort((a, b) => b.points - a.points);
    
    // Identify Top 2 IDs
    const top1 = sortedByPoints[0]?.points > 0 ? sortedByPoints[0].number : null;
    const top2 = sortedByPoints[1]?.points > 0 ? sortedByPoints[1].number : null;

    return { players, top1, top2 };
  }, [logs, activeTab, teamConfig]);

  // Visualizer for Shot Charts
  const renderShotChart = () => {
    if (!selectedPlayer) return null;
    const playerLogs = getPlayerLogs(selectedPlayer, activeTab);
    
    // Filter for drawing lines: Attack & Serve only, and must have coords
    const drawLogs = playerLogs.filter(l => 
        (l.action === ActionType.ATTACK || l.action === ActionType.SERVE) && 
        l.startCoord && l.endCoord
    );

    return (
      <div className="relative w-full aspect-[1/2] bg-white border-2 border-black shadow-md my-4 max-h-[400px]">
        {/* Court Markings (Darker for white background) */}
        <div className="absolute top-[50%] w-full h-1 bg-black/80 -translate-y-1/2 z-10"></div> {/* Net */}
        <div className="absolute top-[33.33%] w-full h-0.5 bg-black/20"></div> {/* 3m */}
        <div className="absolute top-[66.66%] w-full h-0.5 bg-black/20"></div> {/* 3m */}

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <defs>
             <marker id="arrow-point-attack" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L0,6 L6,3 z" fill="#10B981" />
             </marker>
             <marker id="arrow-point-serve" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L0,6 L6,3 z" fill="#3B82F6" />
             </marker>
             <marker id="arrow-error" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L0,6 L6,3 z" fill="#EF4444" />
             </marker>
             <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L0,6 L6,3 z" fill="#9CA3AF" />
             </marker>
          </defs>
          {drawLogs.map(l => {
            let color = '#9CA3AF'; // Default Gray
            let markerId = 'arrow-normal';

            if (l.result === ResultType.ERROR) {
                color = '#EF4444'; // Red
                markerId = 'arrow-error';
            } else if (l.result === ResultType.POINT) {
                if (l.action === ActionType.SERVE) {
                    color = '#3B82F6'; // Blue for Serve Aces
                    markerId = 'arrow-point-serve';
                } else {
                    color = '#10B981'; // Green for Attack Kills
                    markerId = 'arrow-point-attack';
                }
            }

            return (
              <g key={l.id}>
                 <line 
                   x1={`${l.startCoord!.x}%`} y1={`${l.startCoord!.y}%`}
                   x2={`${l.endCoord!.x}%`} y2={`${l.endCoord!.y}%`}
                   stroke={color}
                   strokeWidth="2"
                   opacity="0.9"
                   markerEnd={`url(#${markerId})`}
                 />
                 <circle cx={`${l.startCoord!.x}%`} cy={`${l.startCoord!.y}%`} r="2.5" fill={color} stroke="white" strokeWidth="0.5" />
              </g>
            );
          })}
        </svg>
        
        {drawLogs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-50/50">
                無路徑資料
            </div>
        )}
      </div>
    );
  };

  // Render a Comparison Row (My Team vs Op Team)
  const renderComparisonRow = (label: string, myVal: string | number, opVal: string | number, highlightMy: boolean = false, highlightOp: boolean = false) => (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center py-2 border-b border-slate-100 last:border-0">
          <div className={`text-xl font-black text-center ${highlightMy ? 'text-accent' : 'text-slate-700'}`}>{myVal}</div>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider text-center px-2 w-24">{label}</div>
          <div className={`text-xl font-black text-center ${highlightOp ? 'text-red-600' : 'text-slate-700'}`}>{opVal}</div>
      </div>
  );

  // Render a Single Player Stat Row
  const renderPlayerStatRow = (label: string, value: string | number, colorClass: string = 'text-slate-800') => (
      <div className="flex justify-between items-center py-3 border-b border-slate-200">
          <span className="text-slate-500 font-bold">{label}</span>
          <span className={`text-xl font-black ${colorClass}`}>{value}</span>
      </div>
  );

  return (
    <div className="absolute inset-0 z-[200] bg-white flex flex-col animate-fade-in overflow-hidden text-slate-900">
      
      {/* 1. Header & Navigation (Dark for contrast) */}
      <div className="bg-slate-900 p-3 flex justify-between items-center shrink-0 shadow-md">
          <div className="flex gap-2">
            <button 
                onClick={onBack}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
            >
                ← 返回比賽
            </button>
            {selectedPlayer && (
                <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    上一頁
                </button>
            )}
          </div>
          <div className="text-slate-200 font-bold text-sm">
             第 {currentSet} 局
          </div>
      </div>

      {/* 2. Scoreboard (Light Theme) */}
      <div className="bg-slate-50 p-4 flex justify-center items-center gap-6 border-b border-slate-200 shrink-0">
          <div className="text-center">
              <div className="text-3xl font-black text-accent">{myScore}</div>
              <div className="text-xs text-slate-500 font-bold">局數 {mySetWins}</div>
          </div>
          <div className="text-slate-300 font-thin text-2xl">:</div>
          <div className="text-center">
              <div className="text-3xl font-black text-red-500">{opScore}</div>
              <div className="text-xs text-slate-500 font-bold">局數 {opSetWins}</div>
          </div>
      </div>

      {/* 4. Content Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        
        {/* TEAM VIEW (Comparison) */}
        {!selectedPlayer && (
            <div className="flex flex-col h-full max-w-lg mx-auto w-full">
                
                {/* Team Comparison Card */}
                <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-200">
                    <div className="flex justify-between mb-4 px-4">
                        <span className="font-bold text-accent">{teamConfig.myName}</span>
                        <span className="font-bold text-red-500">{teamConfig.opName}</span>
                    </div>
                    
                    {/* Comparison Stats */}
                    {renderComparisonRow(
                        "攻擊 (得/手)", 
                        `${myTeamStats.attackKills}/${myTeamStats.attackTotal}`, 
                        `${opTeamStats.attackKills}/${opTeamStats.attackTotal}`,
                        true, true
                    )}
                    {renderComparisonRow(
                        "攻擊率", 
                        `${myTeamStats.attackTotal > 0 ? Math.round((myTeamStats.attackKills/myTeamStats.attackTotal)*100) : 0}%`, 
                        `${opTeamStats.attackTotal > 0 ? Math.round((opTeamStats.attackKills/opTeamStats.attackTotal)*100) : 0}%`
                    )}
                    {renderComparisonRow("攔網得分", myTeamStats.blocks, opTeamStats.blocks)}
                    {renderComparisonRow("發球得分", myTeamStats.serveAces, opTeamStats.serveAces)}
                    {renderComparisonRow("發球失誤", myTeamStats.serveErrors, opTeamStats.serveErrors)}
                </div>

                {/* Team Selector for Player List */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4 shrink-0">
                  <button 
                    onClick={() => setActiveTab('me')}
                    className={`flex-1 py-2 font-bold rounded-lg transition-all text-sm
                        ${activeTab === 'me' 
                            ? 'bg-white text-accent shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      {teamConfig.myName} 球員
                  </button>
                  <button 
                    onClick={() => setActiveTab('op')}
                    className={`flex-1 py-2 font-bold rounded-lg transition-all text-sm
                        ${activeTab === 'op' 
                            ? 'bg-white text-red-500 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      {teamConfig.opName} 球員
                  </button>
                </div>

                {/* Player List */}
                <div className="grid grid-cols-4 gap-3">
                    {activePlayersList.players.length === 0 ? (
                         <div className="col-span-4 text-center text-slate-400 py-10">尚無紀錄</div>
                    ) : (
                        activePlayersList.players.map(p => {
                            const isTop1 = p === activePlayersList.top1;
                            const isTop2 = p === activePlayersList.top2;
                            
                            return (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPlayer(p)}
                                    className={`
                                        aspect-square rounded-xl font-black text-2xl flex flex-col items-center justify-center shadow-sm transition-all relative border-2
                                        ${isTop1 
                                            ? 'bg-yellow-50 border-yellow-400 text-yellow-600 scale-105 shadow-md' 
                                            : isTop2
                                                ? 'bg-slate-100 border-slate-400 text-slate-600 scale-105'
                                                : 'bg-white border-slate-200 text-slate-700 hover:border-accent hover:text-accent'
                                        }
                                    `}
                                >
                                    {p}
                                    {(isTop1 || isTop2) && (
                                        <div className={`text-[10px] absolute bottom-1 font-bold ${isTop1 ? 'text-yellow-600' : 'text-slate-500'}`}>
                                            {isTop1 ? '得分王' : '次高'}
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        )}

        {/* PLAYER VIEW */}
        {selectedPlayer && currentPlayerStats && (
            <div className="flex flex-col items-center max-w-lg mx-auto w-full">
                 <div className="mb-2 text-center">
                     <span className={`text-5xl font-black block ${activeTab === 'me' ? 'text-accent' : 'text-red-500'}`}>
                        #{selectedPlayer}
                     </span>
                     <span className="text-sm text-slate-400 font-bold">{activeTab === 'me' ? teamConfig.myName : teamConfig.opName}</span>
                 </div>
                 
                 {/* Mini Court Visualizer */}
                 <div className="w-full max-w-[300px]">
                    {renderShotChart()}
                    <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold mb-4">
                        <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 bg-green-500 rounded-full"></span>攻擊得分</span>
                        <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 bg-blue-500 rounded-full"></span>發球得分</span>
                        <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 bg-red-500 rounded-full"></span>失誤</span>
                        <span className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 bg-slate-400 rounded-full"></span>一般</span>
                    </div>
                 </div>

                 {/* Player Stats */}
                 <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm">
                    {renderPlayerStatRow("攻擊 (得分/出手)", `${currentPlayerStats.attackKills} / ${currentPlayerStats.attackTotal}`, "text-green-600")}
                    {renderPlayerStatRow(
                        "攻擊率", 
                        `${currentPlayerStats.attackTotal > 0 ? Math.round((currentPlayerStats.attackKills/currentPlayerStats.attackTotal)*100) : 0}%`, 
                        "text-blue-600"
                    )}
                    {renderPlayerStatRow("攔網得分", currentPlayerStats.blocks, "text-yellow-600")}
                    {renderPlayerStatRow("發球得分", currentPlayerStats.serveAces, "text-blue-600")}
                    {renderPlayerStatRow("發球失誤", currentPlayerStats.serveErrors, "text-red-500")}
                    {renderPlayerStatRow("總得分", currentPlayerStats.totalPoints, "text-slate-900")}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};