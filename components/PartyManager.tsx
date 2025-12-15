
import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState, Entity } from '../types';
import { sfx } from '../services/SoundSystem';
import { CLASS_CONFIG, NOISE_TEXTURE_URL, getSprite } from '../constants';

interface CharacterCardProps {
    entity: Entity;
    onClick: () => void;
    isSelected: boolean;
    isLeader?: boolean;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ entity, onClick, isSelected, isLeader }) => {
    const classInfo = CLASS_CONFIG[entity.stats.class];
    
    return (
        <button 
            onClick={onClick}
            disabled={isLeader}
            className={`
                relative w-full text-left p-2 md:p-3 rounded-xl border-2 transition-all group flex items-center gap-3 md:gap-4
                ${isLeader ? 'bg-amber-900/20 border-amber-600/50 cursor-default' : 
                  isSelected ? 'bg-purple-900/40 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 
                  'bg-slate-900/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                }
            `}
        >
            {/* Avatar */}
            <div className={`
                w-12 h-12 md:w-16 md:h-16 rounded-lg bg-black/50 overflow-hidden border shrink-0 flex items-center justify-center
                ${isSelected ? 'border-purple-400' : 'border-slate-600'}
            `}>
                <img src={entity.visual.spriteUrl} className="w-10 h-10 md:w-12 md:h-12 object-contain pixelated" alt={entity.name} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h3 className={`font-serif font-bold truncate text-sm md:text-base ${isSelected ? 'text-purple-200' : 'text-slate-200'}`}>
                        {entity.name}
                        {isLeader && <span className="ml-2 text-[9px] md:text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Leader</span>}
                    </h3>
                    <div className="text-lg md:text-xl opacity-50 group-hover:opacity-100 transition-all">
                        <img 
                            src={classInfo.icon} 
                            className="w-5 h-5 md:w-6 md:h-6" 
                            alt={entity.stats.class} 
                            onError={(e) => { 
                                e.currentTarget.onerror = null; 
                                e.currentTarget.src = getSprite(entity.stats.race!, entity.stats.class); 
                            }}
                        />
                    </div>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] md:text-xs text-slate-400 font-bold bg-black/30 px-2 py-0.5 rounded border border-white/5">
                        Lvl {entity.stats.level} {entity.stats.class}
                    </span>
                    <span className="text-[10px] md:text-xs text-slate-500 hidden sm:inline">
                        {entity.stats.race}
                    </span>
                </div>

                <div className="mt-1 md:mt-2 h-1 md:h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
                    <div className="h-full bg-green-500" style={{ width: `${(entity.stats.hp / entity.stats.maxHp) * 100}%` }} />
                </div>
            </div>
        </button>
    );
};

export const PartyManager: React.FC = () => {
    const { party, characterPool, setGameState, swapPartyMember, addToParty, removeFromParty } = useGameStore();
    const [selectedPartyIndex, setSelectedPartyIndex] = useState<number | null>(null);
    const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(null);

    const handleBack = () => {
        sfx.playUiClick();
        setGameState(GameState.TEMPLE_HUB);
    };

    const handleAction = () => {
        if (selectedPoolIndex !== null && selectedPartyIndex !== null) {
            // Swap
            swapPartyMember(selectedPartyIndex, selectedPoolIndex);
            setSelectedPartyIndex(null);
            setSelectedPoolIndex(null);
        } else if (selectedPoolIndex !== null && party.length < 4) {
            // Add to Party
            addToParty(selectedPoolIndex);
            setSelectedPoolIndex(null);
        } else if (selectedPartyIndex !== null && party.length > 1) { // Cant remove if only 1 (leader)
            // Remove to Pool
            removeFromParty(selectedPartyIndex);
            setSelectedPartyIndex(null);
        }
    };

    const actionLabel = () => {
        if (selectedPoolIndex !== null && selectedPartyIndex !== null) return "Swap Heroes";
        if (selectedPoolIndex !== null) return "Add to Party";
        if (selectedPartyIndex !== null) return "Send to Reserve";
        return "Select Heroes";
    };

    const canPerformAction = (selectedPoolIndex !== null && selectedPartyIndex !== null) || 
                             (selectedPoolIndex !== null && party.length < 4) ||
                             (selectedPartyIndex !== null && party.length > 1);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-amber-600/30 p-3 md:p-4 flex justify-between items-center shadow-lg z-10">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="text-slate-400 hover:text-white flex items-center gap-2 font-bold uppercase text-xs tracking-widest px-3 py-2 rounded hover:bg-slate-800 transition-colors">
                        ← Temple
                    </button>
                    <h1 className="text-xl font-serif font-bold text-amber-100 hidden md:block">Party Management</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-500 font-mono hidden sm:block">
                        Active: <span className="text-white font-bold">{party.length}/4</span>
                    </div>
                    <button 
                        onClick={handleAction}
                        disabled={!canPerformAction}
                        className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold px-4 py-2 md:px-6 rounded shadow-lg transition-all transform active:scale-95 text-xs md:text-sm uppercase tracking-wide"
                    >
                        {actionLabel()}
                    </button>
                </div>
            </div>

            {/* Main Area - Vertical Scroll on Mobile, Horizontal Split on Desktop */}
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("${NOISE_TEXTURE_URL}")` }} />

                {/* Left: Active Party */}
                <div className="flex flex-col p-4 md:p-6 bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-800 shrink-0 md:flex-1 md:h-full z-10">
                    <h2 className="text-amber-500 font-bold uppercase tracking-widest text-xs md:text-sm mb-4 flex items-center gap-2">
                        <span>🛡️</span> Active Party
                    </h2>
                    <div className="space-y-3 pr-2 md:overflow-y-auto custom-scrollbar md:flex-1">
                        {party.map((p, i) => (
                            <CharacterCard 
                                key={p.id} 
                                entity={p} 
                                isSelected={selectedPartyIndex === i}
                                onClick={() => {
                                    if (i === 0) return; // Leader cannot be selected/swapped via simple click
                                    setSelectedPartyIndex(selectedPartyIndex === i ? null : i);
                                }}
                                isLeader={i === 0}
                            />
                        ))}
                        {Array.from({ length: 4 - party.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-2 border-dashed border-slate-800 rounded-xl p-4 md:p-6 flex items-center justify-center text-slate-700 text-xs md:text-sm font-bold uppercase tracking-widest">
                                Empty Slot
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Reserve Pool */}
                <div className="flex flex-col p-4 md:p-6 bg-black/20 shrink-0 md:flex-1 md:h-full z-10">
                    <h2 className="text-purple-400 font-bold uppercase tracking-widest text-xs md:text-sm mb-4 flex items-center gap-2">
                        <span>🌀</span> Reserve Pool
                    </h2>
                    
                    {characterPool.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800/50 rounded-xl py-8 md:py-0 md:flex-1">
                            <span className="text-4xl mb-2 opacity-50">🕸️</span>
                            <p className="text-sm">No heroes in reserve.</p>
                            <p className="text-xs mt-2">Perform rituals to summon more.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 content-start md:overflow-y-auto custom-scrollbar md:flex-1">
                            {characterPool.map((p, i) => (
                                <CharacterCard 
                                    key={p.id} 
                                    entity={p} 
                                    isSelected={selectedPoolIndex === i}
                                    onClick={() => setSelectedPoolIndex(selectedPoolIndex === i ? null : i)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
