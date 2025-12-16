
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { SaveMetadata, CharacterClass, CharacterRace } from '../types';
import { CLASS_CONFIG, getSprite } from '../constants';

interface SaveLoadModalProps {
    mode: 'save' | 'load';
    onClose: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ mode, onClose }) => {
    const { getSaveSlots, saveGame, loadGame, userSession } = useGameStore();
    const [slots, setSlots] = useState<(SaveMetadata | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            setLoading(true);
            const data = await getSaveSlots();
            // Fill array to ensure 3 slots
            const filled = [0, 1, 2].map(i => data.find(s => s.slotIndex === i) || null);
            setSlots(filled);
            setLoading(false);
        };
        fetchSlots();
    }, []);

    const handleSlotClick = async (slotIndex: number) => {
        if (mode === 'save') {
            if (slots[slotIndex] && !confirm(`Overwrite Slot ${slotIndex + 1}?`)) return;
            await saveGame(slotIndex);
            onClose();
        } else {
            if (!slots[slotIndex]) return;
            await loadGame(slotIndex);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-amber-100 uppercase tracking-widest">
                            {mode === 'save' ? 'Save Game' : 'Load Game'}
                        </h2>
                        <div className="text-xs mt-1 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${userSession ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-500'}`} />
                            {userSession ? (
                                <span className="text-green-400 font-bold">Cloud Sync Active</span>
                            ) : (
                                <span className="text-slate-500">Local Storage (Login to sync)</span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-white transition-colors">✕</button>
                </div>

                {/* Slots Grid */}
                <div className="p-8 grid grid-cols-1 gap-4 overflow-y-auto">
                    {loading ? (
                        <div className="text-center text-slate-500 py-12 animate-pulse font-mono uppercase tracking-widest">Scanning Dimensions...</div>
                    ) : (
                        slots.map((slot, index) => (
                            <button
                                key={index}
                                onClick={() => handleSlotClick(index)}
                                disabled={mode === 'load' && !slot}
                                className={`
                                    relative group p-6 rounded-lg border-2 transition-all text-left flex items-center justify-between
                                    ${!slot 
                                        ? 'border-slate-800 bg-slate-900/50 text-slate-600 hover:border-slate-600' 
                                        : 'border-slate-700 bg-slate-800 hover:border-amber-500 hover:bg-slate-800/80 shadow-lg'
                                    }
                                    ${mode === 'load' && !slot ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                `}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <div className="text-4xl font-serif font-bold text-slate-700 select-none group-hover:text-slate-600 transition-colors">
                                            {index + 1}
                                        </div>
                                        {/* Cloud Indicator Badge */}
                                        {slot && userSession && (
                                            <div className="absolute -top-1 -right-3 text-[10px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-500/30 backdrop-blur">
                                                ☁️
                                            </div>
                                        )}
                                    </div>
                                    
                                    {slot ? (
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-bold text-amber-100 group-hover:text-amber-400 transition-colors">{slot.summary.charName}</h3>
                                                <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 uppercase tracking-wider font-bold border border-slate-700">
                                                    Lvl {slot.summary.level} {slot.summary.class}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                                <span>📍</span> {slot.summary.location}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-2 font-mono">
                                                {new Date(slot.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-bold uppercase tracking-widest text-slate-600 group-hover:text-slate-500">
                                            Empty Slot
                                        </div>
                                    )}
                                </div>

                                {slot && (
                                    <div className="w-10 h-10 opacity-20 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">
                                        <img 
                                            src={CLASS_CONFIG[slot.summary.class]?.icon} 
                                            alt={slot.summary.class}
                                            className="w-full h-full object-contain"
                                            onError={(e) => { 
                                                e.currentTarget.onerror = null; 
                                                e.currentTarget.src = getSprite(CharacterRace.HUMAN, slot.summary.class); 
                                            }}
                                        />
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
