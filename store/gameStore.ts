
import { create } from 'zustand';
import { GameStateData } from '../types';
import { createPlayerSlice, PlayerSlice } from './slices/playerSlice';
import { createInventorySlice, InventorySlice } from './slices/inventorySlice';
import { createOverworldSlice, OverworldSlice } from './slices/overworldSlice';
import { createBattleSlice, BattleSlice } from './slices/battleSlice';
import { createCommonSlice, CommonSlice } from './slices/commonSlice';

// Compose the store type from all slices
// GameStateData is kept for structure reference (e.g. for save/load types), 
// but Slices provide the actual state initialization + actions
export type GameStore = PlayerSlice & InventorySlice & OverworldSlice & BattleSlice & CommonSlice & GameStateData;

export const useGameStore = create<GameStore>((set, get, api) => ({
    // Compose Slices
    // The initial state is now derived from the return values of these creators
    ...createCommonSlice(set, get, api),
    ...createPlayerSlice(set, get, api),
    ...createInventorySlice(set, get, api),
    ...createOverworldSlice(set, get, api),
    ...createBattleSlice(set, get, api),
}));
