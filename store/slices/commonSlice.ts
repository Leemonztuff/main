
import { StateCreator } from 'zustand';
import { GameLogEntry } from '../../types';

export interface CommonSlice {
  logs: GameLogEntry[];
  addLog: (message: string, type?: GameLogEntry['type']) => void;
}

export const createCommonSlice: StateCreator<any, [], [], CommonSlice> = (set) => ({
  logs: [],
  addLog: (message, type = 'info') => {
    set((state) => ({ 
        logs: [...state.logs, { 
            id: Math.random().toString(36).substr(2, 9),
            message, 
            type, 
            timestamp: Date.now() 
        }] 
    }));
  },
});
