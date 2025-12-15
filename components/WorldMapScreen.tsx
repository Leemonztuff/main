
import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { WorldGenerator } from '../services/WorldGenerator';
import { TERRAIN_COLORS, NOISE_TEXTURE_URL } from '../constants';
import { TerrainType } from '../types';

export const WorldMapScreen = () => {
    const { exploredTiles, dimension, playerPos, toggleMap, quests } = useGameStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(4); // Initial Zoom (Pixels per hex)
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    const activeQuests = quests.filter(q => !q.completed);
    const completedQuests = quests.filter(q => q.completed);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const width = canvas.width = canvas.clientWidth;
        const height = canvas.height = canvas.clientHeight;

        // --- DRAW LOOP ---
        // Fill Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        // Draw Explored Tiles
        const exploredSet = exploredTiles[dimension];
        const centerX = width / 2 + pan.x;
        const centerY = height / 2 + pan.y;

        exploredSet.forEach(key => {
            const [q, r] = key.split(',').map(Number);
            
            // Calculate relative to player for centering
            const relQ = q - playerPos.x;
            const relR = r - playerPos.y;

            // Convert Axial to Pixel (Simplified for minimap)
            const x = centerX + (relQ * scale * 1.5); // Approx horizontal dist
            const y = centerY + (relR * scale * 1.7); // Approx vertical dist
            const xSkew = x + (relR * scale * 0.8); // Skew for hex grid

            if (xSkew < 0 || xSkew > width || y < 0 || y > height) return;

            const tile = WorldGenerator.getTile(q, r, dimension);
            ctx.fillStyle = TERRAIN_COLORS[tile.terrain] || '#444';
            
            // Draw Dot
            ctx.beginPath();
            ctx.arc(xSkew, y, scale * 0.6, 0, Math.PI * 2);
            ctx.fill();

            // Draw POI indicators
            if (tile.terrain === TerrainType.VILLAGE || tile.terrain === TerrainType.CASTLE || tile.poiType) {
                ctx.fillStyle = '#fbbf24'; // Amber
                ctx.beginPath();
                ctx.arc(xSkew, y, scale * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            if (tile.hasPortal) {
                ctx.fillStyle = '#a855f7'; // Purple
                ctx.beginPath();
                ctx.arc(xSkew, y, scale * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Draw Player
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, scale * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw "Camera Frame" (What user sees in game)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - (10 * scale), centerY - (8 * scale), 20 * scale, 16 * scale);

    }, [exploredTiles, dimension, playerPos, scale, pan]);

    // --- INPUT HANDLERS ---
    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? -1 : 1;
        setScale(s => Math.max(1, Math.min(10, s + delta)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 p-2 md:p-8">
            <div className="w-full max-w-6xl h-full max-h-[90vh] grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative">
                
                {/* CLOSE BTN */}
                <button 
                    onClick={toggleMap}
                    className="absolute top-2 right-2 lg:top-4 lg:right-4 z-50 bg-slate-800 hover:bg-red-900 text-white rounded-full w-10 h-10 flex items-center justify-center border border-slate-600 shadow-lg transition-colors"
                >
                    ✕
                </button>

                {/* LEFT: MAP CANVAS */}
                <div className="lg:col-span-2 relative bg-black border-r border-slate-700 h-[60vh] lg:h-auto">
                    <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1 rounded border border-white/10 text-xs text-slate-300 pointer-events-none">
                        <span className="text-amber-400 font-bold uppercase tracking-wider">{dimension} REALM</span>
                        <br/>
                        Pos: {playerPos.x}, {playerPos.y}
                    </div>
                    
                    <div className="absolute bottom-4 right-4 z-10 flex gap-3">
                        <button onClick={() => setScale(s => Math.min(10, s+1))} className="w-12 h-12 bg-slate-800 text-white rounded-full flex items-center justify-center border border-slate-600 hover:bg-slate-700 shadow-lg text-xl font-bold">+</button>
                        <button onClick={() => setScale(s => Math.max(1, s-1))} className="w-12 h-12 bg-slate-800 text-white rounded-full flex items-center justify-center border border-slate-600 hover:bg-slate-700 shadow-lg text-xl font-bold">-</button>
                    </div>

                    <canvas 
                        ref={canvasRef} 
                        className="w-full h-full cursor-move touch-none"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>

                {/* RIGHT: QUEST LOG */}
                <div className="bg-slate-900 flex flex-col h-[30vh] lg:h-auto border-t lg:border-t-0 lg:border-l border-slate-700 relative">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NOISE_TEXTURE_URL}")` }} />
                    <div className="p-4 border-b border-amber-600/30 bg-gradient-to-b from-slate-800 to-slate-900 z-10">
                        <h2 className="text-xl font-serif font-bold text-amber-100 flex items-center gap-3">
                            <span>📜</span> Quest Journal
                        </h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar z-10">
                        <div>
                            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 border-b border-amber-500/20 pb-1">Active Quests</h3>
                            {activeQuests.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No active quests.</p>
                            ) : (
                                <div className="space-y-4">
                                    {activeQuests.map(q => (
                                        <div key={q.id} className="group">
                                            <h4 className="text-slate-200 font-serif font-bold text-base group-hover:text-amber-300 transition-colors">
                                                {q.type === 'MAIN' && <span className="text-amber-600 mr-2">★</span>}
                                                {q.title}
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{q.description}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
