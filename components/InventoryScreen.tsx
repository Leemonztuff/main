
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameState, EquipmentSlot, ItemRarity, Item, Ability, InventorySlot } from '../types';
import { RARITY_COLORS } from '../constants';
import { getModifier, getAttackBonus, getDamageRange } from '../services/dndRules';

// --- STYLED COMPONENTS HELPERS ---
const RarityBorder: React.FC<{ rarity: ItemRarity, children?: React.ReactNode, className?: string }> = ({ rarity, children, className = "" }) => {
    const color = RARITY_COLORS[rarity];
    return (
        <div 
            className={`relative group ${className}`} 
            style={{ 
                boxShadow: `inset 0 0 0 1px ${color}40`, // Subtle inner border
            }}
        >
             {/* Corner Accents for high rarity */}
            {(rarity === ItemRarity.LEGENDARY || rarity === ItemRarity.VERY_RARE || rarity === ItemRarity.RARE) && (
                <>
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l opacity-60" style={{ borderColor: color }} />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r opacity-60" style={{ borderColor: color }} />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l opacity-60" style={{ borderColor: color }} />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r opacity-60" style={{ borderColor: color }} />
                </>
            )}
            {children}
        </div>
    );
};

const TooltipCard = ({ item, onClose }: { item: Item | null, onClose?: () => void }): React.ReactElement => {
    if (!item) return (
        <div className="h-full flex items-center justify-center text-amber-500/30 font-serif italic text-sm p-8 text-center border border-amber-900/30 bg-black/40 rounded-lg">
            Hover over an item to see details.
        </div>
    );

    const rarityColor = RARITY_COLORS[item.rarity];

    return (
        <div className="bg-slate-900 border border-amber-600/50 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-full animate-in fade-in duration-200 relative" role="dialog" aria-label="Item Details">
            {onClose && (
                <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 bg-slate-950/80 rounded-full text-slate-400 z-10 border border-slate-700 hover:text-white hover:bg-red-900 transition-colors focus:ring-2 focus:ring-red-500 outline-none" aria-label="Close details">✕</button>
            )}
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 border-b border-amber-600/30 relative">
                <div className="flex items-start gap-4">
                     <div className="w-16 h-16 bg-black/50 border border-slate-600 rounded flex items-center justify-center shadow-inner relative overflow-hidden shrink-0">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: rarityColor }} />
                        <img src={item.icon} className="w-12 h-12 object-contain relative z-10 drop-shadow-md invert opacity-90" alt="" />
                     </div>
                     <div>
                        <h3 className="text-lg md:text-xl font-serif font-bold text-amber-50 leading-tight mb-1 pr-6">{item.name}</h3>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest font-bold" style={{ color: rarityColor }}>
                            {item.rarity} {item.type}
                        </span>
                     </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/20 via-slate-950 to-slate-950" tabIndex={0}>
                 {/* Main Stats */}
                 <div className="space-y-2">
                    {item.equipmentStats && (
                        <div className="flex gap-4 text-sm text-slate-300">
                            {item.equipmentStats.ac && (
                                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
                                    <span aria-hidden="true">🛡️</span> <span className="font-bold text-white">{item.equipmentStats.ac} AC</span>
                                </div>
                            )}
                            {item.equipmentStats.diceCount && (
                                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
                                    <span aria-hidden="true">⚔️</span> <span className="font-bold text-white">{item.equipmentStats.diceCount}d{item.equipmentStats.diceSides} {item.equipmentStats.damageType}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {item.effect && (
                        <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded border border-emerald-900/50 text-emerald-400 text-sm">
                            <span aria-hidden="true">✨</span> 
                            <span className="font-bold">
                                {item.effect.type === 'heal_hp' && `Restores HP`}
                                {item.effect.type === 'restore_mana' && `Restores Mana`}
                                {item.effect.type === 'buff_str' && `Increases Strength`}
                            </span>
                        </div>
                    )}
                 </div>

                 <div className="h-px bg-gradient-to-r from-transparent via-amber-600/20 to-transparent" />

                 {/* Description */}
                 <div className="text-sm text-amber-100/90 leading-relaxed font-serif">
                     {item.description}
                 </div>

                 {/* Properties / Tags */}
                 {item.equipmentStats?.properties && (
                     <div className="flex flex-wrap gap-2">
                         {item.equipmentStats.properties.map(prop => (
                             <span key={prop} className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                 {prop}
                             </span>
                         ))}
                     </div>
                 )}
                
                 {/* Flavor Text */}
                 {item.flavorText && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <p className="text-xs text-slate-500 italic font-serif leading-relaxed">
                            "{item.flavorText}"
                        </p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export const InventoryScreen: React.FC = () => {
    const { 
        inventory, party, activeInventoryCharacterId, 
        toggleInventory, consumeItem, equipItem, unequipItem, 
        cycleInventoryCharacter, hasActed, gameState 
    } = useGameStore();
    
    const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
    const [mobileSelectedItem, setMobileSelectedItem] = useState<Item | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const isBattle = gameState === GameState.BATTLE_TACTICAL;
    const activeChar = party.find(p => p.id === activeInventoryCharacterId) || party[0];

    // Handle Escape Key to Close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                toggleInventory();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        // Focus container on mount
        containerRef.current?.focus();
        
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleInventory]);

    // Helper to check if item can be used by current char
    const canUse = (item: Item) => {
        if (isBattle && hasActed) return false;
        return true;
    };

    if (!activeChar) return null;

    const displayedItem = mobileSelectedItem || hoveredItem;
    
    // Calculate Derived Combat Stats
    const attackBonus = getAttackBonus(activeChar);
    const damageRange = getDamageRange(activeChar);
    
    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300 p-2 md:p-12 outline-none" 
            role="dialog" 
            aria-modal="true" 
            aria-label="Inventory Screen"
            tabIndex={-1}
        >
            
            {/* Main Container */}
            <div className="w-full max-w-7xl h-full max-h-[95vh] grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 relative overflow-hidden lg:overflow-visible">
                
                {/* CLOSE BUTTON */}
                <button 
                    onClick={toggleInventory}
                    className="absolute top-2 right-2 lg:-right-10 lg:top-0 w-8 h-8 lg:w-10 lg:h-10 bg-slate-900 border border-amber-600/50 rounded-full text-amber-500 hover:text-white hover:bg-red-900 hover:border-red-500 transition-all z-50 flex items-center justify-center shadow-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    aria-label="Close Inventory"
                >
                    ✕
                </button>

                {/* HEADER (Mobile Navigation) */}
                <div className="lg:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 p-2 rounded-lg">
                    <button onClick={() => cycleInventoryCharacter('prev')} className="p-2 text-slate-400 focus:ring-2 focus:ring-amber-500 rounded" aria-label="Previous Character">◀</button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500">
                            <img src={activeChar.visual.spriteUrl} className="w-full h-full object-cover scale-150 translate-y-1 pixelated" alt="" />
                        </div>
                        <span className="font-bold text-amber-100">{activeChar.name}</span>
                    </div>
                    <button onClick={() => cycleInventoryCharacter('next')} className="p-2 text-slate-400 focus:ring-2 focus:ring-amber-500 rounded" aria-label="Next Character">▶</button>
                </div>

                {/* LEFT COLUMN: CHARACTER SHEET (Desktop Only) */}
                <div className="hidden lg:flex lg:col-span-3 bg-slate-900/90 border border-slate-700 rounded-lg flex-col overflow-hidden shadow-2xl relative">
                    {/* Character Header */}
                    <div className="p-6 bg-gradient-to-b from-slate-800 to-slate-900 text-center border-b border-amber-600/30">
                         <div className="flex justify-between items-center mb-4">
                            <button onClick={() => cycleInventoryCharacter('prev')} className="text-slate-500 hover:text-amber-400 focus:ring-2 focus:ring-amber-500 rounded p-1 outline-none" aria-label="Previous Character">◀</button>
                            <div className="w-24 h-24 bg-slate-950 rounded-full border-2 border-amber-600/50 overflow-hidden shadow-lg relative group">
                                <img src={activeChar.visual.spriteUrl} alt={activeChar.name} className="w-full h-full object-cover scale-150 translate-y-2 pixelated" />
                            </div>
                            <button onClick={() => cycleInventoryCharacter('next')} className="text-slate-500 hover:text-amber-400 focus:ring-2 focus:ring-amber-500 rounded p-1 outline-none" aria-label="Next Character">▶</button>
                         </div>
                         <h2 className="text-2xl font-serif font-bold text-amber-100">{activeChar.name}</h2>
                         <p className="text-xs text-amber-500/60 uppercase tracking-widest font-bold mt-1">
                            Lvl {activeChar.stats.level} {activeChar.stats.race} {activeChar.stats.class}
                         </p>
                         
                         {/* XP Bar */}
                         <div className="mt-3 relative h-1.5 bg-slate-800 rounded-full overflow-hidden w-full" role="progressbar" aria-valuenow={activeChar.stats.xp} aria-valuemin={0} aria-valuemax={activeChar.stats.xpToNextLevel} aria-label="Experience">
                             <div 
                                className="absolute top-0 left-0 h-full bg-amber-500" 
                                style={{ width: `${Math.min(100, (activeChar.stats.xp / activeChar.stats.xpToNextLevel) * 100)}%` }} 
                             />
                         </div>
                         <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                             <span>{activeChar.stats.xp} XP</span>
                             <span>{activeChar.stats.xpToNextLevel}</span>
                         </div>
                    </div>

                    {/* Combat Stats Grid */}
                    <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-slate-800">
                        <div className="bg-slate-950/50 border border-slate-800 rounded p-2 text-center" title="Current / Max Health">
                            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Health</span>
                            <span className="text-lg font-bold text-green-400">{activeChar.stats.hp} <span className="text-xs text-slate-600">/ {activeChar.stats.maxHp}</span></span>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 rounded p-2 text-center" title="Armor Class">
                            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Armor Class</span>
                            <span className="text-lg font-bold text-blue-400">{activeChar.stats.ac}</span>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 rounded p-2 text-center" title="To Hit Bonus">
                            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Attack Bonus</span>
                            <span className="text-lg font-bold text-amber-400">+{attackBonus}</span>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 rounded p-2 text-center" title="Weapon Damage">
                            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Damage</span>
                            <span className="text-lg font-bold text-red-400">{damageRange}</span>
                        </div>
                    </div>

                    {/* Attributes List */}
                    <div className="p-6 space-y-2 flex-1">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Attributes</h4>
                        {Object.entries(activeChar.stats.attributes).map(([key, val]) => (
                            <div key={key} className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-1">
                                <span className="font-bold">{key}</span>
                                <div className="flex gap-2">
                                    <span className="text-white font-mono">{val}</span>
                                    <span className={`font-mono ${getModifier(val as number) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {getModifier(val as number) >= 0 ? '+' : ''}{getModifier(val as number)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MIDDLE COLUMN: EQUIPMENT & INVENTORY */}
                <div className="lg:col-span-6 bg-slate-900/90 border border-slate-700 rounded-lg flex flex-col overflow-hidden shadow-2xl relative">
                    
                    {/* Equipment Slots */}
                    <div className="p-6 bg-slate-950 border-b border-slate-800">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Equipped Gear</h3>
                        <div className="flex justify-center gap-6">
                            {[EquipmentSlot.MAIN_HAND, EquipmentSlot.BODY, EquipmentSlot.OFF_HAND].map(slot => {
                                const item = activeChar.equipment[slot];
                                return (
                                    <div key={slot} className="flex flex-col items-center gap-2 group">
                                        <button 
                                            onClick={() => item && unequipItem(slot, activeChar.id)}
                                            onMouseEnter={() => setHoveredItem(item || null)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            onFocus={() => setHoveredItem(item || null)}
                                            disabled={!item || (isBattle && hasActed)}
                                            className={`
                                                w-20 h-20 rounded-lg border-2 flex items-center justify-center relative transition-all outline-none focus:ring-2 focus:ring-amber-500
                                                ${item ? 'bg-slate-800 border-slate-600 hover:border-amber-500 cursor-pointer' : 'bg-slate-900 border-slate-800 border-dashed'}
                                            `}
                                            aria-label={`${slot}: ${item ? item.name : 'Empty'}`}
                                        >
                                            {item ? (
                                                <img src={item.icon} className="w-12 h-12 object-contain drop-shadow-md invert" alt="" />
                                            ) : (
                                                <span className="text-2xl opacity-20 grayscale">
                                                    {slot === EquipmentSlot.MAIN_HAND ? '⚔️' : slot === EquipmentSlot.BODY ? '🛡️' : '✋'}
                                                </span>
                                            )}
                                            {item && (
                                                <div className="absolute top-0 right-0 w-2 h-2 rounded-full m-1" style={{ backgroundColor: RARITY_COLORS[item.rarity] }} />
                                            )}
                                        </button>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                            {slot === EquipmentSlot.MAIN_HAND ? 'Main Hand' : slot === EquipmentSlot.BODY ? 'Armor' : 'Off Hand'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Inventory Grid */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between">
                            <span>Backpack</span>
                            <span>{inventory.length} / 20 Slots</span>
                        </h3>
                        
                        {inventory.length === 0 ? (
                            <div className="h-40 flex items-center justify-center text-slate-600 text-sm italic border-2 border-dashed border-slate-800 rounded-lg">
                                Inventory Empty
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                                {inventory.map((slot, index) => (
                                    <RarityBorder key={index} rarity={slot.item.rarity}>
                                        <button
                                            onClick={() => {
                                                if (window.innerWidth < 1024) setMobileSelectedItem(slot.item);
                                                if (!canUse(slot.item)) return;
                                                if (slot.item.type === 'consumable') consumeItem(slot.item.id);
                                                else if (slot.item.type === 'equipment') equipItem(slot.item.id, activeChar.id);
                                            }}
                                            onMouseEnter={() => setHoveredItem(slot.item)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            onFocus={() => setHoveredItem(slot.item)}
                                            disabled={!canUse(slot.item)}
                                            className={`
                                                w-full aspect-square bg-slate-800 rounded border border-slate-700 relative hover:bg-slate-700 transition-all flex items-center justify-center outline-none focus:ring-2 focus:ring-amber-500
                                                ${!canUse(slot.item) ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:border-amber-500/50'}
                                            `}
                                            aria-label={`${slot.item.name} (x${slot.quantity})`}
                                        >
                                            <img src={slot.item.icon} className="w-3/4 h-3/4 object-contain drop-shadow-sm invert" alt="" />
                                            {slot.quantity > 1 && (
                                                <div className="absolute bottom-1 right-1 bg-slate-950 text-white text-[10px] font-bold px-1.5 rounded border border-slate-700">
                                                    {slot.quantity}
                                                </div>
                                            )}
                                        </button>
                                    </RarityBorder>
                                ))}
                                {/* Fill empty slots visuals */}
                                {Array.from({ length: Math.max(0, 20 - inventory.length) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="w-full aspect-square bg-slate-900/50 rounded border border-slate-800/50" />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: DETAILS (Desktop: Fixed, Mobile: Overlay) */}
                <div className={`
                    lg:col-span-3 lg:static absolute inset-0 z-20 pointer-events-none lg:pointer-events-auto
                    ${mobileSelectedItem ? 'pointer-events-auto' : ''}
                `}>
                    <div className={`
                        h-full transition-transform duration-300 lg:transform-none
                        ${mobileSelectedItem ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
                    `}>
                        <TooltipCard item={displayedItem} onClose={mobileSelectedItem ? () => setMobileSelectedItem(null) : undefined} />
                    </div>
                </div>

            </div>
        </div>
    );
};
