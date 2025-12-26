import React, { useRef, useState } from 'react';
import { Lineup, Position, Coordinate } from '../types';

interface CourtProps {
  myName: string;
  opName: string;
  myLineup: Lineup;
  opLineup: Lineup;
  step: 'SELECT_PLAYER' | 'SELECT_ACTION' | 'SELECT_QUALITY' | 'RECORD_LOCATION' | 'SELECT_RESULT';
  onPlayerClick: (pos: Position, isMyTeam: boolean, coord: Coordinate) => void;
  onLocationRecord: (start: Coordinate, end: Coordinate) => void;
}

export const Court: React.FC<CourtProps> = ({ 
    myName, opName, myLineup, opLineup, step, onPlayerClick, onLocationRecord 
}) => {
  const courtRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<Coordinate | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Coordinate | null>(null);

  // --- Coordinate Helper ---
  const getCoord = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Coordinate => {
    if (!courtRef.current) return { x: 0, y: 0 };
    const rect = courtRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  // --- Interaction Handlers ---
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (step !== 'RECORD_LOCATION') return;
    const coord = getCoord(e);
    setDragStart(coord);
    setDragCurrent(coord);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (step !== 'RECORD_LOCATION' || !dragStart) return;
    setDragCurrent(getCoord(e));
  };

  const handlePointerUp = () => {
    if (step !== 'RECORD_LOCATION' || !dragStart || !dragCurrent) return;
    onLocationRecord(dragStart, dragCurrent);
    setDragStart(null);
    setDragCurrent(null);
  };

  // --- Player Positioning Logic ---
  const getPlayerStyle = (pos: Position, isMyTeam: boolean): React.CSSProperties => {
    let x = 50;
    let y = 50;

    if (isMyTeam) {
      // Bottom Half (50-100%)
      const rowY = [4, 3, 2].includes(pos) ? 65 : 85;
      y = rowY;
      
      if ([4, 5].includes(pos)) x = 20; // Left
      if ([3, 6].includes(pos)) x = 50; // Center
      if ([2, 1].includes(pos)) x = 80; // Right
    } else {
      // Top Half (0-50%)
      const rowY = [2, 3, 4].includes(pos) ? 35 : 15;
      y = rowY;
      
      if ([2, 1].includes(pos)) x = 20; // Appears Left
      if ([3, 6].includes(pos)) x = 50; // Center
      if ([4, 5].includes(pos)) x = 80; // Appears Right
    }

    return { top: `${y}%`, left: `${x}%` };
  };

  return (
    <div className="w-full h-full p-4 flex justify-center items-center bg-[#222]">
      {/* Container to maintain aspect ratio and catch out-of-bounds clicks */}
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
        {/* OUT OF BOUNDS AREA (The whole div is out of bounds, inner div is court) */}
        <div className="absolute inset-0 border border-neutral-700/50 pointer-events-none overflow-hidden">
            <span className="text-[10px] text-neutral-600 absolute top-2 left-2">OUT</span>
        </div>

        {/* INNER COURT (9x18m) */}
        <div className="absolute top-[5%] bottom-[5%] left-[10%] right-[10%] bg-court border-2 border-white pointer-events-none shadow-2xl z-10 overflow-hidden">
            {/* Watermarks (Inside Court) */}
            <div className="absolute inset-0 flex flex-col justify-between py-8 pointer-events-none opacity-20">
                {/* Opponent (Top) - UPDATED: Removed rotate-180 for readability */}
                <div className="w-full text-center">
                    <span className="text-4xl font-black text-black uppercase tracking-widest block select-none whitespace-nowrap truncate px-2">
                        {opName}
                    </span>
                </div>
                {/* My Team (Bottom) */}
                <div className="w-full text-center">
                    <span className="text-4xl font-black text-black uppercase tracking-widest block select-none whitespace-nowrap truncate px-2">
                        {myName}
                    </span>
                </div>
            </div>

            {/* NET (Center Line) */}
            <div className="absolute top-[50%] w-full h-1 bg-white shadow-sm z-10 translate-y-[-50%]"></div>
            
            {/* 3M Lines (Attack Lines) */}
            <div className="absolute top-[33.33%] w-full h-0.5 bg-white/60"></div>
            <div className="absolute top-[66.66%] w-full h-0.5 bg-white/60"></div>
        </div>

        {/* PLAYERS (Only visible in Selection Phase) */}
        {step === 'SELECT_PLAYER' && (
            <>
                {/* My Team */}
                {[1, 2, 3, 4, 5, 6].map((p) => {
                    const pos = p as Position;
                    const num = myLineup[pos];
                    const style = getPlayerStyle(pos, true);

                    return (
                        <div 
                            key={`my-${pos}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const coord = getCoord(e);
                                onPlayerClick(pos, true, coord);
                            }}
                            style={style}
                            className={`
                                absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg cursor-pointer hover:scale-105 transition-transform z-20 border-4
                                bg-accent text-white border-white
                            `}
                        >
                            {num || pos}
                        </div>
                    );
                })}

                {/* Op Team */}
                {[1, 2, 3, 4, 5, 6].map((p) => {
                    const pos = p as Position;
                    const num = opLineup[pos];
                    const style = getPlayerStyle(pos, false);

                    return (
                        <div 
                            key={`op-${pos}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const coord = getCoord(e);
                                onPlayerClick(pos, false, coord);
                            }}
                            style={style}
                            className={`
                                absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg cursor-pointer hover:scale-105 transition-transform z-20 border-4
                                bg-red-600 text-white border-white
                            `}
                        >
                            {num || pos}
                        </div>
                    );
                })}
            </>
        )}

        {/* DRAG VISUALIZATION (Record Phase) */}
        {step === 'RECORD_LOCATION' && dragStart && dragCurrent && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#FFF" />
                    </marker>
                </defs>
                <line 
                    x1={`${dragStart.x}%`} y1={`${dragStart.y}%`} 
                    x2={`${dragCurrent.x}%`} y2={`${dragCurrent.y}%`} 
                    stroke="#FFF" strokeWidth="4" markerEnd="url(#arrowhead)" opacity="0.8" 
                />
                <circle cx={`${dragStart.x}%`} cy={`${dragStart.y}%`} r="6" fill="#FFF" opacity="0.5" />
            </svg>
        )}
      </div>
    </div>
  );
};