
import React, { useState } from 'react';
import { Lineup, TeamConfig, LogEntry, Position, ActionType, ActionQuality, ResultType, Coordinate, TeamSide, SavedGame, GameState } from '../types';
import { Court } from './Court';
import { StatsOverlay } from './StatsOverlay';

interface GameViewProps {
  teamConfig: TeamConfig;
  currentSet: number;
  mySetWins: number;
  opSetWins: number;
  initialMyLineup: Lineup;
  initialOpLineup: Lineup;
  myScore: number;
  opScore: number;
  servingTeam: TeamSide;
  logs: LogEntry[];
  onGameAction: (
    newLog: LogEntry | null, 
    scoreUpdate: { isMyPoint: boolean } | null,
    lineupUpdate: { isMyTeam: boolean, newLineup: Lineup } | null,
    servingTeamUpdate: TeamSide | null
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLoadGame: (savedState: GameState, config: TeamConfig) => void;
  onNewSet: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExit: () => void;
}

type GameStep = 'SELECT_PLAYER' | 'QUICK_DETAILS' | 'RECORD_LOCATION';

const SAVE_PREFIX = 'volleyscout_save_';

export const GameView: React.FC<GameViewProps> = ({
  teamConfig,
  currentSet,
  mySetWins,
  opSetWins,
  initialMyLineup,
  initialOpLineup,
  myScore,
  opScore,
  servingTeam,
  logs,
  onGameAction,
  onUndo,
  onRedo,
  onLoadGame,
  onNewSet,
  canUndo,
  canRedo,
  onExit
}) => {
  const [step, setStep] = useState<GameStep>('SELECT_PLAYER');
  const [showStats, setShowStats] = useState(false);
  
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [selectedIsMyTeam, setSelectedIsMyTeam] = useState<boolean>(true);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<ActionQuality>(ActionQuality.NORMAL);
  const [selectedResult, setSelectedResult] = useState<ResultType>(ResultType.NORMAL);
  const [startCoord, setStartCoord] = useState<Coordinate | null>(null);
  const [endCoord, setEndCoord] = useState<Coordinate | null>(null);
  
  const [showSubInput, setShowSubInput] = useState(false);
  const [subNumber, setSubNumber] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedFiles, setSavedFiles] = useState<{key: string, name: string, date: string}[]>([]);

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm';
    confirmLabel?: string;
    onConfirm?: () => void;
  }>({ show: false, title: '', message: '', type: 'info' });

  const showInfo = (title: string, message: string) => {
    setModalConfig({ show: true, title, message, type: 'info', confirmLabel: '確定' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel: string = '確定') => {
    setModalConfig({ show: true, title, message, type: 'confirm', onConfirm, confirmLabel });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, show: false }));
  };

  const handleConfirm = () => {
    if (modalConfig.onConfirm) modalConfig.onConfirm();
    closeModal();
  };

  const getRotatedLineup = (lineup: Lineup): Lineup => ({
      1: lineup[2], 6: lineup[1], 5: lineup[6], 4: lineup[5], 3: lineup[4], 2: lineup[3],
  });

  const handleRotation = (isMyTeam: boolean) => {
    if (step !== 'SELECT_PLAYER') return;
    const currentLineup = isMyTeam ? initialMyLineup : initialOpLineup;
    const newLineup = getRotatedLineup(currentLineup);
    onGameAction(null, null, { isMyTeam, newLineup }, null);
  };

  const startSubFlow = () => {
    setShowSubInput(true);
    setSubNumber('');
  };

  const confirmSub = () => {
    if (!selectedPos) return;
    const newNum = subNumber.trim();
    const currentLineup = selectedIsMyTeam ? initialMyLineup : initialOpLineup;
    const oldNum = currentLineup[selectedPos];
    
    if (newNum === '') { showInfo('錯誤', '請輸入背號'); return; }
    if (Object.values(currentLineup).includes(newNum)) { showInfo('錯誤', `背號 #${newNum} 已在場上`); return; }

    const newLineup = { ...currentLineup, [selectedPos]: newNum };
    const subLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      setNumber: currentSet,
      myScore, opScore, playerNumber: oldNum,
      position: selectedPos,
      action: ActionType.SUB,
      quality: ActionQuality.NORMAL,
      result: ResultType.NORMAL,
      note: `換人 (${selectedIsMyTeam ? '我方' : '對方'}): #${oldNum} -> #${newNum}`,
      servingTeam
    };

    onGameAction(subLog, null, { isMyTeam: selectedIsMyTeam, newLineup }, null);
    setShowSubInput(false);
    resetTurn();
  };

  const handlePlayerClick = (pos: Position, isMyTeam: boolean, coord: Coordinate) => {
    if (step !== 'SELECT_PLAYER') return;
    setSelectedPos(pos);
    setSelectedIsMyTeam(isMyTeam);
    setStartCoord(coord); 
    setStep('QUICK_DETAILS');
    setSelectedAction(ActionType.ATTACK);
    setSelectedQuality(ActionQuality.NORMAL);
    setSelectedResult(ResultType.NORMAL);
  };

  const getDefaultStartCoord = (action: ActionType, isMyTeam: boolean): Coordinate => {
    let x = 50, y = 75;
    if (action === ActionType.SERVE) { x = 80; y = 98; }
    else if (action === ActionType.ATTACK) { x = 20; y = 65; }
    else if (action === ActionType.SET) { x = 65; y = 55; }
    else if (action === ActionType.RECEIVE || action === ActionType.DIG) { x = 50; y = 85; }

    if (!isMyTeam) {
        x = 100 - x;
        y = 100 - y;
    }
    return { x, y };
  };

  const handleLocationRecord = (start: Coordinate, end: Coordinate) => {
    finalizeAction(start, end);
  };

  const handleSkipLocation = () => {
    finalizeAction(startCoord, null);
  };

  const finalizeAction = (start: Coordinate | null, end: Coordinate | null) => {
    if (!selectedPos || !selectedAction) return;

    const lineup = selectedIsMyTeam ? initialMyLineup : initialOpLineup;
    const playerNumber = lineup[selectedPos];

    let scoreUpdate = null;
    let newServingTeam: TeamSide | null = null;
    let lineupUpdate = null;

    if (selectedResult === ResultType.POINT) {
        scoreUpdate = { isMyPoint: selectedIsMyTeam };
        const pointWinner = selectedIsMyTeam ? 'me' : 'op';
        if (pointWinner !== servingTeam) {
            newServingTeam = pointWinner;
            const lineToRotate = pointWinner === 'me' ? initialMyLineup : initialOpLineup;
            lineupUpdate = { isMyTeam: pointWinner === 'me', newLineup: getRotatedLineup(lineToRotate) };
        }
    } 
    else if (selectedResult === ResultType.ERROR) {
        scoreUpdate = { isMyPoint: !selectedIsMyTeam };
        const pointWinner = !selectedIsMyTeam ? 'me' : 'op';
        if (pointWinner !== servingTeam) {
            newServingTeam = pointWinner;
            const lineToRotate = pointWinner === 'me' ? initialMyLineup : initialOpLineup;
            lineupUpdate = { isMyTeam: pointWinner === 'me', newLineup: getRotatedLineup(lineToRotate) };
        }
    }

    const nextMyScore = scoreUpdate ? (scoreUpdate.isMyPoint ? myScore + 1 : myScore) : myScore;
    const nextOpScore = scoreUpdate ? (!scoreUpdate.isMyPoint ? opScore + 1 : opScore) : opScore;

    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      setNumber: currentSet,
      myScore: nextMyScore,
      opScore: nextOpScore,
      playerNumber,
      position: selectedPos,
      action: selectedAction,
      quality: selectedQuality,
      result: selectedResult,
      startCoord: start || undefined,
      endCoord: end || undefined,
      note: selectedIsMyTeam ? teamConfig.myName : teamConfig.opName,
      servingTeam: newServingTeam || servingTeam
    };

    onGameAction(newLog, scoreUpdate, lineupUpdate, newServingTeam);
    resetTurn();
  };

  const resetTurn = () => {
    setStep('SELECT_PLAYER');
    setSelectedPos(null);
    setSelectedAction(null);
    setSelectedQuality(ActionQuality.NORMAL);
    setSelectedResult(ResultType.NORMAL);
    setStartCoord(null);
    setEndCoord(null);
  };

  const actionMap: Record<ActionType, string> = {
      [ActionType.SERVE]: '發球', [ActionType.RECEIVE]: '接發', [ActionType.SET]: '舉球',
      [ActionType.ATTACK]: '攻擊', [ActionType.BLOCK]: '攔網', [ActionType.DIG]: '防守', [ActionType.SUB]: '換人'
  };

  const resultMap: Record<ResultType, string> = { [ResultType.POINT]: '得分', [ResultType.ERROR]: '失誤', [ResultType.NORMAL]: '一般' };
  const qualityMap: Record<ActionQuality, string> = {
      [ActionQuality.PERFECT]: '到位 #', [ActionQuality.GOOD]: '良好 +', [ActionQuality.NORMAL]: '普通 !', [ActionQuality.POOR]: '不到位 -'
  };
  const qualitySymbolMap: Record<ActionQuality, string> = { [ActionQuality.PERFECT]: '#', [ActionQuality.GOOD]: '+', [ActionQuality.NORMAL]: '!', [ActionQuality.POOR]: '-' };

  const handleOpenSave = () => {
    const dateStr = new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/:/g, '');
    setSaveFileName(`${teamConfig.matchName || 'match'}_${dateStr}${timeStr}`);
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    if (!saveFileName.trim()) { showInfo('錯誤', '請輸入檔案名稱'); return; }
    const saveObject: SavedGame = {
      config: teamConfig,
      state: { currentSet, mySetWins, opSetWins, myLineup: initialMyLineup, opLineup: initialOpLineup, myScore, opScore, servingTeam, logs },
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(`${SAVE_PREFIX}${saveFileName.trim()}`, JSON.stringify(saveObject));
      setShowSaveModal(false);
      showInfo('儲存成功', `檔案 "${saveFileName}" 已儲存！`);
    } catch (e) { showInfo('儲存失敗', '可能是裝置儲存空間不足。'); }
  };

  const handleOpenLoad = () => {
    const files = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(SAVE_PREFIX) || key === 'volleyscout_save')) {
            let name = key.replace(SAVE_PREFIX, '');
            if (key === 'volleyscout_save') name = '自動暫存檔 (舊版)';
            let date = '';
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    date = new Date(parsed.savedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {}
            files.push({ key, name, date });
        }
    }
    setSavedFiles(files);
    setShowLoadModal(true);
  };

  const handleLoadFile = (key: string, name: string) => {
    const savedData = localStorage.getItem(key);
    if (!savedData) return;
    showConfirm('讀取紀錄', `確定要讀取 "${name}" 嗎？\n當前的比賽進度將會遺失。`, () => {
        try {
            const parsed: SavedGame = JSON.parse(savedData);
            onLoadGame(parsed.state, parsed.config);
            resetTurn();
            setShowLoadModal(false);
        } catch (e) { showInfo('錯誤', '檔案損毀或格式錯誤。'); }
    }, '確認讀取');
  };

  const handleDeleteFile = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm('刪除存檔', '確定要永久刪除此存檔嗎？', () => {
        localStorage.removeItem(key);
        setSavedFiles(prev => prev.filter(f => f.key !== key));
    }, '確認刪除');
  };

  const handleNewGameClick = () => showConfirm('開新比賽', '確定要開新比賽嗎？\n未儲存的紀錄將會遺失，並回到設定頁面。', () => onExit(), '確認開新局');
  const handleNewSetClick = () => {
      let pw = myScore > opScore ? mySetWins + 1 : mySetWins;
      let ow = opScore > myScore ? opSetWins + 1 : opSetWins;
      showConfirm('新局數', `確定要結束第 ${currentSet} 局，並開始第 ${currentSet + 1} 局嗎？\n\n目前局數比分將變為: ${pw}:${ow}`, () => onNewSet(), '開始新一局');
  };
  const handleExitClick = () => showConfirm('結束比賽', '確定要結束比賽回到設定頁面嗎？', () => onExit(), '確認結束');

  const handleExportCSV = () => {
    const bom = "\uFEFF";
    const header = "時間,局數,我方得分,對方得分,發球方,隊伍,位置,背號,動作,品質,結果,起點X,起點Y,終點X,終點Y\n";
    const rows = logs.map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString('zh-TW', { hour12: false });
        return `${time},${l.setNumber || 1},${l.myScore},${l.opScore},${l.servingTeam === 'me' ? teamConfig.myName : teamConfig.opName},${l.note},${l.position},${l.playerNumber},${actionMap[l.action]},${qualitySymbolMap[l.quality]},${resultMap[l.result]},${l.startCoord?.x.toFixed(2)||''},${l.startCoord?.y.toFixed(2)||''},${l.endCoord?.x.toFixed(2)||''},${l.endCoord?.y.toFixed(2)||''}`;
    }).join("\n");
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${teamConfig.matchName || 'match'}_export.csv`;
    link.click();
  };

  const renderSubInput = () => (
      <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col justify-center items-center p-6 animate-fade-in">
          <h3 className="text-white text-xl font-bold mb-4">輸入替補球員背號</h3>
          <div className="mb-2 text-gray-400">{selectedIsMyTeam ? teamConfig.myName : teamConfig.opName} - 位置 {selectedPos}</div>
          <div className="mb-6 text-2xl font-bold text-accent">下場: #{selectedIsMyTeam ? initialMyLineup[selectedPos!] : initialOpLineup[selectedPos!]}</div>
          <input type="tel" autoFocus value={subNumber} onChange={(e) => setSubNumber(e.target.value)} className="bg-neutral-800 border-2 border-accent text-white text-4xl font-black text-center p-4 rounded-xl w-32 mb-6 focus:outline-none" placeholder="#"/>
          <div className="flex gap-4 w-full max-w-xs">
              <button onClick={() => setShowSubInput(false)} className="flex-1 bg-neutral-700 text-white font-bold py-3 rounded-lg">取消</button>
              <button onClick={confirmSub} className="flex-1 bg-accent text-white font-bold py-3 rounded-lg">確認換人</button>
          </div>
      </div>
  );

  const renderQuickDetailsModal = () => (
    <div className="absolute inset-0 z-50 bg-white flex flex-col p-0 animate-fade-in overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-900 px-4 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-8 rounded-sm ${selectedIsMyTeam ? 'bg-accent' : 'bg-red-500'}`}></span>
            <div>
                <h3 className="text-white font-black text-xl leading-none">
                    #{selectedIsMyTeam ? initialMyLineup[selectedPos!] : initialOpLineup[selectedPos!]}
                </h3>
                <span className="text-slate-400 text-[10px] font-bold uppercase">{selectedIsMyTeam ? teamConfig.myName : teamConfig.opName}</span>
            </div>
          </div>
          <button onClick={resetTurn} className="text-slate-400 py-1.5 px-3 font-bold bg-slate-800 rounded-lg text-sm">取消退出</button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col p-2 space-y-2">
          
          {/* Section 1: Action (緊湊格子) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-indigo-600 px-3 py-1.5 flex justify-between items-center">
                <span className="text-white font-bold text-xs tracking-widest">1. 選擇動作 ACTION</span>
                <span className="text-indigo-200 text-xs font-black">{actionMap[selectedAction!]}</span>
              </div>
              <div className="p-2 grid grid-cols-3 gap-1.5">
                  {[ActionType.SERVE, ActionType.RECEIVE, ActionType.SET, ActionType.ATTACK, ActionType.BLOCK, ActionType.DIG].map(act => (
                      <button 
                          key={act} 
                          onClick={() => {
                              setSelectedAction(act);
                              setStartCoord(getDefaultStartCoord(act, selectedIsMyTeam));
                          }} 
                          className={`py-3 rounded-lg font-bold text-sm transition-all border-2
                              ${selectedAction === act 
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                                  : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                          {actionMap[act]}
                      </button>
                  ))}
                  <button onClick={startSubFlow} className="col-span-3 py-2 rounded-lg bg-slate-50 border border-yellow-600/20 text-yellow-700 font-bold text-xs">🔄 球員替換 (Substitute)</button>
              </div>
          </div>

          {/* Section 2: Quality (橫向排列) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-emerald-600 px-3 py-1.5 flex justify-between items-center">
                <span className="text-white font-bold text-xs tracking-widest">2. 動作品質 QUALITY</span>
                <span className="text-emerald-200 text-xs font-black">{qualitySymbolMap[selectedQuality]}</span>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1.5">
                  {[ActionQuality.PERFECT, ActionQuality.GOOD, ActionQuality.NORMAL, ActionQuality.POOR].map(q => (
                      <button 
                          key={q} 
                          onClick={() => setSelectedQuality(q)} 
                          className={`py-3 px-2 rounded-lg font-bold text-sm transition-all border-2 flex items-center justify-between
                              ${selectedQuality === q 
                                  ? (q === ActionQuality.PERFECT ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                                     q === ActionQuality.GOOD ? 'bg-blue-50 border-blue-500 text-blue-700' :
                                     q === ActionQuality.POOR ? 'bg-orange-50 border-orange-500 text-orange-700' :
                                     'bg-slate-100 border-slate-500 text-slate-700')
                                  : 'bg-white border-slate-100 text-slate-400'}`}
                      >
                          <span>{qualityMap[q].split(' ')[0]}</span>
                          <span className="text-lg font-black">{qualitySymbolMap[q]}</span>
                      </button>
                  ))}
              </div>
          </div>

          {/* Section 3: Result (強烈色塊) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 px-3 py-1.5 flex justify-between items-center">
                <span className="text-white font-bold text-xs tracking-widest">3. 執行結果 RESULT</span>
                <span className="text-slate-400 text-xs font-black">{resultMap[selectedResult]}</span>
              </div>
              <div className="p-2 grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => { setSelectedResult(ResultType.POINT); setStep('RECORD_LOCATION'); }} 
                    className="py-4 rounded-xl bg-emerald-500 text-white font-black text-lg active:scale-[0.97]"
                  >
                    得分 (POINT)
                  </button>
                  <button 
                    onClick={() => { setSelectedResult(ResultType.NORMAL) }} 
                    className={`py-3 rounded-xl font-black text-base border-2 transition-all
                        ${selectedResult === ResultType.NORMAL ? 'bg-slate-800 border-slate-800 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    一般 (CONTINUE)
                  </button>
                  <button 
                    onClick={() => { setSelectedResult(ResultType.ERROR); setStep('RECORD_LOCATION'); }} 
                    className="py-4 rounded-xl bg-red-500 text-white font-black text-lg active:scale-[0.97]"
                  >
                    失誤 (ERROR)
                  </button>
              </div>
          </div>
      </div>

      {/* Sticky Bottom Action */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <button 
            onClick={() => setStep('RECORD_LOCATION')} 
            className="w-full bg-accent hover:bg-blue-600 text-white font-black py-4 rounded-xl text-lg shadow-lg active:scale-[0.98]"
          >
            下一步：記錄落點 &rarr;
          </button>
      </div>
    </div>
  );

  const renderSaveModal = () => showSaveModal && (
      <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col justify-center items-center p-6 animate-fade-in">
          <h3 className="text-white text-xl font-bold mb-6">儲存比賽紀錄</h3>
          <input type="text" value={saveFileName} onChange={(e) => setSaveFileName(e.target.value)} className="w-full max-w-xs bg-neutral-800 border border-neutral-600 text-white p-4 rounded-xl mb-6 focus:outline-none" placeholder="輸入名稱..."/>
          <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 bg-neutral-700 text-white py-3 rounded-xl font-bold">取消</button>
              <button onClick={handleConfirmSave} className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-bold">確認儲存</button>
          </div>
      </div>
  );

  const renderLoadModal = () => showLoadModal && (
      <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-4"><h3 className="text-white text-xl font-bold">選擇存檔</h3><button onClick={() => setShowLoadModal(false)} className="text-gray-400">關閉</button></div>
          <div className="flex-1 overflow-y-auto space-y-3">{savedFiles.length === 0 ? <div className="text-gray-500 text-center py-10">沒有找到任何存檔</div> : savedFiles.map(f => (
              <div key={f.key} onClick={() => handleLoadFile(f.key, f.name)} className="bg-neutral-800 border border-neutral-700 p-4 rounded-xl flex justify-between items-center"><div className="text-white font-bold">{f.name}<div className="text-xs text-gray-400">{f.date}</div></div><button onClick={(e) => handleDeleteFile(f.key, e)} className="p-3 text-red-400">🗑</button></div>
          ))}</div>
          <button onClick={() => setShowLoadModal(false)} className="w-full bg-neutral-700 text-white py-4 rounded-xl mt-4 font-bold">取消</button>
      </div>
  );

  const renderSystemModal = () => modalConfig.show && (
      <div className="absolute inset-0 z-[120] bg-black/80 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 p-6 rounded-2xl w-full max-w-xs flex flex-col gap-4">
              <h3 className="text-xl font-bold text-white text-center">{modalConfig.title}</h3>
              <p className="text-gray-300 text-center">{modalConfig.message}</p>
              <div className="flex gap-3">{modalConfig.type === 'confirm' && <button onClick={closeModal} className="flex-1 bg-neutral-700 text-white py-3 rounded-xl font-bold">取消</button>}<button onClick={modalConfig.type === 'confirm' ? handleConfirm : closeModal} className={`flex-1 py-3 rounded-xl font-bold text-white ${modalConfig.type === 'confirm' ? 'bg-red-600' : 'bg-accent'}`}>{modalConfig.confirmLabel || '確定'}</button></div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-white relative overflow-hidden">
      <div className="bg-neutral-800 border-b border-neutral-700 shadow-md z-10 shrink-0 flex flex-col">
          <div className="flex justify-between items-center p-2 border-b border-neutral-700/50">
             <div className="flex gap-2 items-center flex-1">
                 <button onClick={handleExitClick} className="w-10 h-10 rounded-full bg-red-900/30 border border-red-900/50 text-red-500 flex items-center justify-center font-bold">✕</button>
                 <button onClick={onUndo} disabled={!canUndo} className={`w-10 h-10 rounded-xl font-bold text-xl border-2 ${canUndo ? 'bg-amber-500 border-amber-600 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-600'}`}>↶</button>
                 <button onClick={onRedo} disabled={!canRedo} className={`w-10 h-10 rounded-xl font-bold text-xl border-2 ${canRedo ? 'bg-blue-600 border-blue-700 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-600'}`}>↷</button>
             </div>
             <div className="font-bold text-white bg-neutral-900/50 px-3 py-1 rounded-lg border border-neutral-700/50 mx-2 text-sm">局數 {mySetWins} : {opSetWins}</div>
             <div className="flex-1 flex justify-end"><button onClick={handleExportCSV} className="text-[10px] text-accent font-bold border border-accent px-2 py-1 rounded">匯出 CSV</button></div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-3 bg-neutral-800">
             <div className="flex items-center justify-between gap-1 overflow-hidden">
                <button onClick={() => handleRotation(true)} disabled={step !== 'SELECT_PLAYER'} className={`w-8 h-8 rounded-full border flex items-center justify-center ${step === 'SELECT_PLAYER' ? 'bg-neutral-700 text-white border-neutral-500' : 'opacity-20'}`}>↻</button>
                <div className={`flex items-center justify-end gap-2 flex-1 overflow-hidden ${servingTeam === 'me' ? 'opacity-100' : 'opacity-60'}`}>{servingTeam === 'me' && <span className="animate-bounce">🏐</span>}<span className="text-lg font-bold truncate">{teamConfig.myName}</span><span className="text-4xl font-black text-accent tabular-nums">{myScore}</span></div>
             </div>
             <div className="text-neutral-600 font-thin text-2xl">:</div>
             <div className="flex items-center justify-between gap-1 overflow-hidden">
                <div className={`flex items-center justify-start gap-2 flex-1 overflow-hidden ${servingTeam === 'op' ? 'opacity-100' : 'opacity-60'}`}><span className="text-4xl font-black text-red-500 tabular-nums">{opScore}</span><span className="text-lg font-bold truncate">{teamConfig.opName}</span>{servingTeam === 'op' && <span className="animate-bounce">🏐</span>}</div>
                <button onClick={() => handleRotation(false)} disabled={step !== 'SELECT_PLAYER'} className={`w-8 h-8 rounded-full border flex items-center justify-center ${step === 'SELECT_PLAYER' ? 'bg-neutral-700 text-red-400 border-neutral-500' : 'opacity-20'}`}>↻</button>
             </div>
          </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-[#222]">
        <div className="absolute top-2 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                {step === 'SELECT_PLAYER' && "點選場上球員"}
                {step === 'QUICK_DETAILS' && "選擇動作詳情"}
                {step === 'RECORD_LOCATION' && "點擊球落點 (可拖曳起點 A)"}
            </div>
        </div>
        {step === 'RECORD_LOCATION' && (
             <div className="absolute bottom-4 left-4 right-4 z-30 flex gap-2">
                 <button onClick={() => setStep('QUICK_DETAILS')} className="flex-1 bg-neutral-800/80 backdrop-blur border border-white/10 text-white py-3 rounded-xl text-sm font-bold shadow-lg">&larr; 修改內容</button>
                 <button onClick={handleSkipLocation} className="flex-1 bg-neutral-800/80 backdrop-blur border border-white/10 text-white py-3 rounded-xl text-sm font-bold shadow-lg">直接完成 &rarr;</button>
             </div>
        )}
        <Court 
            myName={teamConfig.myName} opName={teamConfig.opName} 
            myLineup={initialMyLineup} opLineup={initialOpLineup} 
            step={step}
            startCoord={startCoord}
            onStartCoordChange={setStartCoord}
            onPlayerClick={handlePlayerClick}
            onLocationRecord={handleLocationRecord}
        />
      </div>
      {step === 'SELECT_PLAYER' && (
        <div className="flex-none bg-neutral-900 border-t border-neutral-800 p-3 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.8)] z-[100]">
             <div className="grid grid-cols-5 gap-2 max-w-[430px] mx-auto">
                 <button onClick={handleOpenSave} className="w-full h-14 bg-emerald-900 text-emerald-100 text-xs rounded-lg border border-emerald-700 font-bold flex flex-col items-center justify-center gap-1">暫存</button>
                 <button onClick={handleOpenLoad} className="w-full h-14 bg-orange-900 text-orange-100 text-xs rounded-lg border border-orange-700 font-bold flex flex-col items-center justify-center gap-1">讀取</button>
                 <button onClick={() => setShowStats(true)} className="w-full h-14 bg-neutral-700 text-white text-xs rounded-lg border border-neutral-500 font-bold flex flex-col items-center justify-center gap-1">紀錄</button>
                 <button onClick={handleNewSetClick} className="w-full h-14 bg-purple-900 text-purple-100 text-xs rounded-lg border border-purple-700 font-bold flex flex-col items-center justify-center gap-1"><span className="text-lg font-black leading-none">+1</span>新局數</button>
                 <button onClick={handleNewGameClick} className="w-full h-14 bg-blue-900 text-blue-100 text-xs rounded-lg border border-blue-700 font-bold flex flex-col items-center justify-center gap-1">新比賽</button>
             </div>
        </div>
      )}
      {step === 'QUICK_DETAILS' && renderQuickDetailsModal()}
      {showSubInput && renderSubInput()}
      {renderSaveModal()}
      {renderLoadModal()}
      {renderSystemModal()}
      {showStats && (
        <StatsOverlay 
            logs={logs} teamConfig={teamConfig} 
            myScore={myScore} opScore={opScore} 
            mySetWins={mySetWins} opSetWins={opSetWins} 
            currentSet={currentSet} onBack={() => setShowStats(false)}
        />
      )}
    </div>
  );
};
