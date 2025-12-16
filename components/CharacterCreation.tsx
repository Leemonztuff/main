
import React, { useState, useMemo, useEffect } from 'react';
import { CharacterRace, CharacterClass, Attributes, Ability, Difficulty, GameState } from '../types';
import { BASE_STATS, RACE_BONUS, getSprite, CLASS_CONFIG, RACE_ICONS, WESNOTH_BASE_URL, NOISE_TEXTURE_URL, ASSETS } from '../constants';
import { getModifier } from '../services/dndRules';
import { useGameStore } from '../store/gameStore';
import { useContentStore } from '../store/contentStore';
import { AuthModal } from './AuthModal';
import { SaveLoadModal } from './SaveLoadModal';
import { getSupabase } from '../services/supabaseClient';
import { sfx } from '../services/SoundSystem';

interface TitleScreenProps {
  onComplete: (name: string, race: CharacterRace, cls: CharacterClass, stats: Attributes, difficulty: Difficulty) => void;
}

// --- SUB-COMPONENTS ---

const StatBar: React.FC<{ label: string, value: number, bonus: number }> = ({ label, value, bonus }) => {
    const max = 20; // Soft cap for visualization
    const percentage = Math.min(100, (value / max) * 100);
    const bonusPct = Math.min(100, (bonus / max) * 100);
    
    return (
        <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs mb-1 w-full">
            <span className="w-6 md:w-8 font-bold text-slate-400 uppercase shrink-0">{label}</span>
            <div className="flex-1 h-1.5 md:h-2 bg-slate-900 rounded-full overflow-hidden relative border border-slate-700">
                {/* Base Value */}
                <div 
                    className="absolute top-0 left-0 h-full bg-slate-500 transition-all duration-300" 
                    style={{ width: `${percentage - bonusPct}%` }} 
                />
                {/* Bonus Value */}
                <div 
                    className="absolute top-0 h-full bg-emerald-500 transition-all duration-300" 
                    style={{ left: `${percentage - bonusPct}%`, width: `${bonusPct}%` }} 
                />
            </div>
            <span className={`w-5 md:w-6 text-right font-mono font-bold shrink-0 ${bonus > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {value}
            </span>
        </div>
    );
};

export const TitleScreen: React.FC<TitleScreenProps> = ({ onComplete }) => {
  const [view, setView] = useState<'MENU' | 'CREATION'>('MENU');
  
  // Creation State
  const [activeTab, setActiveTab] = useState<'IDENTITY' | 'LINEAGE' | 'VOCATION'>('IDENTITY');
  const [name, setName] = useState('');
  const [race, setRace] = useState<CharacterRace>(CharacterRace.HUMAN);
  const [cls, setCls] = useState<CharacterClass>(CharacterClass.FIGHTER);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  
  // Modals
  const [showAuth, setShowAuth] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  
  const { userSession, logout } = useGameStore();
  const { items, enemies, isLoading } = useContentStore();
  const supabase = getSupabase();

  // Derived Stats
  const currentStats: Attributes = useMemo(() => {
      const base = { ...BASE_STATS[cls] };
      const bonus = RACE_BONUS[race];
      const result = { ...base };
      (Object.keys(base) as Ability[]).forEach(k => {
          if (bonus[k]) result[k] += bonus[k]!;
      });
      return result;
  }, [race, cls]);

  const spriteUrl = useMemo(() => getSprite(race, cls), [race, cls]);

  const handleRandomize = () => {
      const races = Object.values(CharacterRace);
      const classes = Object.values(CharacterClass);
      
      const r = races[Math.floor(Math.random() * races.length)];
      const c = classes[Math.floor(Math.random() * classes.length)];
      
      setRace(r);
      setCls(c);
      sfx.playMagic();
  };

  const handleStartGame = () => {
      const finalName = name.trim() || `${race} ${cls}`;
      onComplete(finalName, race, cls, currentStats, difficulty);
  };

  // --- RENDER MAIN MENU (TITLE) ---
  if (view === 'MENU') {
      return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center font-sans overflow-hidden" role="main" aria-label="Title Screen">
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
            {showLoad && <SaveLoadModal mode="load" onClose={() => setShowLoad(false)} />}
            
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black" />
                <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `url("${NOISE_TEXTURE_URL}")` }} />
            </div>

            {/* Title Block */}
            <div className="z-10 text-center mb-16 animate-in fade-in slide-in-from-top-10 duration-1000 flex flex-col items-center relative">
                
                {/* Crystal */}
                <div className="relative w-24 h-24 md:w-40 md:h-40 mb-4 z-20 group cursor-pointer" onClick={() => sfx.playMagic()}>
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                    <img 
                        src={`${WESNOTH_BASE_URL}/items/gem-large-blue.png`} 
                        alt="" 
                        className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-[float-damage_6s_ease-in-out_infinite]" 
                        style={{ animationDirection: 'alternate' }}
                    />
                </div>

                {/* Text */}
                <div className="flex flex-col items-center leading-[0.85] z-10 scale-90 md:scale-100">
                    <h1 className="text-6xl md:text-8xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 drop-shadow-[0_4px_0_rgba(0,0,0,1)] tracking-wide filter" style={{ textShadow: '0 4px 0 #78350f, 0 10px 20px rgba(0,0,0,0.5)' }}>
                        EPIC
                    </h1>
                    <h1 className="text-6xl md:text-8xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 drop-shadow-[0_4px_0_rgba(0,0,0,1)] tracking-wide filter mt-[-5px] md:mt-[-10px]" style={{ textShadow: '0 4px 0 #78350f, 0 10px 20px rgba(0,0,0,0.5)' }}>
                        EARTH
                    </h1>
                </div>

                <div className="relative mt-6 group cursor-default scale-90 md:scale-100">
                    <div className="relative bg-gradient-to-b from-red-600 to-red-800 px-8 py-2 shadow-[0_5px_15px_rgba(0,0,0,0.5)] border-t border-red-500 border-b-2 border-red-950 transform hover:scale-105 transition-transform duration-300 rounded-sm">
                        <h2 className="text-sm md:text-base font-serif font-bold text-white tracking-[0.25em] drop-shadow-md whitespace-nowrap">
                            SHARDS OF ETERNUM
                        </h2>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="z-10 flex flex-col gap-3 w-full max-w-xs animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300 px-4">
                <button 
                    onClick={() => { sfx.playUiClick(); setView('CREATION'); }}
                    className="group relative bg-slate-900/80 border border-amber-600/30 hover:border-amber-500 text-amber-100 py-3 md:py-4 px-8 rounded-lg transition-all transform hover:scale-105 overflow-hidden shadow-lg focus:ring-2 focus:ring-amber-500 outline-none"
                >
                    <div className="absolute inset-0 bg-amber-500/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                    <span className="relative font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-3">
                        <span aria-hidden="true">⚔️</span> New Game
                    </span>
                </button>

                <button 
                    onClick={() => { sfx.playUiClick(); setShowLoad(true); }}
                    className="group relative bg-slate-900/80 border border-slate-700 hover:border-blue-500 text-blue-100 py-3 md:py-4 px-8 rounded-lg transition-all transform hover:scale-105 overflow-hidden shadow-lg"
                >
                    <span className="relative font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-3">
                        <span aria-hidden="true">↺</span> Load Game
                    </span>
                </button>

                {supabase && (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { sfx.playUiClick(); setShowAuth(true); }}
                            className={`flex-1 group relative bg-slate-900/80 border py-3 md:py-4 px-2 rounded-lg transition-all transform hover:scale-105 overflow-hidden shadow-lg ${userSession ? 'border-green-500/50 text-green-400' : 'border-slate-700 hover:border-purple-500 text-purple-200'}`}
                        >
                            <span className="relative font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center gap-2">
                                <span aria-hidden="true">{userSession ? '👤' : '☁️'}</span> {userSession ? 'Account Active' : 'Cloud Login'}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            <div className="absolute bottom-4 flex w-full justify-between px-6 text-[10px] text-slate-600 font-mono z-10 opacity-60">
                <span>v2.3.0</span>
                <span className={`flex items-center gap-2 ${isLoading ? 'animate-pulse' : ''}`}>
                    <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : (Object.keys(items).length > 20 ? 'bg-green-500' : 'bg-slate-500')}`}></span>
                    {isLoading ? 'Syncing...' : `Online`}
                </span>
            </div>
        </div>
      );
  }

  // --- CHARACTER CREATION STUDIO (SPLIT SCREEN / STACKED) ---
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 font-sans overflow-hidden flex flex-col md:flex-row">
        
        {/* === LEFT/TOP COLUMN: THE HERO PEDESTAL === */}
        <div className="relative w-full h-[35vh] md:h-auto md:w-5/12 lg:w-1/3 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shadow-2xl shrink-0 z-10">
            {/* Background Vibe */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-black z-0" />
            <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{ backgroundImage: `url("${NOISE_TEXTURE_URL}")` }} />
            
            {/* Top Bar */}
            <div className="relative z-10 p-3 md:p-4 flex justify-between items-center bg-black/20 shrink-0">
                <button onClick={() => setView('MENU')} className="text-slate-400 hover:text-white uppercase text-[10px] md:text-xs font-bold tracking-wider flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10">
                    <span aria-hidden="true">←</span> Exit
                </button>
                <div className="text-[10px] md:text-xs text-slate-500 font-mono">Creation Studio</div>
            </div>

            {/* The Sprite Showcase */}
            <div className="flex-1 relative flex flex-col items-center justify-center z-10 p-2 md:p-4 min-h-0">
                <div className="relative group flex flex-col items-center justify-center">
                    {/* Glow effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 bg-amber-500/20 blur-3xl rounded-full animate-pulse" />
                    
                    {/* Sprite - Pixelated */}
                    <img 
                        src={spriteUrl} 
                        alt="Hero Preview" 
                        className="w-24 h-24 md:w-64 md:h-64 object-contain scale-[1.5] md:scale-[1.8] filter drop-shadow-2xl transition-all duration-300"
                        style={{ imageRendering: 'pixelated' }}
                    />
                </div>

                {/* Hero Name Plate */}
                <div className="mt-4 md:mt-8 text-center shrink-0">
                    <h2 className="text-2xl md:text-4xl font-serif font-black text-white tracking-wide drop-shadow-md truncate max-w-[250px] md:max-w-xs mx-auto">
                        {name || <span className="text-slate-600 italic">Nameless Hero</span>}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="bg-amber-900/30 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Level 1</span>
                        <span className="text-slate-400 uppercase tracking-[0.1em] text-[10px] md:text-xs font-bold">
                            {race} {cls}
                        </span>
                    </div>
                </div>
            </div>

            {/* Live Stats Panel (Compact on Mobile) */}
            <div className="relative z-10 p-3 md:p-6 bg-slate-950/80 border-t border-slate-800 backdrop-blur-sm shrink-0">
                <div className="flex justify-between items-center mb-2 md:mb-4">
                    <h3 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Base Attributes</h3>
                    <button onClick={handleRandomize} className="text-amber-500 hover:text-white transition-colors p-1 md:p-0" title="Randomize">🎲</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
                    {Object.values(Ability).map(attr => (
                        <StatBar 
                            key={attr} 
                            label={attr} 
                            value={currentStats[attr]} 
                            bonus={RACE_BONUS[race][attr] || 0} 
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* === RIGHT/BOTTOM COLUMN: CONFIGURATION === */}
        <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden h-[65vh] md:h-auto">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/50 shrink-0">
                {(['IDENTITY', 'LINEAGE', 'VOCATION'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { sfx.playUiClick(); setActiveTab(tab); }}
                        className={`flex-1 py-3 md:py-4 text-[10px] md:text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-amber-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'}`}
                    >
                        {tab === 'LINEAGE' ? 'RACE' : (tab === 'VOCATION' ? 'CLASS' : tab)}
                        {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 shadow-[0_0_10px_#f59e0b]" />}
                    </button>
                ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-10 pb-24 md:pb-10">
                <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300" key={activeTab}>
                    
                    {/* TAB 1: IDENTITY */}
                    {activeTab === 'IDENTITY' && (
                        <div className="space-y-6 md:space-y-8">
                            <div>
                                <label className="block text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Character Name</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter hero name..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 md:py-4 text-lg md:text-xl text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-amber-500 text-xs font-bold uppercase tracking-widest mb-3">Difficulty Setting</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                    {Object.values(Difficulty).map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDifficulty(d)}
                                            className={`p-3 md:p-4 rounded-lg border-2 text-left transition-all ${difficulty === d ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className={`font-serif font-bold text-base md:text-lg mb-1 ${difficulty === d ? 'text-white' : 'text-slate-400'}`}>{d}</div>
                                            <div className="text-[10px] md:text-xs text-slate-500 leading-tight">
                                                {d === 'EASY' && 'Enemies are weaker. More XP.'}
                                                {d === 'NORMAL' && 'Standard challenge.'}
                                                {d === 'HARD' && 'Enemies are ruthless. Less XP.'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: LINEAGE (RACE) */}
                    {activeTab === 'LINEAGE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.values(CharacterRace).map(r => (
                                <button
                                    key={r}
                                    onClick={() => { setRace(r); sfx.playUiClick(); }}
                                    className={`
                                        flex items-center gap-4 p-3 rounded-lg border transition-all text-left group relative overflow-hidden
                                        ${race === r ? 'bg-slate-800 border-amber-500 shadow-md ring-1 ring-amber-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-600'}
                                    `}
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded bg-black/40 flex items-center justify-center border border-white/5 shrink-0 ${race === r ? 'bg-amber-900/20 border-amber-500/30' : ''}`}>
                                        <img src={RACE_ICONS[r]} className="w-6 h-6 md:w-8 md:h-8 object-contain filter invert opacity-80 group-hover:opacity-100" />
                                    </div>
                                    <div>
                                        <div className={`font-serif font-bold text-sm md:text-base ${race === r ? 'text-white' : 'text-slate-300'}`}>{r}</div>
                                        <div className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                            {Object.keys(RACE_BONUS[r]).map(k => `${k}+${RACE_BONUS[r][k as keyof Attributes]}`).join(', ')}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* TAB 3: VOCATION (CLASS) */}
                    {activeTab === 'VOCATION' && (
                        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
                            {Object.values(CharacterClass).map(c => {
                                const conf = CLASS_CONFIG[c];
                                return (
                                    <button
                                        key={c}
                                        onClick={() => { setCls(c); sfx.playUiClick(); }}
                                        className={`
                                            relative p-3 md:p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 md:gap-3 group overflow-hidden
                                            ${cls === c ? 'bg-slate-800 border-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'}
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`font-serif font-bold text-sm md:text-lg ${cls === c ? 'text-white' : 'text-slate-300'}`}>{c}</span>
                                            <div className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-black/30 border border-white/5`}>
                                                <img src={conf.icon} className="w-4 h-4 md:w-5 md:h-5 object-contain" />
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <span className="px-1.5 md:px-2 py-0.5 rounded bg-black/40 text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-wider border border-white/5">
                                                {conf.archetype}
                                            </span>
                                        </div>

                                        {/* Hover Highlight Line */}
                                        <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-${cls === c ? 'amber-500' : 'slate-600'} to-transparent transition-all duration-300 w-full opacity-50 group-hover:opacity-100`} />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                </div>
            </div>

            {/* Footer Action - Fixed at bottom on mobile */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur flex justify-between items-center z-20">
                <div className="text-xs text-slate-500 hidden md:block">
                    Ready to embark on your journey?
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    {activeTab !== 'IDENTITY' && (
                        <button onClick={() => setActiveTab(prev => prev === 'VOCATION' ? 'LINEAGE' : 'IDENTITY')} className="px-4 md:px-6 py-3 rounded border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-800 font-bold uppercase text-[10px] md:text-xs tracking-widest transition-colors shrink-0">
                            Back
                        </button>
                    )}
                    
                    {activeTab === 'VOCATION' ? (
                        <button 
                            onClick={handleStartGame}
                            className="flex-1 md:flex-none px-6 md:px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-[0.2em] rounded shadow-lg shadow-amber-900/20 transition-all transform hover:-translate-y-1 active:scale-95 text-xs md:text-sm"
                        >
                            Start Adventure
                        </button>
                    ) : (
                        <button 
                            onClick={() => setActiveTab(prev => prev === 'IDENTITY' ? 'LINEAGE' : 'VOCATION')}
                            className="flex-1 md:flex-none px-6 md:px-8 py-3 bg-slate-100 hover:bg-white text-slate-900 font-bold uppercase tracking-widest rounded shadow transition-colors ml-auto text-xs md:text-sm"
                        >
                            Next Step →
                        </button>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};
