
import { CharacterClass, CharacterRace, Attributes, ItemRarity, DamageType, Ability, CombatStatsComponent } from '../types';
import { BASE_STATS, RACE_BONUS, CLASS_TREES, RACE_SKILLS } from '../constants';
import { rollDice, getModifier } from './dndRules';

// --- HASHING UTILS ---
// FNV-1a Hash implementation for deterministic seeding from strings
const fnv1a = (str: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

// Seeded Random Number Generator
class SeededRNG {
    private seed: number;
    constructor(seed: number) { this.seed = seed; }
    
    // Returns 0.0 to 1.0
    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    // Returns integer min to max (inclusive)
    range(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick<T>(array: T[]): T {
        return array[this.range(0, array.length - 1)];
    }
}

// --- CONSTANTS ---
const TRAITS = [
    'Brave', 'Cowardly', 'Stoic', 'Reckless', 'Wise', 'Greedy', 'Loyal', 'Mystic', 'Brutal', 'Swift'
];

const NAMES_PREFIX = [
    'Aer', 'Thal', 'Mor', 'Zyl', 'Kael', 'Vor', 'Lun', 'Pyr', 'Syl', 'Drak', 'Grim', 'Fen'
];
const NAMES_SUFFIX = [
    'on', 'ia', 'us', 'ar', 'en', 'is', 'a', 'or', 'ix', 'um', 'ash', 'os'
];

export interface SummonResult {
    name: string;
    race: CharacterRace;
    class: CharacterClass;
    baseAttributes: Attributes;
    rarity: ItemRarity;
    affinity: DamageType;
    traits: string[];
    potential: number; // 0-100 score of overall quality
}

export const SummoningService = {
    /**
     * Converts a raw data string (e.g., from QR code or camera noise) into a Character definition.
     */
    generateFromSeed: (rawData: string): SummonResult => {
        const hash = fnv1a(rawData);
        const rng = new SeededRNG(hash);

        // 1. Determine Rarity (Weighted)
        const roll = rng.next() * 100; // 0-100
        let rarity = ItemRarity.COMMON;
        let statBonus = 0;
        
        if (roll > 98) { rarity = ItemRarity.LEGENDARY; statBonus = 6; }
        else if (roll > 90) { rarity = ItemRarity.VERY_RARE; statBonus = 4; }
        else if (roll > 75) { rarity = ItemRarity.RARE; statBonus = 2; }
        else if (roll > 50) { rarity = ItemRarity.UNCOMMON; statBonus = 1; }

        // 2. Class & Race
        const cls = rng.pick(Object.values(CharacterClass));
        const race = rng.pick(Object.values(CharacterRace));

        // 3. Name Generation
        const name = rng.pick(NAMES_PREFIX) + rng.pick(NAMES_SUFFIX);

        // 4. Base Attributes Generation
        const base = { ...BASE_STATS[cls] };
        const raceBonus = RACE_BONUS[race];
        
        // Add Racial Bonuses
        (Object.keys(base) as Ability[]).forEach(k => {
            if (raceBonus[k]) base[k] += raceBonus[k]!;
        });

        // Add Random Variance (-1 to +2)
        (Object.keys(base) as Ability[]).forEach(k => {
            base[k] += rng.range(-1, 2);
        });

        // Add Rarity Bonus (Distributed randomly)
        for(let i=0; i<statBonus; i++) {
            const attr = rng.pick(Object.keys(base) as Ability[]);
            base[attr] += 1;
        }

        // 5. Affinity
        const affinities = [DamageType.FIRE, DamageType.COLD, DamageType.LIGHTNING, DamageType.RADIANT, DamageType.NECROTIC, DamageType.POISON];
        const affinity = rng.pick(affinities);

        // 6. Traits
        const traits = [];
        const traitCount = rarity === ItemRarity.LEGENDARY ? 2 : (rarity === ItemRarity.COMMON ? 0 : 1);
        for(let i=0; i<traitCount; i++) {
            traits.push(rng.pick(TRAITS));
        }

        // 7. Calculate Potential Score (for display)
        // Fix: Explicitly cast values to number[] to satisfy reducer types
        const totalStats = (Object.values(base) as number[]).reduce((a, b) => a + b, 0);
        const potential = Math.min(100, Math.floor((totalStats / 90) * 100)); // Normalize approx

        return {
            name,
            race,
            class: cls,
            baseAttributes: base,
            rarity,
            affinity,
            traits: [...new Set(traits)], // Dedupe
            potential
        };
    },

    /**
     * Converts a SummonResult into a full Entity for the game state.
     */
    hydrateEntity: (summon: SummonResult, level: number): any => {
        // This helper logic mirrors createCharacter/generateCompanion but uses the summon specific data
        // ... (Logic moved to playerSlice to keep state management centralized, but keys defined here)
        return summon;
    }
};
