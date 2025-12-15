
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState } from '../types';
import { sfx } from '../services/SoundSystem';

export const TempleScreen: React.FC = () => {
    const { setGameState, party, characterPool } = useGameStore();

    const handleExit = () => {
        sfx.playUiClick();
        setGameState(GameState.OVERWORLD);
    };

    const goToSummon = () => {
        sfx.playMagic();
        setGameState(GameState.SUMMONING);
    };

    const goToParty = () => {
        sfx.playUiClick();
        setGameState(GameState.PARTY_MANAGEMENT);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
            {/* Background */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black pointer-events-none" />
            <div className="fixed inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }} />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-4xl p-6 md:p-10 flex flex-col items-center text-center">
                
                <div className="mb-8 md:mb-12">
                    <span className="text-purple-500 font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs mb-2 block animate-pulse">Sanctuary of Souls</span>
                    <h1 className="text-4xl md:text-6xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-200 to-purple-600 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                        THE TEMPLE
                    </h1>
                    <div className="h-px w-24 md:w-32 bg-purple-500/50 mx-auto mt-4" />
                </div>

                {/* Menu Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-2xl">
                    
                    {/* SUMMON CARD */}
                    <button 
                        onClick={goToSummon}
                        className="group relative bg-slate-900/80 border border-purple-500/30 p-6 md:p-8 rounded-2xl overflow-hidden hover:border-purple-400 transition-all hover:-translate-y-1 shadow-lg hover:shadow-purple-900/20 text-left"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                            <span className="text-4xl md:text-6xl grayscale group-hover:grayscale-0">🔮</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-purple-300">Summon Hero</h3>
                        <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                            Perform rituals to pull souls from the void. Use your camera or local entropy to generate unique heroes.
                        </p>
                        <div className="mt-4 md:mt-6 text-[10px] md:text-xs font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                            <span>Begin Ritual</span> <span>→</span>
                        </div>
                    </button>

                    {/* PARTY CARD */}
                    <button 
                        onClick={goToParty}
                        className="group relative bg-slate-900/80 border border-blue-500/30 p-6 md:p-8 rounded-2xl overflow-hidden hover:border-blue-400 transition-all hover:-translate-y-1 shadow-lg hover:shadow-blue-900/20 text-left"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                            <span className="text-4xl md:text-6xl grayscale group-hover:grayscale-0">🛡️</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-blue-300">Manage Party</h3>
                        <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                            Organize your active team and reserve pool. Swap heroes and inspect their capabilities.
                        </p>
                        <div className="mt-4 md:mt-6 text-xs text-slate-500 font-mono">
                            Heroes: <span className="text-white">{party.length} Active</span> / <span className="text-slate-400">{characterPool.length} Reserve</span>
                        </div>
                        <div className="mt-2 text-[10px] md:text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                            <span>Organize</span> <span>→</span>
                        </div>
                    </button>

                </div>

                <button 
                    onClick={handleExit}
                    className="mt-12 md:mt-16 text-slate-500 hover:text-white uppercase text-xs font-bold tracking-widest border border-transparent hover:border-slate-700 px-6 py-3 rounded transition-all"
                >
                    Return to World
                </button>

            </div>
        </div>
    );
};
