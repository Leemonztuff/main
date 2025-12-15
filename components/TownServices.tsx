
import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ITEMS, RARITY_COLORS } from '../constants';
import { Item, ItemRarity } from '../types';
import { sfx } from '../services/SoundSystem';

// Helper for random shop items
const generateShopItems = (level: number) => {
    // Return a random selection of 6 items from constants
    const allItems = Object.values(ITEMS).filter(i => i.type !== 'key');
    const shuffled = allItems.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6).map(item => ({
        item,
        price: Math.max(10, (item.rarity === ItemRarity.COMMON ? 20 : item.rarity === ItemRarity.UNCOMMON ? 100 : 500) + Math.floor(Math.random() * 20))
    }));
};

export const TownServices: React.FC = () => {
    const { 
        playerPos, townMapData, gold, spendGold, addItem, party, recalculateStats, addLog
    } = useGameStore();

    const [activeService, setActiveService] = useState<'NONE' | 'INN' | 'SHOP'>('NONE');
    const [shopStock] = useState(() => generateShopItems(party[0]?.stats.level || 1));

    // Determine if we are on a POI
    const currentTile = townMapData?.find(c => c.q === playerPos.x && c.r === playerPos.y);
    
    return null; // Logic moved to App/UI integration via Store update below.
};

// Re-implementing correctly below in a way that integrates with the existing system.
const ShopModal = ({ onClose, gold, spendGold, addItem, stock }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className="bg-slate-900 border border-amber-600/50 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
            
            {/* Header */}
            <div className="bg-slate-950 p-6 border-b border-amber-600/30 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-amber-500">The Gilded Pouch</h2>
                    <p className="text-slate-400 text-xs uppercase tracking-widest">General Goods & Armaments</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 px-4 py-2 rounded-lg border border-yellow-600/30 flex items-center gap-2">
                        <span className="text-2xl">🪙</span>
                        <span className="text-xl font-bold text-yellow-400">{gold}</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold">✕</button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/30 via-slate-900 to-slate-950">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {stock.map((entry: any, i: number) => (
                        <div key={i} className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 hover:border-amber-500 transition-all group relative">
                            <div className="flex justify-center mb-3">
                                <div className="w-16 h-16 bg-black/50 rounded-lg flex items-center justify-center border border-slate-800 relative">
                                    <img src={entry.item.icon} className="w-12 h-12 object-contain drop-shadow-md invert" />
                                    <div className="absolute top-0 right-0 w-3 h-3 rounded-full" style={{ backgroundColor: RARITY_COLORS[entry.item.rarity] }} />
                                </div>
                            </div>
                            <h4 className="text-sm font-bold text-slate-200 text-center mb-1">{entry.item.name}</h4>
                            <p className="text-[10px] text-slate-500 text-center mb-3 h-8 overflow-hidden">{entry.item.description}</p>
                            
                            <button 
                                onClick={() => {
                                    if (spendGold(entry.price)) {
                                        addItem(entry.item);
                                        sfx.playUiClick(); // Cha-ching?
                                    } else {
                                        sfx.playUiHover(); // Error sound
                                    }
                                }}
                                disabled={gold < entry.price}
                                className="w-full bg-slate-800 hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-amber-100 py-2 rounded text-xs font-bold uppercase flex items-center justify-center gap-2 border border-slate-600 hover:border-amber-500 transition-colors"
                            >
                                <span>{entry.price} G</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const InnModal = ({ onClose, gold, spendGold, party, healParty }: any) => {
    const cost = 10;
    const canAfford = gold >= cost;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur animate-in fade-in duration-500">
            <div className="bg-slate-900 border-2 border-amber-900/50 rounded-2xl w-full max-w-lg p-8 shadow-[0_0_100px_rgba(245,158,11,0.1)] text-center relative overflow-hidden">
                {/* Fire Animation Effect */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-orange-900/20 to-transparent pointer-events-none animate-pulse" />
                
                <h2 className="text-4xl font-serif font-bold text-amber-500 mb-2">The Hearth</h2>
                <p className="text-amber-200/60 italic mb-8">"Rest your weary bones, traveler. The fire keeps the shadows at bay."</p>

                <div className="bg-black/40 rounded-xl p-6 mb-8 border border-amber-900/30">
                    <div className="flex justify-between items-center text-sm text-slate-300 mb-2">
                        <span>Recovery Cost</span>
                        <span className="text-yellow-400 font-bold">{cost} Gold</span>
                    </div>
                    <div className="h-px bg-slate-800 my-2" />
                    <ul className="text-left text-xs text-slate-400 space-y-1">
                        <li>• Restore 100% HP & Stamina</li>
                        <li>• <span className="text-purple-400 font-bold">Purge all Corruption</span></li>
                        <li>• Save Game Progress</li>
                    </ul>
                </div>

                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-colors">
                        Leave
                    </button>
                    <button 
                        onClick={() => {
                            if (spendGold(cost)) {
                                healParty();
                                onClose();
                            }
                        }}
                        disabled={!canAfford}
                        className="flex-1 py-3 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:grayscale text-white font-bold shadow-lg shadow-amber-900/50 transition-all transform hover:-translate-y-1"
                    >
                        Rest ({cost}g)
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TownServicesManager = ({ activeService, onClose }: any) => {
    const { gold, spendGold, addItem, party, recalculateStats, addLog, saveGame } = useGameStore();
    // Memoize stock so it doesn't change on re-renders, simple random logic
    const [stock] = useState(() => generateShopItems(party[0]?.stats.level || 1));

    const healParty = () => {
        const store = useGameStore.getState();
        const healedParty = party.map((p: any) => {
            const stats = { ...p.stats, hp: p.stats.maxHp, stamina: p.stats.maxStamina, corruption: 0 };
            return { ...p, stats: recalculateStats({ ...p, stats }) }; // Recalc to ensure bonuses apply correctly
        });
        useGameStore.setState({ party: healedParty });
        sfx.playVictory();
        addLog("The party is fully rested and cleansed.", "narrative");
        saveGame();
    };

    if (activeService === 'SHOP') {
        return <ShopModal onClose={onClose} gold={gold} spendGold={spendGold} addItem={addItem} stock={stock} />;
    }
    if (activeService === 'INN') {
        return <InnModal onClose={onClose} gold={gold} spendGold={spendGold} party={party} healParty={healParty} />;
    }
    return null;
};
