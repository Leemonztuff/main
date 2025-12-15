
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

export const createInventorySlice: StateCreator<any, [], [], InventorySlice> = (set, get) => ({
  inventory: [],
  gold: 250, // Updated starting gold for better testing experience
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
    sfx.playMagic(); 
    const item = state.inventory[slotIndex].item;
    let targetId = characterId || state.activeInventoryCharacterId || state.party[0].id;
    
    // If in battle, allow targeting current turn entity if player
    if (state.gameState === GameState.BATTLE_TACTICAL) {
         const turnId = state.turnOrder[state.currentTurnIndex];
         const turnEntity = state.battleEntities.find(e => e.id === turnId);
         if (turnEntity && turnEntity.type === 'PLAYER') {
             targetId = turnId;
         }
    }

    const applyEffect = (entity: any) => {
        const stats = { ...entity.stats };
        let amount = 0;
        let message = '';
        let isSuccess = true;
        
        if (item.effect?.type === 'heal_hp') { 
            // D&D Rule: Constructs and Undead cannot be healed by standard potions
            if (stats.creatureType === CreatureType.UNDEAD || stats.creatureType === CreatureType.CONSTRUCT) {
                message = "Immune to Healing";
                isSuccess = false;
            } else {
                amount = item.id.includes('potion') ? rollDice(4, 2) + 2 : item.effect.amount; 
                stats.hp = Math.min(stats.maxHp, stats.hp + amount); 
                message = `+${amount} HP`;
            }
        } 
        else if (item.effect?.type === 'restore_mana') { 
            amount = item.effect.amount; 
            stats.spellSlots.current = Math.min(stats.spellSlots.max, stats.spellSlots.current + amount); 
            message = `+${amount} Mana`;
        }
        else if (item.id === 'sacred_elixir') {
            // Sacred Elixir: Fully heals living, cleanses corruption. Damages Undead.
            if (stats.creatureType === CreatureType.UNDEAD) {
                amount = 20; // Massive Radiant Damage
                stats.hp = Math.max(0, stats.hp - amount);
                message = `${amount} RADIANT DMG`;
            } else {
                amount = 50;
                const oldCorr = stats.corruption || 0;
                stats.corruption = Math.max(0, oldCorr - amount);
                stats.hp = stats.maxHp;
                message = "Restored & Cleansed";
                get().addLog("The sacred light purges the shadow.", "narrative");
            }
        }
        else if (item.effect?.type === 'buff_str') { 
            amount = item.effect.amount; 
            stats.baseAttributes.STR += amount; 
            stats.attributes.STR += amount; 
            message = `Strength Increased`;
        }
        
        // Recalculate stats only if successful and it was a player
        let newStats = stats;
        if (entity.type === 'PLAYER') {
             newStats = get().recalculateStats({ ...entity, stats });
        }
        
        return { stats: newStats, amount, message, isSuccess };
    };

    if (state.gameState === GameState.BATTLE_TACTICAL) {
        const ent = state.battleEntities.find(e => e.id === targetId);
        if (ent) {
            const { stats, message, isSuccess } = applyEffect(ent);
            const newEntities = state.battleEntities.map(e => e.id === targetId ? { ...e, stats } : e);
            
            const color = !isSuccess ? '#94a3b8' : (item.id === 'sacred_elixir' && stats.creatureType === CreatureType.UNDEAD ? '#fbbf24' : '#22c55e');
            
            const popups = [...state.damagePopups, { 
                id: generateId(), 
                position: [ent.position.x, 0, ent.position.y], 
                amount: message, 
                color: color, 
                isCrit: false, 
                timestamp: Date.now() 
            }];
            
            set({ battleEntities: newEntities, hasActed: true, isInventoryOpen: false, damagePopups: popups });
        }
    } else {
        const newParty = state.party.map(p => { 
            if (p.id === targetId) { 
                const { stats, message, isSuccess } = applyEffect(p); 
                if (isSuccess) get().addLog(`${p.name} used ${item.name}. (${message})`, "roll"); 
                else get().addLog(`${p.name} used ${item.name} but it had no effect.`, "info");
                return { ...p, stats }; 
            } 
            return p; 
        });
        set({ party: newParty });
    }
    const newInventory = [...state.inventory];
    if (newInventory[slotIndex].quantity > 1) newInventory[slotIndex].quantity--; else newInventory.splice(slotIndex, 1);
    set({ inventory: newInventory });
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
