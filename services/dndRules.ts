
import { Attributes, Ability, PositionComponent, BattleCell, Entity, CombatStatsComponent, CharacterClass, EquipmentSlot, Difficulty, DamageType, ItemRarity, CharacterRace, CreatureType, EnemyDefinition } from '../types';
import { DIFFICULTY_SETTINGS, BASE_STATS, XP_TABLE, CORRUPTION_THRESHOLDS } from '../constants';

// ... (Rest of dndRules.ts content remains the same, but imports updated)
export const getModifier = (score: number): number => {
    return Math.floor(((score || 10) - 10) / 2);
};

export const getProficiencyBonus = (level: number): number => {
    return Math.floor(((level || 1) - 1) / 4) + 2;
};

export const rollDice = (sides: number, count: number = 1): number => {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * (sides || 1)) + 1;
    }
    return total;
};

export const rollD20 = (type: 'normal' | 'advantage' | 'disadvantage' = 'normal'): { result: number, raw: number[] } => {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;

    if (type === 'advantage') {
        return { result: Math.max(r1, r2), raw: [r1, r2] };
    } else if (type === 'disadvantage') {
        return { result: Math.min(r1, r2), raw: [r1, r2] };
    }
    return { result: r1, raw: [r1] };
};

export const calculateAC = (dex: number, armorBase: number = 10, hasShield: boolean = false, armorType: 'light' | 'medium' | 'heavy' = 'light', statusEffects?: Record<string, number>): number => {
    let dexBonus = getModifier(dex);
    if (armorType === 'medium') dexBonus = Math.min(2, dexBonus);
    if (armorType === 'heavy') dexBonus = 0;

    let bonus = 0;
    if (statusEffects?.['SHIELD']) bonus += 5;
    if (statusEffects?.['HASTED']) bonus += 2;
    if (statusEffects?.['STONE_SKIN']) bonus += 2;

    return armorBase + dexBonus + (hasShield ? 2 : 0) + bonus;
};

export const calculateHp = (level: number, con: number, hitDie: number, race?: CharacterRace): number => {
    const mod = getModifier(con);
    const baseHp = (hitDie + mod) + ((level - 1) * (Math.floor(hitDie / 2) + 1 + mod));
    const raceBonus = race === CharacterRace.DWARF ? level : 0;
    return baseHp + raceBonus;
};

export const calculateVisionRange = (wis: number, corruption: number = 0): number => {
    const base = Math.max(1, 2 + getModifier(wis));
    if (corruption >= CORRUPTION_THRESHOLDS.TIER_1) {
        return Math.max(1, base - 1);
    }
    return base;
};

export const getCorruptionPenalty = (corruption: number): { acPenalty: number, maxHpPenalty: number } => {
    let acPenalty = 0;
    if (corruption >= CORRUPTION_THRESHOLDS.TIER_2) {
        acPenalty = 2;
    }
    const maxHpPenalty = Math.floor(corruption / 10);
    return { acPenalty, maxHpPenalty };
};

