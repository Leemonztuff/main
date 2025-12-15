
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState, Ability, Attributes } from '../types';
import { getModifier } from '../services/dndRules';
import { sfx } from '../services/SoundSystem';

export const LevelUpScreen = () => {
    const { party, applyLevelUp, setGameState } = useGameStore();
    const [characterIndex, setCharacterIndex] = useState(0);
    const [pendingAttributes, setPendingAttributes] = useState<Partial<Attributes>>({});
    const [pointsRemaining, setPointsRemaining] = useState(2);

    const character = party[characterIndex];
    // Filter only characters who actually need to level up
    const eligibleCharacters = party.filter(p => p.stats.xp >= p.stats.xpToNextLevel);
    
    // Safety check: if no one is eligible, return to overworld
    useEffect(() => {
        if (eligibleCharacters.length === 0) {
            setGameState(GameState.OVERWORLD);
        } else {
            // Find index of first eligible char in the full party list to display
            const firstEligible = party.findIndex(p => p.id === eligibleCharacters[0].id);
            if (characterIndex !== firstEligible && pointsRemaining === 2) {
                // Only auto-switch if we haven't started editing
                setCharacterIndex(firstEligible);
            }
        }
    }, [eligibleCharacters.length, party, setGameState]);

    if (!character) return null;

    const handleAttributeChange = (attr: Ability, change: number) => {
        const currentBonus = pendingAttributes[attr] || 0;
        
        if (change > 0 && pointsRemaining > 0) {
            setPendingAttributes({ ...pendingAttributes, [attr]: currentBonus + 1 });
            setPointsRemaining(pointsRemaining - 1);
            sfx.playUiHover();
        } else if (change < 0 && currentBonus > 0) {
            setPendingAttributes({ ...pendingAttributes, [attr]: currentBonus - 1 });
            setPointsRemaining(pointsRemaining + 1);
            sfx.playUiHover();
        }
    };

    const handleConfirm = () => {
        if (pointsRemaining > 0 && !confirm("You have unused points. Continue anyway?")) return;
        
        applyLevelUp(character.id, pendingAttributes);
        sfx.playVictory();
        
        // Reset for next
        setPendingAttributes({});
        setPointsRemaining(2);
        
        // Find next eligible
        const nextEligible = party.findIndex((p, idx) => idx > characterIndex && p.stats.xp >= p.stats.xpToNextLevel);
        if (nextEligible !== -1) {
            setCharacterIndex(nextEligible);
        } else {
            setGameState(GameState.OVERWORLD);
        }
    };

    const nextLevel = character.stats.level + 1;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-black pointer-events-none" />
            <div className="fixed inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="w-[800px] h-[800px] border border-amber-500/30 rounded-full animate-[spin_60s_linear_infinite]" />
                <div className="w-[600px] h-[600px] border border-amber-500/20 rounded-full absolute animate-[spin_40s_linear_infinite_reverse]" />
            </div>

            <div className="relative max-w-4xl w-full bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row gap-6 md:gap-8 my-auto">
                
                {/* Left: Character Visual */}
                <div className="w-full md:w-1/3 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-8 shrink-0">
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-amber-400 mb-2">Level Up!</h2>
                    <div className="text-5xl md:text-6xl font-bold text-white mb-4 md:mb-6 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                        {nextLevel}
                    </div>
                    
                    <div className="w-32 h-32 md:w-48 md:h-48 bg-slate-950 rounded-full border-4 border-amber-600/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] overflow-hidden mb-4 md:mb-6 relative group shrink-0">
                        <img src={character.visual.spriteUrl} className="w-full h-full object-cover scale-150 translate-y-4 pixelated group-hover:scale-175 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-amber-900/40 to-transparent" />
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg md:text-xl font-bold text-slate-200">{character.name}</h3>
                        <p className="text-xs md:text-sm text-slate-500 uppercase tracking-widest">{character.stats.race} {character.stats.class}</p>
                    </div>
                </div>

                {/* Right: Stats & Choices */}
                <div className="flex-1 flex flex-col">
                    <div className="mb-6 flex-1">
                        <h4 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
                            <span>Attributes</span>
                            <span className={`text-xs md:text-sm ${pointsRemaining > 0 ? "text-white animate-pulse" : "text-slate-600"}`}>
                                Points: {pointsRemaining}
                            </span>
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            {Object.values(Ability).map(attr => {
                                const baseVal = character.stats.baseAttributes[attr];
                                const bonus = pendingAttributes[attr] || 0;
                                const total = baseVal + bonus;
                                const mod = getModifier(total);

                                return (
                                    <div key={attr} className="flex items-center justify-between bg-slate-950/50 p-2 md:p-3 rounded border border-slate-800">
                                        <div>
                                            <span className="text-[10px] md:text-xs font-bold text-slate-500 block">{attr}</span>
                                            <span className="text-base md:text-lg font-mono font-bold text-white">{total}</span>
                                            <span className="text-[10px] md:text-xs text-amber-500 ml-2">({mod >= 0 ? '+' : ''}{mod})</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleAttributeChange(attr, -1)}
                                                disabled={bonus === 0}
                                                className="w-8 h-8 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                                            >-</button>
                                            <div className="w-8 h-8 flex items-center justify-center font-bold text-amber-400 border border-slate-700 rounded bg-slate-900">
                                                {bonus > 0 ? `+${bonus}` : '-'}
                                            </div>
                                            <button 
                                                onClick={() => handleAttributeChange(attr, 1)}
                                                disabled={pointsRemaining === 0}
                                                className="w-8 h-8 rounded bg-slate-800 text-slate-400 hover:bg-amber-900 hover:text-amber-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                                            >+</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-4 md:mt-auto">
                        <button 
                            onClick={handleConfirm}
                            className="w-full py-3 md:py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold uppercase tracking-[0.2em] rounded-lg shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 text-xs md:text-sm"
                        >
                            Confirm Advancement
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
