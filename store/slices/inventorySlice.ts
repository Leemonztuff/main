
import { StateCreator } from 'zustand';
import { InventorySlot, EquipmentSlot, Item, CombatStatsComponent, GameState, CreatureType } from '../../types';
import { rollDice } from '../../services/dndRules';
import { sfx } from '../../services/SoundSystem';

export interface InventorySlice {
  inventory: InventorySlot[];
  gold: number; // New Economy State
  isInventoryOpen: boolean;
  activeInventoryCharacterId: string | null;
  toggleInventory: () => void;
  cycleInventoryCharacter: (direction: 'next' | 'prev') => void;
  consumeItem: (itemId: string, characterId?: string) => void;
  equipItem: (itemId: string, characterId: string) => void;
  unequipItem: (slot: EquipmentSlot, characterId: string) => void;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  addItem: (item: Item, quantity?: number) => void;
  getItemCount: (itemId: string) => number;
  removeItems: (itemId: string, amount: number) => boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- ITEM STRATEGY PATTERN ---

interface ItemEffectContext {
    item: Item;
    stats: CombatStatsComponent;
    log: (msg: string, type: any) => void;
}

interface ItemEffectResult {
    success: boolean;
    message: string;
    newStats: CombatStatsComponent;
    shouldConsume: boolean;
    popupColor?: string;
}

const ItemStrategies: Record<string, (ctx: ItemEffectContext) => ItemEffectResult> = {
    'heal_hp': ({ item, stats }) => {
        // Rule: Undead/Constructs usually immune to healing potions
        if (stats.creatureType === CreatureType.UNDEAD || stats.creatureType === CreatureType.CONSTRUCT) {
            return { success: false, message: "Immune", newStats: stats, shouldConsume: false, popupColor: '#94a3b8' };
        }
        const amount = item.id.includes('potion') ? rollDice(4, 2) + 2 : (item.effect?.amount || 0);
        const newHp = Math.min(stats.maxHp, stats.hp + amount);
        return {
            success: true,
            message: `+${amount} HP`,
            newStats: { ...stats, hp: newHp },
            shouldConsume: true,
            popupColor: '#22c55e'
        };
    },
    'restore_mana': ({ item, stats }) => {
        const amount = item.effect?.amount || 1;
        const newCurrent = Math.min(stats.spellSlots.max, stats.spellSlots.current + amount);
        return {
            success: true,
            message: `+${amount} Mana`,
            newStats: { ...stats, spellSlots: { ...stats.spellSlots, current: newCurrent } },
            shouldConsume: true,
            popupColor: '#3b82f6'
        };
    },
    'buff_str': ({ item, stats }) => {
        const amount = item.effect?.amount || 1;
        return {
            success: true,
            message: `Strength Up`,
            newStats: { 
                ...stats, 
                attributes: { ...stats.attributes, STR: stats.attributes.STR + amount },
                baseAttributes: { ...stats.baseAttributes, STR: stats.baseAttributes.STR + amount }
            },
            shouldConsume: true,
            popupColor: '#f59e0b'
        };
    },
    // Special Strategy for Sacred Elixir
    'sacred_cleanse': ({ stats, log }) => {
        if (stats.creatureType === CreatureType.UNDEAD) {
            const amount = 20;
            const newHp = Math.max(0, stats.hp - amount);
            return {
                success: true,
                message: `${amount} RADIANT`,
                newStats: { ...stats, hp: newHp },
                shouldConsume: true,
                popupColor: '#fbbf24'
            };
        } else {
            log("The sacred light purges the shadow.", "narrative");
            return {
                success: true,
                message: "Cleansed",
                newStats: { ...stats, hp: stats.maxHp, corruption: 0 },
                shouldConsume: true,
                popupColor: '#ffffff'
            };
        }
    }
};

const resolveStrategy = (item: Item) => {
    if (item.id === 'sacred_elixir') return ItemStrategies['sacred_cleanse'];
    if (item.effect?.type && ItemStrategies[item.effect.type]) return ItemStrategies[item.effect.type];
    return null;
};

export const createInventorySlice: StateCreator<any, [], [], InventorySlice> = (set, get) => ({
  inventory: [],
  gold: 250, 
  isInventoryOpen: false,
  activeInventoryCharacterId: null,

  toggleInventory: () => { 
    sfx.playUiClick(); 
    const state = get(); 
    set({ 
        isInventoryOpen: !state.isInventoryOpen, 
        isMapOpen: false, 
        activeInventoryCharacterId: !state.isInventoryOpen ? (state.party[0]?.id || null) : state.activeInventoryCharacterId 
    }); 
  },

  cycleInventoryCharacter: (direction) => { 
    const { party, activeInventoryCharacterId } = get(); 
    if (party.length === 0) return; 
    const idx = party.findIndex(p => p.id === activeInventoryCharacterId); 
    let newIdx = direction === 'next' ? idx + 1 : idx - 1; 
    if (newIdx >= party.length) newIdx = 0; 
    if (newIdx < 0) newIdx = party.length - 1; 
    set({ activeInventoryCharacterId: party[newIdx].id }); 
  },

  addGold: (amount) => set((state) => ({ gold: state.gold + amount })),

  spendGold: (amount) => {
      const current = get().gold;
      if (current >= amount) {
          set({ gold: current - amount });
          return true;
      }
      return false;
  },

  addItem: (item, quantity = 1) => {
      const { inventory } = get();
      const newInventory = [...inventory];
      const existing = newInventory.find(s => s.item.id === item.id);
      if (existing) existing.quantity += quantity;
      else newInventory.push({ item, quantity });
      set({ inventory: newInventory });
  },

  getItemCount: (itemId) => {
      const { inventory } = get();
      const slot = inventory.find(s => s.item.id === itemId);
      return slot ? slot.quantity : 0;
  },

  removeItems: (itemId, amount) => {
      const { inventory } = get();
      const slotIndex = inventory.findIndex(s => s.item.id === itemId);
      if (slotIndex === -1) return false;
      
      if (inventory[slotIndex].quantity < amount) return false;

      const newInventory = [...inventory];
      newInventory[slotIndex].quantity -= amount;
      if (newInventory[slotIndex].quantity <= 0) {
          newInventory.splice(slotIndex, 1);
      }
      set({ inventory: newInventory });
      return true;
  },

  consumeItem: (itemId, characterId) => {
    const state = get();
    const slotIndex = state.inventory.findIndex(s => s.item.id === itemId);
    if (slotIndex === -1) return;
    
    const item = state.inventory[slotIndex].item;
    let targetId = characterId || state.activeInventoryCharacterId || state.party[0].id;
    
    // Auto-target in battle context
    if (state.gameState === GameState.BATTLE_TACTICAL) {
         const turnId = state.turnOrder[state.currentTurnIndex];
         const turnEntity = state.battleEntities.find(e => e.id === turnId);
         if (turnEntity && turnEntity.type === 'PLAYER') {
             targetId = turnId;
         }
    }

    // Find the Entity (Battle or Party)
    let entity: any = null;
    let isBattleEntity = false;

    if (state.gameState === GameState.BATTLE_TACTICAL) {
        entity = state.battleEntities.find(e => e.id === targetId);
        isBattleEntity = true;
    } else {
        entity = state.party.find(p => p.id === targetId);
    }

    if (!entity) return;

    // --- EXECUTE STRATEGY ---
    const strategy = resolveStrategy(item);
    
    if (!strategy) {
        get().addLog("Cannot use this item directly.", "info");
        return;
    }

    sfx.playMagic(); 
    
    const result = strategy({ 
        item, 
        stats: entity.stats, 
        log: get().addLog 
    });

    if (!result.success) {
        get().addLog(`${entity.name}: ${result.message}`, "info");
        if (isBattleEntity) {
             const popups = [...state.damagePopups, { 
                id: generateId(), 
                position: [entity.position.x, 0, entity.position.y], 
                amount: result.message, 
                color: result.popupColor || '#94a3b8', 
                isCrit: false, 
                timestamp: Date.now() 
            }];
            set({ damagePopups: popups });
        }
        return; 
    }

    // --- UPDATE STATE ---
    // Recalculate stats wrapper to ensure derived values (like maxHP modifiers) are consistent
    // Note: We need to pass the full entity structure to recalculateStats
    const tempEntity = { ...entity, stats: result.newStats };
    const finalStats = get().recalculateStats(tempEntity);
    
    // Ensure HP cap check post-recalculation
    finalStats.hp = Math.min(finalStats.hp, finalStats.maxHp); 

    if (isBattleEntity) {
        const newEntities = state.battleEntities.map(e => e.id === targetId ? { ...e, stats: finalStats } : e);
        const popups = [...state.damagePopups, { 
            id: generateId(), 
            position: [entity.position.x, 0, entity.position.y], 
            amount: result.message, 
            color: result.popupColor || '#22c55e', 
            isCrit: false, 
            timestamp: Date.now() 
        }];
        
        set({ 
            battleEntities: newEntities, 
            hasActed: true, 
            isInventoryOpen: false, 
            damagePopups: popups 
        });
    } else {
        const newParty = state.party.map(p => p.id === targetId ? { ...p, stats: finalStats } : p);
        set({ party: newParty });
        get().addLog(`${entity.name} used ${item.name}. ${result.message}`, "roll");
    }

    // --- CONSUME ITEM ---
    if (result.shouldConsume) {
        const newInventory = [...state.inventory];
        if (newInventory[slotIndex].quantity > 1) {
            newInventory[slotIndex].quantity--;
        } else {
            newInventory.splice(slotIndex, 1);
        }
        set({ inventory: newInventory });
    }
  },

  equipItem: (itemId, characterId) => {
    const state = get(); const slotIndex = state.inventory.findIndex(s => s.item.id === itemId); if (slotIndex === -1) return;
    const itemToEquip = state.inventory[slotIndex].item as Item; if (!itemToEquip.equipmentStats) return;
    const charIndex = state.party.findIndex(p => p.id === characterId); if (charIndex === -1) return;
    const character = state.party[charIndex]; const targetSlot = itemToEquip.equipmentStats.slot; const currentEquipped = character.equipment[targetSlot];
    const newInventory = [...state.inventory];
    if (newInventory[slotIndex].quantity > 1) newInventory[slotIndex].quantity--; else newInventory.splice(slotIndex, 1);
    if (currentEquipped) { const existingSlot = newInventory.find(s => s.item.id === currentEquipped.id); if (existingSlot) existingSlot.quantity++; else newInventory.push({ item: currentEquipped, quantity: 1 }); }
    const updatedChar = { ...character, equipment: { ...character.equipment, [targetSlot]: itemToEquip } };
    updatedChar.stats = get().recalculateStats(updatedChar);
    const newParty = [...state.party]; newParty[charIndex] = updatedChar; set({ inventory: newInventory, party: newParty }); sfx.playUiClick();
  },

  unequipItem: (slot, characterId) => {
    const state = get(); const charIndex = state.party.findIndex(p => p.id === characterId); if (charIndex === -1) return;
    const character = state.party[charIndex]; const itemToRemove = character.equipment[slot]; if (!itemToRemove) return;
    const newInventory = [...state.inventory];
    const existingSlot = newInventory.find(s => s.item.id === itemToRemove.id); if (existingSlot) existingSlot.quantity++; else newInventory.push({ item: itemToRemove, quantity: 1 });
    const newEquipment = { ...character.equipment }; delete newEquipment[slot];
    const updatedChar = { ...character, equipment: newEquipment }; updatedChar.stats = get().recalculateStats(updatedChar);
    const newParty = [...state.party]; newParty[charIndex] = updatedChar; set({ inventory: newInventory, party: newParty }); sfx.playUiClick();
  }
});
