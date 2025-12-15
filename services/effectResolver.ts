import { EffectDefinition, EffectType, Entity, Attributes, DamageType, Ability, EffectDuration } from '../types';

export interface EffectResult {
    damage?: { amount: number, type: DamageType, isCrit: boolean };
    healing?: number;
    resourceChange?: { type: 'MANA' | 'STAMINA' | 'HP', amount: number };
    statusApplied?: { id: string, duration: number };
    statusRemoved?: string;
    statMod?: { stat: string, amount: number, duration: number };
    teleport?: { x: number, y: number }; // Target position
    summon?: string; // DefId
    message: string;
    animationKey?: string;
}

// Helper to roll dice: XdY
const rollDice = (count: number, sides: number): number => {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
};

const getAttributeMod = (score: number): number => Math.floor((score - 10) / 2);

export const calculateEffectValue = (effect: EffectDefinition, source: Entity): { value: number, isCrit: boolean } => {
    let value = effect.baseAmount || 0;
    let isCrit = false;

    // Roll Dice
    if (effect.diceCount && effect.diceSides) {
        value += rollDice(effect.diceCount, effect.diceSides);

        // Simple Crit Logic (5% chance for now, can be passed in context)
        if (Math.random() < 0.05) {
            isCrit = true;
            value += rollDice(effect.diceCount, effect.diceSides); // Crit adds extra dice
        }
    }

    // Apply Scaling
    if (effect.statScaling && source.stats) {
        const statValue = source.stats.attributes[effect.statScaling];
        const mod = getAttributeMod(statValue);
        const factor = effect.scalingFactor || 1.0;
        value += Math.floor(mod * factor);
    }

    return { value: Math.max(0, value), isCrit };
};

export const resolveEffect = (effect: EffectDefinition, source: Entity, target: Entity): EffectResult => {
    const result: EffectResult = { message: '' };

    // Check Conditions
    if (effect.condition) {
        if (effect.condition === 'HP_BELOW_50' && target.stats.hp > target.stats.maxHp / 2) {
            return { message: 'Condition not met' };
        }
        if (effect.condition === 'IS_UNDEAD' && target.stats.creatureType !== 'Undead') {
            return { message: 'Target is not Undead' };
        }
    }

    const { value, isCrit } = calculateEffectValue(effect, source);

    switch (effect.type) {
        case EffectType.DAMAGE:
            // Apply Resistances/Weaknesses
            let finalDamage = value;
            if (effect.damageType) {
                if (target.stats.resistances?.includes(effect.damageType)) finalDamage = Math.floor(finalDamage / 2);
                if (target.stats.vulnerabilities?.includes(effect.damageType)) finalDamage = Math.floor(finalDamage * 2);
                if (target.stats.immunities?.includes(effect.damageType)) finalDamage = 0;
            }

            result.damage = { amount: finalDamage, type: effect.damageType || DamageType.BLUDGEONING, isCrit };
            result.message = `Deals ${finalDamage} ${effect.damageType} damage${isCrit ? ' (CRIT!)' : ''}`;
            break;

        case EffectType.HEAL:
            result.healing = value;
            result.message = `Heals for ${value} HP`;
            break;

        case EffectType.RESTORE_RESOURCE:
            if (effect.resourceType) {
                result.resourceChange = { type: effect.resourceType, amount: value };
                result.message = `Restores ${value} ${effect.resourceType}`;
            }
            break;

        case EffectType.APPLY_STATUS:
            if (effect.statusId) {
                result.statusApplied = {
                    id: effect.statusId,
                    duration: effect.durationRounds || 3
                };
                result.message = `Applies ${effect.statusId}`;
            }
            break;

        case EffectType.BUFF_STAT:
        case EffectType.DEBUFF_STAT:
            if (effect.statToModify) {
                const amount = effect.type === EffectType.DEBUFF_STAT ? -value : value;
                result.statMod = {
                    stat: effect.statToModify,
                    amount: amount,
                    duration: effect.durationRounds || 3
                };
                result.message = `${effect.type === EffectType.BUFF_STAT ? 'Increases' : 'Decreases'} ${effect.statToModify} by ${Math.abs(amount)}`;
            }
            break;

        case EffectType.TELEPORT:
            result.message = "Teleports";
            break;

        case EffectType.TRANSFORM:
            if (effect.summon) {
                result.summon = effect.summon; // Treat transform as summoning a new form
                result.message = `Transforms into ${effect.summon}`;
            }
            break;

        case EffectType.SUMMON:
            if (effect.summon) {
                result.summon = effect.summon;
                result.message = `Summons ${effect.summon}`;
            }
            break;

        case EffectType.MODIFY_ACTION:
            if (effect.baseAmount) {
                // Special handling for action points?
                result.message = "Modifies Actions";
            }
            break;
    }

    if (effect.animationKey) {
        result.animationKey = effect.animationKey;
    }

    return result;
};
