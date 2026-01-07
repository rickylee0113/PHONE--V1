
import React, { useRef, useState, useEffect } from 'react';
import { Lineup, Position, Coordinate } from '../types';

interface CourtProps {
  myName: string;
  opName: string;
  myLineup: Lineup;
  opLineup: Lineup;
  step: 'SELECT_PLAYER' | 'SELECT_ACTION' | 'SELECT_QUALITY' | 'RECORD_LOCATION' | 'SELECT_RESULT';
  startCoord: Coordinate | null;
  onStartCoordChange: (coord: Coordinate) => void;
  onPlayerClick: (pos: Position, isMyTeam: boolean, coord: Coordinate) => void;
  onLocationRecord: (start: Coordinate, end: Coordinate) => void;
}

export const Court: React.FC<CourtProps> = ({ 
    myName, opName, myLineup, opLineup, step, startCoord, onStartCoordChange, onPlayerClick, onLocationRecord 
}) => {
  const courtRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [previewEndCoord, setPreviewEndCoord] = useState<Coordinate | null>(null);

  // --- Coordinate Helper ---
  const getCoord = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Coordinate => {
    if (!courtRef.current) return { x: 0, y: 0 };
    const rect = courtRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    };
  };

  const isInsideCourt = (coord: Coordinate) => {
      // 球場邊界: x 10-90, y 5-95
      return coord.x >= 10 && coord.x <= 90 && coord.y >= 5 && coord.y <= 95;
  };

  // --- Interaction Handlers ---
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (step !== 'RECORD_LOCATION') return;
    
    const clickCoord = getCoord(e);
    
    if (startCoord) {
        const dx = Math.abs(clickCoord.x - startCoord.x);
        const dy = Math.abs(clickCoord.y - startCoord.y);
        if (dx < 10 && dy < 10) {
            setIsDraggingStart(true);
            return;
        }
    }
    setPreviewEndCoord(clickCoord);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (step === 'RECORD_LOCATION') {
        const currentCoord = getCoord(e);
        if (isDraggingStart && startCoord) {
            onStartCoordChange(currentCoord);
        } else if (previewEndCoord) {
            setPreviewEndCoord(currentCoord);
        }
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (step !== 'RECORD_LOCATION') return;

    if (isDraggingStart) {
        setIsDraggingStart(false);
    } else {
        const endCoord = getCoord(e);
        if (startCoord) {
            onLocationRecord(startCoord, endCoord);
        }
    }
    setPreviewEndCoord(null);
  };

  const getPlayerStyle = (pos: Position, isMyTeam: boolean): React.CSSProperties => {
    let x = 50, y = 50;
    if (isMyTeam) {
      const rowY = [4, 3, 2].includes(pos) ? 65 : 85;
      y = rowY;
      if ([4, 5].includes(pos)) x = 20;
      if ([3, 6].includes(pos)) x = 50;
      if ([2, 1].includes(pos)) x = 80;
    } else {
      const rowY = [2, 3, 4].includes(pos) ? 35 : 15;
      y = rowY;
      if ([2, 1].includes(pos)) x = 20;
      if ([3, 6].includes(pos)) x = 50;
      if ([4, 5].includes(pos)) x = 80;
    }
    return { top: `${y}%`, left: `${x}%` };
  };

  return (
    <div className="w-full h-full p-4 flex justify-center items-center bg-[#222]">
      <div 
        ref={courtRef}
        className="relative w-full h-full max-w-[400px] touch-none select-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* OUT OF BOUNDS AREA */}
        <div className="absolute inset-0 border border-neutral-700/50 pointer-events-none overflow-hidden">
            <span className="text-[10px] text-neutral-600 absolute top-2 left-2">OUT</span>
        </div>

        {/* INNER COURT (9x18m) - 佔據 x:10-90, y:5-95 */}
        <div className="absolute top-[5%] bottom-[5%] left-[10%] right-[10%] bg-court border-2 border-white pointer-events-none shadow-2xl z-10 overflow-hidden">
            <div className="absolute inset-0 flex flex-col justify-between py-8 pointer-events-none opacity-20">
                <div className="w-full text-center"><span className="text-4xl font-black text-black uppercase tracking-widest block truncate px-2">{opName}</span></div>
                <div className="w-full text-center"><span className="text-4xl font-black text-black uppercase tracking-widest block truncate px-2">{myName}</span></div>
            </div>
            <div className="absolute top-[50%] w-full h-1 bg-white shadow-sm z-10 translate-y-[-50%]"></div>
            <div className="absolute top-[33.33%] w-full h-0.5 bg-white/60"></div>
            <div className="absolute top-[66.66%] w-full h-0.5 bg-white/60"></div>
        </div>

        {/* PLAYERS */}
        {step === 'SELECT_PLAYER' && (
            <>
                {[1, 2, 3, 4, 5, 6].map((p) => {
                    const pos = p as Position;
                    const num = myLineup[pos];
                    return (
                        <div key={`my-${pos}`} onClick={(e) => { e.stopPropagation(); onPlayerClick(pos, true, getCoord(e)); }} style={getPlayerStyle(pos, true)} className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg cursor-pointer hover:scale-105 transition-transform z-20 border-4 bg-accent text-white border-white">
                            {num || pos}
                        </div>
                    );
                })}
                {[1, 2, 3, 4, 5, 6].map((p) => {
                    const pos = p as Position;
                    const num = opLineup[pos];
                    return (
                        <div key={`op-${pos}`} onClick={(e) => { e.stopPropagation(); onPlayerClick(pos, false, getCoord(e)); }} style={getPlayerStyle(pos, false)} className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg cursor-pointer hover:scale-105 transition-transform z-20 border-4 bg-red-600 text-white border-white">
                            {num || pos}
                        </div>
                    );
                })}
            </>
        )}

        {/* VISUALIZATION */}
        {step === 'RECORD_LOCATION' && startCoord && (
            <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                    {/* Start Marker A */}
                    <circle cx={`${startCoord.x}%`} cy={`${startCoord.y}%`} r="12" fill="#10B981" fillOpacity="0.4" className="animate-pulse" />
                    <circle cx={`${startCoord.x}%`} cy={`${startCoord.y}%`} r="6" fill="#10B981" />
                    <text x={`${startCoord.x}%`} y={`${startCoord.y - 5}%`} fill="#FFF" fontSize="12" fontWeight="bold" textAnchor="middle">A (起點)</text>

                    {/* Drag Line Preview */}
                    {previewEndCoord && (
                        <>
                            <line 
                                x1={`${startCoord.x}%`} y1={`${startCoord.y}%`} 
                                x2={`${previewEndCoord.x}%`} y2={`${previewEndCoord.y}%`} 
                                stroke="#FFF" strokeWidth="2" strokeDasharray="5,5" 
                            />
                            <circle 
                                cx={`${previewEndCoord.x}%`} cy={`${previewEndCoord.y}%`} r="10" 
                                fill={isInsideCourt(previewEndCoord) ? "#10B981" : "#EF4444"} 
                                fillOpacity="0.6" 
                            />
                            <text 
                                x={`${previewEndCoord.x}%`} y={`${previewEndCoord.y - 5}%`} 
                                fill="#FFF" fontSize="10" fontWeight="bold" textAnchor="middle"
                            >
                                {isInsideCourt(previewEndCoord) ? "IN" : "OUT"}
                            </text>
                        </>
                    )}
                </svg>
            </>
        )}
      </div>
    </div>
  );
};
