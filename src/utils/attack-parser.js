/**
 * Parse attack information from monster action descriptions
 *
 * Examples:
 * "Melee Attack: +6 to hit, dealing 9 (1d10 + 4) slashing damage plus 3 (1d6) cold damage."
 * "Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 18 (4d6 + 4) slashing damage."
 */
export function parseAttackDescription(description) {
    const result = { isAttack: false };
    // Check if this is an attack
    const attackMatch = description.match(/\b(melee|ranged)\s+(weapon\s+)?attack/i);
    if (!attackMatch) {
        return result;
    }
    result.isAttack = true;
    result.attackType = attackMatch[1].charAt(0).toUpperCase() + attackMatch[1].slice(1).toLowerCase();
    // Extract to hit bonus: "+6 to hit" or "+10 to hit"
    const toHitMatch = description.match(/([+\-]\d+)\s+to\s+hit/i);
    if (toHitMatch) {
        result.toHit = toHitMatch[1];
    }
    // Extract range/reach: "reach 5 ft." or "range 30/120 ft."
    const rangeMatch = description.match(/(?:reach|range)\s+([^,\.]+)/i);
    if (rangeMatch) {
        result.range = rangeMatch[1].trim();
    }
    // Extract target: "one target" or "one creature"
    const targetMatch = description.match(/(?:reach [^,]+,\s+)?([^\.]+target[^\.]*)/i);
    if (targetMatch) {
        result.target = targetMatch[1].trim();
    }
    // Extract primary damage: "18 (4d6 + 4) slashing" or "9 (1d10 + 4) slashing"
    const damageMatch = description.match(/(?:hit:|dealing)\s*\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
    if (damageMatch) {
        result.damage = damageMatch[1].trim();
        result.damageType = damageMatch[2].trim();
    }
    // Extract secondary damage: "plus 3 (1d6) cold damage"
    const damage2Match = description.match(/plus\s+\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
    if (damage2Match) {
        result.damage2 = damage2Match[1].trim();
        result.damageType2 = damage2Match[2].trim();
    }
    return result;
}
/**
 * Parse ability scores from attributes string
 * "STR 14 (+2), DEX 16 (+3), CON 18 (+4), INT 2 (-4), WIS 10 (+0), CHA 8 (-1)"
 */
export function parseAttributes(attributes) {
    const result = {};
    const attrs = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    attrs.forEach(attr => {
        const regex = new RegExp(`${attr}\\s+(\\d+)`, 'i');
        const match = attributes.match(regex);
        if (match) {
            result[attr.toLowerCase()] = match[1];
        }
    });
    return result;
}
/**
 * Parse saving throws
 * "DEX +5, CON +4, WIS +2, CHA +5"
 */
export function parseSavingThrows(savingThrows) {
    const result = {};
    const saves = savingThrows.split(',');
    saves.forEach(save => {
        const match = save.trim().match(/^(STR|DEX|CON|INT|WIS|CHA)\s+([+\-]\d+)/i);
        if (match) {
            const attr = match[1].toLowerCase();
            result[`npc_${attr}_save_base`] = match[2];
        }
    });
    return result;
}
/**
 * Parse skills
 * "Perception +2, Stealth +5"
 */
export function parseSkills(skills) {
    const result = {};
    if (skills === 'none' || !skills) {
        return result;
    }
    const skillMap = {
        'acrobatics': 'npc_acrobatics_base',
        'animal handling': 'npc_animal_handling_base',
        'arcana': 'npc_arcana_base',
        'athletics': 'npc_athletics_base',
        'deception': 'npc_deception_base',
        'history': 'npc_history_base',
        'insight': 'npc_insight_base',
        'intimidation': 'npc_intimidation_base',
        'investigation': 'npc_investigation_base',
        'medicine': 'npc_medicine_base',
        'nature': 'npc_nature_base',
        'perception': 'npc_perception_base',
        'performance': 'npc_performance_base',
        'persuasion': 'npc_persuasion_base',
        'religion': 'npc_religion_base',
        'sleight of hand': 'npc_sleight_of_hand_base',
        'stealth': 'npc_stealth_base',
        'survival': 'npc_survival_base',
    };
    const skillEntries = skills.split(',');
    skillEntries.forEach(entry => {
        const match = entry.trim().match(/^([a-z\s]+)\s+([+\-]\d+)/i);
        if (match) {
            const skillName = match[1].trim().toLowerCase();
            const bonus = match[2];
            const fieldName = skillMap[skillName];
            if (fieldName) {
                result[fieldName] = bonus;
            }
        }
    });
    return result;
}
