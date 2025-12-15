
import React, { useState, useMemo } from 'react';
import { CharacterRace, CharacterClass, Attributes, Ability, Difficulty, GameState } from '../types';
import { BASE_STATS, RACE_BONUS, getSprite, CLASS_CONFIG, RACE_ICONS, WESNOTH_BASE_URL, NOISE_TEXTURE_URL } from '../constants';
import { getModifier } from '../services/dndRules';
import { useGameStore } from '../store/gameStore';
import { AuthModal } from './AuthModal';
import { SaveLoadModal } from './SaveLoadModal';
import { getSupabase } from '../services/supabaseClient';

interface TitleScreenProps {
  onComplete: (name: string, race: CharacterRace, cls: CharacterClass, stats: Attributes, difficulty: Difficulty) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onComplete }) => {
  const [view, setView] = useState<'MENU' | 'CREATION'>('MENU');
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [race, setRace] = useState<CharacterRace>(CharacterRace.HUMAN);
  const [cls, setCls] = useState<CharacterClass>(CharacterClass.FIGHTER);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [showAuth, setShowAuth] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  
  const { userSession, logout } = useGameStore();
  const supabase = getSupabase();

  // Stats Logic
  const currentStats: Attributes = useMemo(() => {
      const base = { ...BASE_STATS[cls] };
      const bonus = RACE_BONUS[race];
      (Object.keys(base) as Ability[]).forEach(k => {
          if (bonus[k]) base[k] += bonus[k]!;
      });
      return base;
  }, [race, cls]);

  const spriteUrl = useMemo(() => getSprite(race, cls), [race, cls]);

  const handleNext = () => {
    if (step === 3) {
        onComplete(name, race, cls, currentStats, difficulty);
    } else {
        setStep(step + 1);
    }
  };

  // --- RENDER MAIN MENU ---
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

            {/* Title Block - Replicating the provided Logo */}
            <div className="z-10 text-center mb-16 animate-in fade-in slide-in-from-top-10 duration-1000 flex flex-col items-center relative">
                
                {/* Decorative Runes */}
                <div className="absolute top-10 left-[-40px] text-amber-500/30 font-serif text-4xl animate-pulse hidden md:block" aria-hidden="true">ᚷ</div>
                <div className="absolute top-20 right-[-40px] text-amber-500/30 font-serif text-4xl animate-pulse delay-700 hidden md:block" aria-hidden="true">ᛟ</div>

                {/* Floating Crystal Icon */}
                <div className="relative w-28 h-28 md:w-40 md:h-40 mb-2 z-20">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                    <img 
                        src={`${WESNOTH_BASE_URL}/items/gem-large-blue.png`} 
                        alt="" 
                        className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-[float-damage_6s_ease-in-out_infinite]" 
                        style={{ animationDirection: 'alternate' }}
                    />
                </div>

                {/* Stacked Gold Text */}
                <div className="flex flex-col items-center leading-[0.85] z-10">
                    <h1 className="text-6xl md:text-8xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 drop-shadow-[0_4px_0_rgba(0,0,0,1)] tracking-wide filter" style={{ textShadow: '0 4px 0 #78350f, 0 10px 20px rgba(0,0,0,0.5)' }}>
                        EPIC
                    </h1>
                    <h1 className="text-6xl md:text-8xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 drop-shadow-[0_4px_0_rgba(0,0,0,1)] tracking-wide filter mt-[-5px] md:mt-[-10px]" style={{ textShadow: '0 4px 0 #78350f, 0 10px 20px rgba(0,0,0,0.5)' }}>
                        EARTH
                    </h1>
                </div>

                {/* Red Banner Subtitle */}
                <div className="relative mt-6 group cursor-default">
                    {/* Ribbon Ends */}
                    <div className="absolute top-1 -left-3 w-8 h-10 bg-red-900 transform skew-y-6 rounded-sm shadow-xl" />
                    <div className="absolute top-1 -right-3 w-8 h-10 bg-red-900 transform -skew-y-6 rounded-sm shadow-xl" />
                    
                    {/* Main Ribbon Body */}
                    <div className="relative bg-gradient-to-b from-red-600 to-red-800 px-8 py-2 shadow-[0_5px_15px_rgba(0,0,0,0.5)] border-t border-red-500 border-b-2 border-red-950 transform hover:scale-105 transition-transform duration-300 rounded-sm">
                        <h2 className="text-sm md:text-base font-serif font-bold text-white tracking-[0.25em] drop-shadow-md whitespace-nowrap">
                            SHARDS OF ETERNUM
                        </h2>
                    </div>
                </div>
            </div>

            {/* Menu Actions */}
            <div className="z-10 flex flex-col gap-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                <button 
                    onClick={() => setView('CREATION')}
                    className="group relative bg-slate-900/80 border border-amber-600/30 hover:border-amber-500 text-amber-100 py-4 px-8 rounded-lg transition-all transform hover:scale-105 overflow-hidden shadow-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    aria-label="New Game"
                >
                    <div className="absolute inset-0 bg-amber-500/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                    <span className="relative font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                        <span aria-hidden="true">⚔️</span> New Game
                    </span>
                </button>

                <button 
                    onClick={() => setShowLoad(true)}
                    className="group relative bg-slate-900/80 border border-slate-700 hover:border-blue-500 text-blue-100 py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 overflow-hidden shadow-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    aria-label="Load Game"
                >
                    <div className="absolute inset-0 bg-blue-500/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                    <span className="relative font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                        <span aria-hidden="true">↺</span> Load Game
                    </span>
                </button>

                {supabase && (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowAuth(true)}
                            className={`flex-1 group relative bg-slate-900/80 border py-4 px-2 rounded-lg transition-all transform hover:scale-105 overflow-hidden shadow-lg focus:ring-2 focus:ring-purple-500 outline-none ${userSession ? 'border-green-500/50 text-green-400' : 'border-slate-700 hover:border-purple-500 text-purple-200'}`}
                            aria-label={userSession ? "Account Status: Active" : "Cloud Login"}
                        >
                            <span className="relative font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center gap-2">
                                <span aria-hidden="true">{userSession ? '👤' : '☁️'}</span> {userSession ? 'Account Active' : 'Cloud Login'}
                            </span>
                        </button>
                        {userSession && (
                            <button
                                onClick={logout}
                                className="bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-red-400 rounded-lg px-4 flex items-center justify-center focus:ring-2 focus:ring-red-500 outline-none"
                                title="Logout"
                                aria-label="Logout"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 text-[10px] text-slate-600 font-mono z-10 opacity-60">
                v2.1.0 • Developed with React & Three.js
            </div>
        </div>
      );
  }

  // --- RENDER CREATION WIZARD (Step 1-3) ---
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 font-sans overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-label="Character Creation">
        {/* Header Navigation */}
        <div className="bg-slate-900/80 border-b border-slate-800 p-3 md:p-4 flex justify-between items-center z-20 backdrop-blur-sm shrink-0">
            <button onClick={() => setView('MENU')} className="text-slate-400 hover:text-white uppercase text-xs font-bold tracking-wider flex items-center gap-2 focus:ring-2 focus:ring-slate-500 rounded outline-none px-2 py-1">
                <span aria-hidden="true">←</span> <span className="hidden sm:inline">Back to</span> Title
            </button>
            <div className="flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label="Creation Step">
                {[1,2,3].map(i => (
                    <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-amber-500 scale-125' : 'bg-slate-700'}`} />
                ))}
            </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-10 flex items-center justify-center">
            <div className="max-w-5xl w-full">
                {/* Step 1: Identity */}
                {step === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="space-y-6 md:space-y-8">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-serif text-amber-100 mb-2">Who are you?</h3>
                                <p className="text-slate-400 text-sm mb-6">Enter your name and choose the difficulty of your journey.</p>
                                <label htmlFor="heroName" className="sr-only">Hero Name</label>
                                <input 
                                    id="heroName"
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-900 border-b-2 border-slate-700 focus:border-amber-500 px-4 py-2 md:py-3 text-lg md:text-xl text-white outline-none transition-colors placeholder-slate-600 focus:ring-2 focus:ring-amber-500 rounded-t"
                                    placeholder="Hero Name..."
                                    autoFocus
                                />
                            </div>
                            
                            <div role="radiogroup" aria-label="Difficulty Selection">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Difficulty</span>
                                <div className="grid grid-cols-3 gap-2 md:gap-3">
                                    {Object.values(Difficulty).map(d => (
                                        <button
                                            key={d}
                                            role="radio"
                                            aria-checked={difficulty === d}
                                            onClick={() => setDifficulty(d)}
                                            className={`py-2 md:py-3 px-2 rounded border text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all focus:ring-2 focus:ring-amber-500 outline-none ${difficulty === d ? 'bg-amber-700 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                            <h3 className="text-xl font-serif text-amber-100">Lineage</h3>
                            <div className="grid grid-cols-2 gap-3 h-60 md:h-80 overflow-y-auto custom-scrollbar pr-2" role="radiogroup" aria-label="Race Selection">
                                {Object.values(CharacterRace).map(r => (
                                    <button
                                        key={r}
                                        role="radio"
                                        aria-checked={race === r}
                                        onClick={() => setRace(r)}
                                        className={`p-2 md:p-3 rounded border text-left flex items-center gap-3 transition-all focus:ring-2 focus:ring-amber-500 outline-none ${race === r ? 'bg-slate-800 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}`}
                                    >
                                        <div className={`w-8 h-8 md:w-8 md:h-8 flex items-center justify-center rounded overflow-hidden p-1 ${race === r ? 'bg-amber-900/20' : 'bg-slate-950'}`}>
                                            <img 
                                                src={RACE_ICONS[r]} 
                                                alt="" 
                                                className="w-full h-full object-contain filter invert" 
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`text-sm font-bold truncate ${race === r ? 'text-white' : 'text-slate-400'}`}>{r}</div>
                                            <div className="text-[9px] md:text-[10px] text-slate-500 uppercase font-bold mt-0.5 truncate">
                                                {Object.keys(RACE_BONUS[r]).join(', ')} +
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Class */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <h3 className="text-2xl md:text-3xl font-serif text-amber-100 text-center mb-6 md:mb-8">Choose Your Path</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4" role="radiogroup" aria-label="Class Selection">
                            {Object.values(CharacterClass).map(c => (
                                <button
                                    key={c}
                                    role="radio"
                                    aria-checked={cls === c}
                                    onClick={() => setCls(c)}
                                    className={`relative p-4 md:p-6 border rounded-xl flex flex-col items-center justify-center gap-3 transition-all h-32 md:h-40 group focus:ring-2 focus:ring-amber-500 outline-none ${cls === c ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500/50' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 transition-transform duration-300 ${cls === c ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`}>
                                        <img 
                                            src={CLASS_CONFIG[c].icon} 
                                            alt="" 
                                            className="w-full h-full object-contain"
                                            onError={(e) => { 
                                                console.warn(`Failed to load class icon: ${CLASS_CONFIG[c].icon}`);
                                                e.currentTarget.onerror = null; 
                                                e.currentTarget.src = getSprite(CharacterRace.HUMAN, c); 
                                            }}
                                        />
                                    </div>
                                    <span className={`text-[10px] md:text-sm font-bold uppercase tracking-wider text-center ${cls === c ? 'text-amber-100' : 'text-slate-400'}`}>{c}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && (
                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-800 rounded-full border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] overflow-hidden mb-4 md:mb-6 flex items-center justify-center">
                            <img src={spriteUrl} className="w-full h-full object-cover scale-150 translate-y-2 pixelated" alt="Character Preview" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-serif font-bold text-amber-100 mb-1 md:mb-2 text-center">{name || 'Nameless Hero'}</h2>
                        <p className="text-slate-400 uppercase tracking-widest text-xs md:text-sm mb-6 md:mb-8">{race} {cls}</p>

                        <div className="bg-slate-900 p-4 md:p-6 rounded-xl border border-slate-700 grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-6 mb-8 w-full" role="list" aria-label="Starting Attributes">
                            {Object.entries(currentStats).map(([key, val]) => (
                                <div key={key} className="flex flex-col items-center gap-1" role="listitem">
                                    <div className="text-lg md:text-2xl font-bold text-white font-mono">{val}</div>
                                    <div className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">{key}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900/80 border-t border-slate-800 p-4 md:p-6 flex justify-center z-20 backdrop-blur-sm shrink-0">
            <button 
                onClick={handleNext}
                disabled={!name && step === 1}
                className="bg-amber-600 hover:bg-amber-500 text-white px-8 md:px-12 py-3 rounded-lg font-bold shadow-lg shadow-amber-900/20 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none focus:ring-2 focus:ring-white outline-none text-sm md:text-base uppercase tracking-wider"
                aria-label={step === 3 ? 'Start Game' : 'Next Step'}
            >
                {step === 3 ? 'ENTER WORLD' : 'CONTINUE →'}
            </button>
        </div>
    </div>
  );
};
