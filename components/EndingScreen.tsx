
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState } from '../types';
import { NOISE_TEXTURE_URL } from '../constants';

export const EndingScreen = () => {
    const { quitToMenu, setGameState } = useGameStore();

    const handleContinue = () => {
        setGameState(GameState.OVERWORLD);
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black font-serif text-center overflow-hidden">
            {/* Cinematic Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NOISE_TEXTURE_URL}")` }} />
            
            {/* Particles (Simple CSS) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 50 }).map((_, i) => (
                    <div 
                        key={i}
                        className="absolute w-1 h-1 bg-amber-500 rounded-full opacity-50 animate-[float-damage_10s_linear_infinite]"
                        style={{ 
                            left: `${Math.random() * 100}%`, 
                            top: '100%', 
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`
                        }} 
                    />
                ))}
            </div>

            <div className="relative z-10 max-w-2xl px-6 animate-in fade-in duration-1000 slide-in-from-bottom-10">
                <div className="text-amber-500 font-bold tracking-[0.5em] text-sm uppercase mb-4 opacity-80">Campaign Complete</div>
                
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-amber-700 mb-8 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                    VECNA FALLS
                </h1>

                <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-8 font-sans">
                    The Lich Lord's physical form crumbles into ash. The Shadow Realm trembles as the tether between worlds begins to heal. You have saved <span className="text-amber-400 font-bold">Terra Aeterna</span>, but the scars of the rift remain.
                </p>

                <div className="h-px w-32 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mx-auto mb-8" />

                <div className="flex flex-col md:flex-row gap-4 justify-center font-sans">
                    <button 
                        onClick={handleContinue}
                        className="px-8 py-3 bg-slate-900 border border-slate-700 hover:border-amber-500 text-white rounded font-bold uppercase tracking-widest transition-all hover:scale-105"
                    >
                        Continue Exploring
                    </button>
                    <button 
                        onClick={quitToMenu}
                        className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-amber-900/50"
                    >
                        Return to Title
                    </button>
                </div>
            </div>
        </div>
    );
};