export const checkLineOfSight = (start: PositionComponent, end: PositionComponent, map: BattleCell[]): boolean => {
    if (!start || !end || !map) return false;
    let x0 = start.x;
    let y0 = start.y;
    const x1 = end.x;
    const y1 = end.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let iterations = 0;
    while (iterations < 100) {
        iterations++;
        if (x0 === x1 && y0 === y1) break;

        if (x0 !== start.x || y0 !== start.y) {
            const cell = map.find(c => c.x === x0 && c.z === y0);
            if (cell && (cell.blocksSight !== undefined ? cell.blocksSight : cell.isObstacle)) return false;
        }

        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return true;
};

export const getAttackRange = (entity: any): number => {
    if (!entity) return 1.5;

    if (entity.type === 'ENEMY') {
        const id = (entity.defId || entity.id || "").toLowerCase();
        const name = (entity.name || "").toLowerCase();

        if (id.includes('archer') || name.includes('archer') || id.includes('bow')) return 6;
        if (id.includes('sorcerer') || name.includes('sorcerer') || id.includes('mage') || id.includes('necromancer') || id.includes('warlock') || id.includes('flayer')) return 5;

        if (entity.aiBehavior === 'SPELLCASTER' || entity.aiBehavior === 'DEFENSIVE') return 5;

        return 1.5;
    }

    const weapon = entity.equipment?.[EquipmentSlot.MAIN_HAND];
    if (!weapon) return 1.5;

    const props = weapon.equipmentStats?.properties || [];

    if (props.includes('Range')) {
        if (weapon.id.includes('bow')) return 6;
        return 4;
    }

    if (props.includes('Reach')) return 2.5;

    return 1.5;
};

export const isFlanking = (attacker: any, target: any, allEntities: any[]): boolean => {
    if (!attacker || !target || !allEntities) return false;
    if (!attacker.position || !target.position) return false;

    if (getAttackRange(attacker) > 1.5) return false;

    const tx = target.position.x;
    const ty = target.position.y;

    const adjacents = [
        { x: tx + 1, y: ty }, { x: tx - 1, y: ty },
        { x: tx, y: ty + 1 }, { x: tx, y: ty - 1 }
    ];

    return adjacents.some(adj =>
        allEntities.some(e =>
            e.id !== attacker.id &&
            e.id !== target.id &&
            e.type === attacker.type &&
            e.stats && e.stats.hp > 0 &&
            e.position.x === adj.x && e.position.y === adj.y
        )
    );
};

export const getRelevantAbilityMod = (attacker: any, weapon: any): number => {
    const stats = attacker?.stats || {};
    const attributes = stats.attributes || { STR: 10, DEX: 10 };
    const props = weapon?.equipmentStats?.properties || [];

    if (props.includes('Range')) {
        return getModifier(attributes.DEX || 10);
    }
    if (props.includes('Finesse')) {
        return Math.max(getModifier(attributes.STR || 10), getModifier(attributes.DEX || 10));
    }
    return getModifier(attributes.STR || 10);
};

export const calculateAttackRoll = (attacker: any, weaponSlot: EquipmentSlot = EquipmentSlot.MAIN_HAND, hasAdvantage: boolean = false) => {
    const stats = attacker?.stats || {};

    let finalAdvantage = hasAdvantage;
    if (stats.statusEffects && stats.statusEffects['STEALTH']) {
        finalAdvantage = true;
    }
    if (stats.statusEffects && stats.statusEffects['GUIDING_BOLT_ADV']) {
        finalAdvantage = true;
    }

    const rollType = finalAdvantage ? 'advantage' : 'normal';

    const critThreshold = (stats.race === CharacterRace.ELF) ? 19 : 20;
    const inspirationBonus = (stats.statusEffects && stats.statusEffects['BARDIC']) ? rollDice(6, 1) : 0;
    const blessBonus = (stats.statusEffects && stats.statusEffects['BLESSED']) ? rollDice(4, 1) : 0;

    if (attacker?.type === 'ENEMY') {
        const roll = rollD20(rollType);
        const hitBonus = Math.floor((stats.level || 1) / 2) + (stats.initiativeBonus || 0) + 2;

        return {
            total: roll.result + hitBonus + inspirationBonus,
            isCrit: roll.result >= critThreshold,
            isAutoMiss: roll.result === 1,
            roll: roll.result,
            mod: hitBonus,
            prof: 0,
            hasAdvantage: finalAdvantage,
            inspirationUsed: inspirationBonus > 0,
            guidingBoltUsed: !!stats.statusEffects?.['GUIDING_BOLT_ADV']
        };
    }

    const equipment = attacker?.equipment || {};
    const weapon = equipment[weaponSlot];

    const mod = getRelevantAbilityMod(attacker, weapon);
    const prof = getProficiencyBonus(stats.level || 1);

    const magicBonus = weapon?.id === 'vorpal_sword' ? 3 : 0;

    let roll = rollD20(rollType);

    if (stats.race === CharacterRace.HALFLING && roll.result === 1) {
        roll = rollD20(rollType);
    }

    const total = roll.result + mod + prof + magicBonus + inspirationBonus + blessBonus;

    return {
        total,
        isCrit: roll.result >= critThreshold,
        isAutoMiss: roll.result === 1,
        roll: roll.result,
        mod,
        prof,
        hasAdvantage: finalAdvantage,
        inspirationUsed: inspirationBonus > 0,
        guidingBoltUsed: !!stats.statusEffects?.['GUIDING_BOLT_ADV']
    };
};

export const getAttackBonus = (entity: any, weaponSlot: EquipmentSlot = EquipmentSlot.MAIN_HAND): number => {
    if (!entity || !entity.stats) return 0;
    const equipment = entity.equipment || {};
    const weapon = equipment[weaponSlot];
    const mod = getRelevantAbilityMod(entity, weapon);
    const prof = getProficiencyBonus(entity.stats.level || 1);
    return mod + prof;
};

export const calculateHitChance = (attacker: any, target: any, hasAdvantage: boolean = false): number => {
    if (!attacker || !attacker.stats || !target || !target.stats) return 0;

    let hitBonus = 0;

    if (attacker.type === 'ENEMY') {
        hitBonus = Math.floor((attacker.stats?.level || 1) / 2) + 3;
    } else {
        const equipment = attacker.equipment || {};
        const weapon = equipment[EquipmentSlot.MAIN_HAND];
        const mod = getRelevantAbilityMod(attacker, weapon);
        const prof = getProficiencyBonus(attacker.stats?.level || 1);
        const bless = (attacker.stats.statusEffects && attacker.stats.statusEffects['BLESSED']) ? 2.5 : 0;
        hitBonus = mod + prof + bless;
    }

    const targetAC = calculateAC(
        target.stats.attributes.DEX,
        10,
        false,
        'light',
        target.stats.statusEffects
    );

    const requiredRoll = targetAC - hitBonus;

    let winningOutcomes = 21 - requiredRoll;
    if (winningOutcomes > 20) winningOutcomes = 20;
    if (winningOutcomes < 1) winningOutcomes = 1;

    let probability = winningOutcomes / 20;

    if (hasAdvantage || (attacker.stats?.statusEffects && attacker.stats.statusEffects['STEALTH'])) {
        probability = 1 - Math.pow((1 - probability), 2);
    }

    return Math.round(Math.max(5, Math.min(99, probability * 100)));
};

export const calculateDamage = (
    attacker: any,
    weaponSlot: EquipmentSlot = EquipmentSlot.MAIN_HAND,
    isCrit: boolean = false,
    target?: any,
    isSneakAttackEligible?: boolean
): { amount: number, type: DamageType, isMagical: boolean, isSneakAttack?: boolean } => {

    if (!attacker || !attacker.stats) return { amount: 0, type: DamageType.BLUDGEONING, isMagical: false };

    let extraDamage = 0;

    if (target && target.stats && target.stats.statusEffects && target.stats.statusEffects['HUNTERS_MARK']) {
        extraDamage += rollDice(6, 1);
    }

    let appliedSneak = false;
    if (attacker.stats.class === CharacterClass.ROGUE && isSneakAttackEligible) {
        const sneakDice = Math.ceil(attacker.stats.level / 2);
        extraDamage += rollDice(6, sneakDice);
        appliedSneak = true;
    }

    if (attacker.stats.statusEffects?.['RAGE']) {
        extraDamage += 2;
    }

    if (attacker.stats.statusEffects?.['POISON_WEAPON']) {
        extraDamage += rollDice(4, 2);
    }

    if (attacker.type === 'ENEMY') {
        const dmg = (attacker.damage || 4) + extraDamage;
        const enemyDamageType = attacker.stats.attackDamageType || DamageType.SLASHING;
        return { amount: isCrit ? dmg * 2 : dmg, type: enemyDamageType, isMagical: false };
    }

    const equipment = attacker.equipment || {};
    const weapon = equipment[weaponSlot];

    const damageType = weapon?.equipmentStats?.damageType || DamageType.BLUDGEONING;
    const isMagical = weapon?.equipmentStats?.properties?.includes('Magical') || false;

    let diceCount = weapon?.equipmentStats?.diceCount || 1;
    let diceSides = weapon?.equipmentStats?.diceSides || 4;

    const mod = getRelevantAbilityMod(attacker, weapon);

    if (isCrit) diceCount *= 2;

    const baseDmg = rollDice(diceSides, diceCount) + mod;

    return { amount: Math.max(1, baseDmg + extraDamage), type: damageType, isMagical, isSneakAttack: appliedSneak };
};

export const calculateFinalDamage = (amount: number, type: DamageType, target: any, isMagical: boolean = false): { finalDamage: number, isResistant: boolean, isVulnerable: boolean, isImmune: boolean } => {
    const stats = target?.stats;
    if (!stats) return { finalDamage: amount, isResistant: false, isVulnerable: false, isImmune: false };

    if (stats.immunities && stats.immunities.includes(type)) {
        return { finalDamage: 0, isResistant: false, isVulnerable: false, isImmune: true };
    }

    const isPhysical = [DamageType.SLASHING, DamageType.PIERCING, DamageType.BLUDGEONING].includes(type);
    if (!isMagical && isPhysical && stats.immunities && stats.immunities.includes(DamageType.MAGIC)) {
        return { finalDamage: 0, isResistant: false, isVulnerable: false, isImmune: true };
    }

    let multiplier = 1;
    let isResistant = false;
    let isVulnerable = false;

    if (stats.resistances?.includes(type)) {
        multiplier *= 0.5;
        isResistant = true;
    }

    if (!isMagical && isPhysical && stats.resistances?.includes(DamageType.MAGIC)) {
    }

    if (stats.statusEffects?.['RAGE'] && isPhysical) {
        multiplier *= 0.5;
        isResistant = true;
    }

    if (stats.vulnerabilities?.includes(type)) {
        multiplier *= 2;
        isVulnerable = true;
    }

    if (stats.creatureType === CreatureType.UNDEAD && stats.name?.toLowerCase().includes('skeleton') && type === DamageType.BLUDGEONING) {
        multiplier *= 2;
        isVulnerable = true;
    }

    let flatReduction = 0;
    if (stats.statusEffects?.['STONE_SKIN']) {
        flatReduction = 3;
    }

    const finalDamage = Math.max(0, Math.floor(amount * multiplier) - flatReduction);

    return { finalDamage, isResistant, isVulnerable, isImmune: false };
};

export const getDamageRange = (attacker: any, weaponSlot: EquipmentSlot = EquipmentSlot.MAIN_HAND): string => {
    if (!attacker) return "";
    if (attacker.type === 'ENEMY') return `${attacker.damage || 4}`;

    const equipment = attacker.equipment || {};
    const weapon = equipment[weaponSlot];
    const mod = getRelevantAbilityMod(attacker, weapon);

    const diceCount = weapon?.equipmentStats?.diceCount || 1;
    const diceSides = weapon?.equipmentStats?.diceSides || 4;

    const min = Math.max(1, diceCount + mod);
    const max = (diceCount * diceSides) + mod;

    return `${min}-${max}`;
};

export const calculateEnemyStats = (def: EnemyDefinition, playerLevel: number, difficulty: Difficulty, difficultySettings: Record<Difficulty, { enemyStatMod: number, xpMod: number }>): CombatStatsComponent => {
    const scaling = 1 + (playerLevel - 1) * 0.15;
    const diffMod = difficultySettings[difficulty]?.enemyStatMod || 1.0;

    const maxHp = Math.floor(def.hp * scaling * diffMod);

    return {
        level: playerLevel,
        class: CharacterClass.FIGHTER,
        xp: 0,
        xpToNextLevel: 0,
        hp: maxHp,
        maxHp: maxHp,
        stamina: 10,
        maxStamina: 10,
        ac: def.ac,
        initiativeBonus: def.initiativeBonus,
        speed: 30,
        creatureType: def.type,
        attributes: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        baseAttributes: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        spellSlots: { current: 0, max: 0 },
        activeCooldowns: {},
        attackDamageType: def.attackDamageType || DamageType.SLASHING,
        resistances: def.resistances || [],
        vulnerabilities: def.vulnerabilities || [],
        immunities: def.immunities || [],
        knownSpells: [],
        knownSkills: [],
        maxActions: 1
    };
};

export const calculateSpellAttackRoll = (caster: any) => {
    const stats = caster?.stats || {};
    const attrs = stats.attributes;
    const spellMod = Math.max(getModifier(attrs.INT), getModifier(attrs.WIS), getModifier(attrs.CHA));
    const prof = getProficiencyBonus(stats.level || 1);
    const bless = (stats.statusEffects && stats.statusEffects['BLESSED']) ? rollDice(4, 1) : 0;

    const roll = rollD20();
    return {
        total: roll.result + spellMod + prof + bless,
        isCrit: roll.result === 20,
        roll: roll.result
    };
};

export const calculateSpellDC = (caster: any) => {
    const stats = caster?.stats || {};
    const attrs = stats.attributes;
    const spellMod = Math.max(getModifier(attrs.INT), getModifier(attrs.WIS), getModifier(attrs.CHA));
    const prof = getProficiencyBonus(stats.level || 1);
    return 8 + spellMod + prof;
};

export const getAoETiles = (center: PositionComponent, target: PositionComponent, type: 'CIRCLE' | 'CONE' | 'LINE', radius: number): { x: number, y: number }[] => {
    const tiles: { x: number, y: number }[] = [];
    const cx = target.x;
    const cy = target.y;

    if (type === 'CIRCLE') {
        for (let x = cx - radius; x <= cx + radius; x++) {
            for (let y = cy - radius; y <= cy + radius; y++) {
                if (Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) <= radius) {
                    tiles.push({ x, y });
                }
            }
        }
    }
    else if (type === 'CONE') {
        const dx = target.x - center.x;
        const dy = target.y - center.y;
        const angle = Math.atan2(dy, dx);

        for (let x = center.x - radius; x <= center.x + radius; x++) {
            for (let y = center.y - radius; y <= center.y + radius; y++) {
                const dist = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
                if (dist <= radius && dist > 0) {
                    const tileAngle = Math.atan2(y - center.y, x - center.x);
                    let diff = tileAngle - angle;
                    while (diff <= -Math.PI) diff += 2 * Math.PI;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    if (Math.abs(diff) < Math.PI / 4) {
                        tiles.push({ x, y });
                    }
                }
            }
        }
    }
    else if (type === 'LINE') {
        const distTotal = Math.sqrt(Math.pow(target.x - center.x, 2) + Math.pow(target.y - center.y, 2));
        const dx = (target.x - center.x) / distTotal;
        const dy = (target.y - center.y) / distTotal;

        for (let i = 1; i <= radius; i++) {
            tiles.push({ x: Math.round(center.x + dx * i), y: Math.round(center.y + dy * i) });
        }
    }

    return tiles;
};
