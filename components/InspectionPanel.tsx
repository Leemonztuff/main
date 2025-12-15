
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { DAMAGE_ICONS } from '../constants';

export const InspectionPanel = () => {
    const { inspectedEntityId, battleEntities, closeInspection } = useGameStore();
    
    if (!inspectedEntityId) return null;
    
    const entity = battleEntities.find(e => e.id === inspectedEntityId);
    if (!entity) return null;

    const stats = entity.stats;
    const isEnemy = entity.type === 'ENEMY';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeInspection}>
            <div className="bg-slate-900 border-2 border-amber-600/50 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 border-b border-amber-600/30 flex gap-6 items-center relative">
                    <button onClick={closeInspection} className="absolute top-2 right-2 text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800">✕</button>
                    
                    <div className="w-20 h-20 bg-black/50 rounded-lg border border-slate-600 flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
                        <img src={entity.visual.spriteUrl} className="w-16 h-16 object-contain pixelated relative z-10" />
                        <div className={`absolute inset-0 opacity-20 ${isEnemy ? 'bg-red-600' : 'bg-blue-600'}`} />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-amber-100">{entity.name}</h2>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[10px] uppercase tracking-widest font-bold bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-700">
                                {stats.creatureType || 'Unknown'}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest font-bold bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-700">
                                Lvl {stats.level}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 bg-slate-900/95 space-y-6">
                    
                    {/* Vitals */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 p-3 rounded border border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Health</span>
                            <span className="text-lg font-mono font-bold text-green-400">{stats.hp} <span className="text-slate-600 text-sm">/ {stats.maxHp}</span></span>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded border border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Armor Class</span>
                            <span className="text-lg font-mono font-bold text-blue-400">🛡️ {stats.ac}</span>
                        </div>
                    </div>

                    {/* Affinities */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-serif font-bold text-amber-500 border-b border-amber-900/30 pb-1">Combat Affinities</h3>
                        
                        <div className="space-y-2">
                            {/* Vulnerabilities */}
                            {stats.vulnerabilities && stats.vulnerabilities.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-red-400 uppercase w-20 shrink-0">Weak To</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {stats.vulnerabilities.map(type => (
                                            <div key={type} className="flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-500/30" title={type}>
                                                <img src={DAMAGE_ICONS[type]} className="w-4 h-4 filter invert" />
                                                <span className="text-[10px] text-red-200 font-bold">{type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Resistances */}
                            {stats.resistances && stats.resistances.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-orange-400 uppercase w-20 shrink-0">Resistant</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {stats.resistances.map(type => (
                                            <div key={type} className="flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded border border-orange-500/30" title={type}>
                                                <img src={DAMAGE_ICONS[type]} className="w-4 h-4 filter invert" />
                                                <span className="text-[10px] text-orange-200 font-bold">{type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Immunities */}
                            {stats.immunities && stats.immunities.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0">Immune</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {stats.immunities.map(type => (
                                            <div key={type} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-slate-600" title={type}>
                                                <img src={DAMAGE_ICONS[type]} className="w-4 h-4 opacity-50 filter invert" />
                                                <span className="text-[10px] text-slate-400 font-bold decoration-line-through">{type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(!stats.vulnerabilities?.length && !stats.resistances?.length && !stats.immunities?.length) && (
                                <p className="text-xs text-slate-600 italic py-2">No special affinities known.</p>
                            )}
                        </div>
                    </div>

                    {/* Status Effects */}
                    {stats.statusEffects && Object.keys(stats.statusEffects).length > 0 && (
                        <div>
                            <h3 className="text-sm font-serif font-bold text-purple-400 border-b border-purple-900/30 pb-1 mb-2">Conditions</h3>
                            <div className="flex gap-2 flex-wrap">
                                {Object.entries(stats.statusEffects).map(([effect, duration]) => (
                                    <div key={effect} className="bg-purple-900/40 border border-purple-500/40 px-2 py-1 rounded text-xs text-purple-200 font-bold">
                                        {effect} ({duration} turns)
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
                
                <div className="bg-slate-950 p-3 text-center">
                    <p className="text-[10px] text-slate-600"> tactical analysis complete </p>
                </div>
            </div>
        </div>
    );
};
