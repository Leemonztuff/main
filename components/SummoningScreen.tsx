
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState, ItemRarity } from '../types';
import { CLASS_CONFIG, RACE_ICONS, RARITY_COLORS, getSprite } from '../constants';
import { sfx } from '../services/SoundSystem';
import { SummoningService, SummonResult } from '../services/SummoningService';

export const SummoningScreen: React.FC = () => {
    const { setGameState, summonCharacter, spendGold, gold } = useGameStore();
    const [phase, setPhase] = useState<'SCAN' | 'DECODING' | 'RESULT'>('SCAN');
    const [cameraActive, setCameraActive] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    // Scanner State
    const [scanLines, setScanLines] = useState<string[]>([]);
    const [entropyLevel, setEntropyLevel] = useState(0);
    const [capturedSeed, setCapturedSeed] = useState('');
    const [summonResult, setSummonResult] = useState<SummonResult | null>(null);

    // COST CONSTANTS
    const STABILIZE_COST = 100;

    // --- CAMERA INIT LOGIC ---
    const initializeCamera = async () => {
        setPermissionDenied(false);
        try {
            sfx.playUiClick();
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera API not supported");
            }

            // Try environment facing camera first
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "environment" } 
                });
            } catch (err) {
                console.warn("Environment camera failed, falling back to default", err);
                // Fallback to any video device
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            
            streamRef.current = stream;
            setCameraActive(true);
            
        } catch (err) {
            console.warn("Camera access denied or unavailable", err);
            setPermissionDenied(true);
            sfx.playUiHover();
        }
    };

    // Robust video attachment
    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            const video = videoRef.current;
            video.srcObject = streamRef.current;
            
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Auto-play was prevented:", error);
                });
            }
        }
    }, [cameraActive]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    // Simulate "Scanning" logic on frame updates
    useEffect(() => {
        if (phase === 'SCAN') {
            const interval = window.setInterval(() => {
                if (cameraActive && videoRef.current && canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx && videoRef.current.readyState === 4) {
                        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                        const frame = ctx.getImageData(150, 110, 20, 20); // Center sample
                        
                        let brightnessSum = 0;
                        for(let i=0; i<frame.data.length; i+=4) brightnessSum += frame.data[i];
                        const avg = brightnessSum / (frame.data.length / 4);
                        const variation = Math.abs(avg - 127); 
                        
                        const normalized = Math.min(100, Math.floor((variation / 127) * 100) + 20);
                        setEntropyLevel(normalized);
                    }
                } else if (!cameraActive) {
                    // Manual Simulation if no camera
                    setEntropyLevel(prev => Math.min(100, Math.max(0, prev + (Math.random() - 0.4) * 10)));
                }

                // Matrix text effect
                if (Math.random() > 0.7) {
                    const hex = Math.floor(Math.random()*16777215).toString(16).toUpperCase();
                    setScanLines(prev => [`> SIGNAL: ${hex.slice(0,6)}`, ...prev.slice(0, 5)]);
                }
            }, 100);
            return () => window.clearInterval(interval);
        }
    }, [phase, cameraActive]);

    const handleCapture = () => {
        let finalSeed = '';
        if (cameraActive && videoRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                canvasRef.current.width = 640;
                canvasRef.current.height = 480;
                ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                const data = ctx.getImageData(0,0,640,480).data;
                const samples = [];
                for(let i=0; i<data.length; i+=1000) samples.push(data[i]);
                finalSeed = samples.join('');
            }
        } else {
            finalSeed = Date.now().toString() + Math.random().toString();
        }
        
        setCapturedSeed(finalSeed);
        setSummonResult(SummoningService.generateFromSeed(finalSeed));
        sfx.playMagic();
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
        setPhase('DECODING');
    };

    const handleSummonAction = (method: 'FORCE' | 'STABILIZE') => {
        if (method === 'STABILIZE') {
            if (gold < STABILIZE_COST) { sfx.playUiHover(); return; }
            spendGold(STABILIZE_COST);
        }
        summonCharacter(capturedSeed, method);
        setPhase('RESULT');
    };

    const RarityBadge = ({ rarity }: { rarity: ItemRarity }) => {
        const color = RARITY_COLORS[rarity];
        return (
            <div className="px-3 py-1 rounded border bg-black/50 backdrop-blur" style={{ borderColor: color, color: color }}>
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{rarity}</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col font-mono overflow-hidden">
            
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ 
                backgroundImage: 'linear-gradient(rgba(168, 85, 247, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.2) 1px, transparent 1px)', 
                backgroundSize: '40px 40px' 
            }} />

            {/* HEADER */}
            <div className="p-4 md:p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black to-transparent shrink-0">
                <h1 className="text-xl md:text-2xl font-bold text-purple-400 flex items-center gap-3">
                    <span className="animate-pulse">👁️</span> RITUAL
                </h1>
                <button onClick={() => setGameState(GameState.TEMPLE_HUB)} className="text-slate-500 hover:text-white border border-slate-700 px-3 py-1 md:px-4 md:py-2 rounded uppercase text-[10px] md:text-xs font-bold hover:bg-slate-900 transition-colors">
                    Abort
                </button>
            </div>

            {/* --- PHASE 1: SCANNER --- */}
            {phase === 'SCAN' && (
                <div className="flex-1 flex flex-col items-center justify-center relative p-4 overflow-hidden">
                    {/* Viewfinder */}
                    <div className="relative w-full max-w-md aspect-square bg-black border-2 border-slate-800 rounded-lg overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.2)] group max-h-[50vh] md:max-h-none">
                        
                        {cameraActive ? (
                            <video 
                                ref={videoRef} 
                                className="w-full h-full object-cover opacity-60 filter contrast-125 saturate-0 sepia-[0.5] hue-rotate-[270deg]" 
                                autoPlay 
                                playsInline 
                                muted 
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/50 relative overflow-hidden">
                                {/* Static Noise Effect */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")` }}></div>
                                
                                <div className="text-5xl md:text-6xl mb-4 opacity-20 animate-pulse">📷</div>
                                
                                {!permissionDenied ? (
                                    <button onClick={initializeCamera} className="px-6 py-2 border border-purple-500/50 text-purple-400 hover:bg-purple-900/20 rounded text-xs md:text-sm shadow-lg hover:shadow-purple-500/20 transition-all font-bold tracking-wider relative z-10">
                                        INITIALIZE OPTICS
                                    </button>
                                ) : (
                                    <div className="text-center px-4">
                                        <p className="text-red-400 font-bold mb-2">OPTICS OFFLINE</p>
                                        <button onClick={handleCapture} className="text-slate-400 text-xs underline">
                                            Use Aether Static Simulation
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* HUD Overlay */}
                        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                            <div className="flex justify-between">
                                <div className="w-8 h-8 border-t-2 border-l-2 border-purple-500/50" />
                                <div className="w-8 h-8 border-t-2 border-r-2 border-purple-500/50" />
                            </div>
                            
                            {/* Center Reticle */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`w-32 h-32 border border-purple-500/30 rounded-full flex items-center justify-center transition-all duration-300 ${entropyLevel > 70 ? 'border-purple-400 shadow-[0_0_20px_#a855f7] scale-110' : ''}`}>
                                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <div className="w-8 h-8 border-b-2 border-l-2 border-purple-500/50" />
                                <div className="w-8 h-8 border-b-2 border-r-2 border-purple-500/50" />
                            </div>
                        </div>

                        {/* Data Stream */}
                        <div className="absolute bottom-4 left-4 right-4 h-24 overflow-hidden flex flex-col justify-end text-[10px] text-purple-400/80 font-mono leading-tight">
                            {scanLines.map((line, i) => <div key={i}>{line}</div>)}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-md">
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-full px-4">
                            <span>Entropy</span>
                            <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 transition-all duration-200" style={{ width: `${entropyLevel}%` }} />
                            </div>
                            <span className="w-8 text-right text-purple-300">{entropyLevel}%</span>
                        </div>

                        <button 
                            onClick={handleCapture}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg px-12 py-4 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 w-full justify-center disabled:opacity-50 disabled:grayscale"
                            disabled={!cameraActive && !permissionDenied}
                        >
                            <span>🔮</span> MANIFEST SOUL
                        </button>
                    </div>
                </div>
            )}

            {/* --- PHASE 2: DECODING (Review) --- */}
            {phase === 'DECODING' && summonResult && (
                <div className="flex-1 w-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 p-6 overflow-y-auto custom-scrollbar">
                    
                    <h2 className="text-3xl font-serif text-white mb-8 text-center shrink-0">Fate Revealed</h2>

                    <div className={`relative bg-slate-900 border-2 rounded-xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center gap-6 shrink-0`} style={{ borderColor: RARITY_COLORS[summonResult.rarity] }}>
                        <div className="absolute inset-0 blur-xl opacity-20 z-0" style={{ backgroundColor: RARITY_COLORS[summonResult.rarity] }} />
                        
                        <div className="relative z-10 w-32 h-32 bg-black rounded-full border-4 border-slate-700 overflow-hidden shadow-inner flex items-center justify-center shrink-0">
                            <img 
                                src={CLASS_CONFIG[summonResult.class].icon} 
                                className="w-20 h-20 opacity-90" 
                                onError={(e) => { 
                                    e.currentTarget.onerror = null; 
                                    e.currentTarget.src = getSprite(summonResult.race, summonResult.class); 
                                }}
                            />
                            <div className="absolute bottom-0 right-0 bg-slate-800 p-2 rounded-full border border-slate-600">
                                <img src={RACE_ICONS[summonResult.race]} className="w-6 h-6 invert" />
                            </div>
                        </div>

                        <div className="z-10 text-center space-y-2">
                            <RarityBadge rarity={summonResult.rarity} />
                            <h3 className="text-2xl font-bold text-white mt-2">{summonResult.name}</h3>
                            <p className="text-slate-400 text-sm">{summonResult.race} {summonResult.class}</p>
                        </div>

                        <div className="z-10 grid grid-cols-2 gap-4 w-full bg-black/40 p-4 rounded-lg">
                            <div className="text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold">Affinity</div>
                                <div className="text-base text-amber-300 font-bold">{summonResult.affinity}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold">Potential</div>
                                <div className="text-base text-purple-300 font-bold">{summonResult.potential}/100</div>
                            </div>
                        </div>

                        {summonResult.traits.length > 0 && (
                            <div className="z-10 flex flex-wrap gap-2 justify-center">
                                {summonResult.traits.map(t => (
                                    <span key={t} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 mt-8 w-full max-w-md shrink-0 mb-4">
                        <button 
                            onClick={() => handleSummonAction('FORCE')}
                            className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-200 py-4 rounded-lg font-bold uppercase text-xs tracking-wider transition-all"
                        >
                            <div>Force Bond</div>
                            <div className="text-[9px] opacity-70 mt-1">Risk of Corruption</div>
                        </button>
                        <button 
                            onClick={() => handleSummonAction('STABILIZE')}
                            disabled={gold < STABILIZE_COST}
                            className={`flex-1 border py-4 rounded-lg font-bold uppercase text-xs tracking-wider transition-all ${gold >= STABILIZE_COST ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}
                        >
                            <div>Stabilize</div>
                            <div className="text-[9px] opacity-90 mt-1">{STABILIZE_COST} Gold</div>
                        </button>
                    </div>

                </div>
            )}

            {/* --- PHASE 3: RESULT --- */}
            {phase === 'RESULT' && (
                <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-150 duration-700 bg-white/5 p-4">
                    <div className="text-6xl mb-6 animate-bounce">✨</div>
                    <h2 className="text-4xl font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] text-center">
                        SUMMONED
                    </h2>
                    <p className="mt-4 text-slate-300 text-base text-center">The hero waits in the Temple Pool.</p>
                    <button onClick={() => setGameState(GameState.TEMPLE_HUB)} className="mt-12 text-slate-400 hover:text-white underline underline-offset-4 text-base">
                        Return
                    </button>
                </div>
            )}

        </div>
    );
};
