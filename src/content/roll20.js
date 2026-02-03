"use strict";
/**
 * Content script for Roll20
 * Fills monster sheet forms with data from the extension
 */
(function () {
    const DEV_MODE = true;
    function log(...args) {
        if (DEV_MODE) {
            console.log('[StatBlock Roll20]', ...args);
        }
    }
    log('Content script loaded in:', window.location.href);
    log('Frame name:', window.name);
    // ============ UTILITIES ============
    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    async function waitForCharsheet() {
        if (document.querySelector('#charsheet'))
            return true;
        for (let i = 0; i < 50; i++) {
            await sleep(100);
            if (document.querySelector('#charsheet'))
                return true;
        }
        return false;
    }
    // ============ FORM FILLING ============
    async function fillTextField(field, value) {
        field.click();
        field.focus();
        field.select();
        document.execCommand('insertText', false, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.blur();
        field.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);
    }
    async function fillFieldByName(name, value) {
        const field = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
        if (!field)
            return false;
        await fillTextField(field, value);
        return true;
    }
    // Fill a field within a repeating row - uses click/focus + execCommand + click outside
    async function fillRowField(row, selector, value, container) {
        const field = row.querySelector(selector);
        if (!field || !value)
            return;
        field.click();
        field.focus();
        field.select();
        document.execCommand('insertText', false, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.blur();
        field.dispatchEvent(new Event('change', { bubbles: true }));
        // Click outside to ensure Roll20 registers the change
        container.click();
        await sleep(500);
    }
    // Check a checkbox - set property + fire events
    async function checkCheckbox(checkbox) {
        if (checkbox.checked)
            return true;
        // Try .click() first (works for attack checkboxes in repeating rows)
        checkbox.click();
        await sleep(500);
        if (checkbox.checked) {
            log('Checkbox checked via .click()');
            return true;
        }
        // Fall back to setting property + firing events
        checkbox.checked = true;
        checkbox.setAttribute('checked', 'checked');
        checkbox.value = '1';
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('click', { bubbles: true }));
        await sleep(500);
        log('Checkbox set manually, checked:', checkbox.checked);
        return checkbox.checked;
    }
    // ============ PARSERS ============
    function parseAttributes(attrString) {
        const result = {
            str: '10',
            dex: '10',
            con: '10',
            int: '10',
            wis: '10',
            cha: '10',
        };
        const patterns = [
            [/STR\s*(\d+)/i, 'str'],
            [/DEX\s*(\d+)/i, 'dex'],
            [/CON\s*(\d+)/i, 'con'],
            [/INT\s*(\d+)/i, 'int'],
            [/WIS\s*(\d+)/i, 'wis'],
            [/CHA\s*(\d+)/i, 'cha'],
        ];
        for (const [pattern, key] of patterns) {
            const match = attrString.match(pattern);
            if (match)
                result[key] = match[1];
        }
        return result;
    }
    function parseSavingThrows(saveString) {
        const result = {};
        const patterns = [
            [/STR\s*([+-]?\d+)/i, 'npc_str_save_base'],
            [/DEX\s*([+-]?\d+)/i, 'npc_dex_save_base'],
            [/CON\s*([+-]?\d+)/i, 'npc_con_save_base'],
            [/INT\s*([+-]?\d+)/i, 'npc_int_save_base'],
            [/WIS\s*([+-]?\d+)/i, 'npc_wis_save_base'],
            [/CHA\s*([+-]?\d+)/i, 'npc_cha_save_base'],
        ];
        for (const [pattern, fieldName] of patterns) {
            const match = saveString.match(pattern);
            if (match)
                result[fieldName] = match[1].replace('+', '');
        }
        return result;
    }
    function parseSpellcasting(abilities) {
        if (!abilities || abilities.length === 0)
            return null;
        for (const ability of abilities) {
            const desc = ability.description.toLowerCase();
            if (desc.includes('spellcasting ability') ||
                desc.includes('innately cast')) {
                const result = {
                    hasSpellcasting: true,
                    ability: '0*',
                    spellDC: '',
                    spellAttack: '',
                    casterLevel: '',
                };
                // Extract spellcasting ability
                const abilityMatch = ability.description.match(/spellcasting ability is (\w+)/i);
                if (abilityMatch) {
                    const abilityName = abilityMatch[1].toLowerCase();
                    const abilityMap = {
                        strength: '@{strength_mod}+',
                        dexterity: '@{dexterity_mod}+',
                        constitution: '@{constitution_mod}+',
                        intelligence: '@{intelligence_mod}+',
                        wisdom: '@{wisdom_mod}+',
                        charisma: '@{charisma_mod}+',
                    };
                    result.ability = abilityMap[abilityName] || '0*';
                }
                // Extract spell save DC
                const dcMatch = ability.description.match(/spell save DC (\d+)/i);
                if (dcMatch)
                    result.spellDC = dcMatch[1];
                // Extract spell attack bonus
                const attackMatch = ability.description.match(/([+\-]\d+) to hit with spell attacks/i);
                if (attackMatch)
                    result.spellAttack = attackMatch[1].replace('+', '');
                // Extract caster level (e.g. "5th-level spellcaster" or "5th level spellcaster")
                const levelMatch = ability.description.match(/(\d+)\w*[\s-]+level spellcaster/i);
                if (levelMatch)
                    result.casterLevel = levelMatch[1];
                return result;
            }
        }
        return null;
    }
    function parseSkills(skillString) {
        const result = {};
        const skillMap = {
            acrobatics: 'npc_acrobatics_base',
            'animal handling': 'npc_animal_handling_base',
            arcana: 'npc_arcana_base',
            athletics: 'npc_athletics_base',
            deception: 'npc_deception_base',
            history: 'npc_history_base',
            insight: 'npc_insight_base',
            intimidation: 'npc_intimidation_base',
            investigation: 'npc_investigation_base',
            medicine: 'npc_medicine_base',
            nature: 'npc_nature_base',
            perception: 'npc_perception_base',
            performance: 'npc_performance_base',
            persuasion: 'npc_persuasion_base',
            religion: 'npc_religion_base',
            'sleight of hand': 'npc_sleight_of_hand_base',
            stealth: 'npc_stealth_base',
            survival: 'npc_survival_base',
        };
        const regex = /([\w\s]+?)\s*([+-]\d+)/g;
        let match;
        while ((match = regex.exec(skillString)) !== null) {
            const skillName = match[1].trim().toLowerCase();
            const value = match[2].replace('+', '');
            if (skillMap[skillName])
                result[skillMap[skillName]] = value;
        }
        return result;
    }
    function parseAttackDescription(description) {
        const result = {
            isAttack: false,
            attackType: 'Melee',
            toHit: '0',
            reach: '',
            target: '',
            damage: '',
            damageType: '',
            damage2: '',
            damageType2: '',
        };
        const toHitMatch = description.match(/([+\-]\d+)\s+to\s+hit/i);
        if (!toHitMatch)
            return result;
        // If the description is primarily a saving throw ability, don't parse as attack
        // Only skip if the DC save appears BEFORE "Hit:" or there's no "Hit:" at all
        // (attacks that deal damage on hit and THEN require a save are still attacks)
        const dcMatch = description.match(/must\s+(make|succeed\s+on)\s+a\s+DC\s+\d+/i);
        const hitIndex = description.search(/\b(Hit:|On a hit|dealing\s+\d+)/i);
        if (dcMatch) {
            const dcIndex = description.search(/must\s+(make|succeed\s+on)\s+a\s+DC\s+\d+/i);
            if (hitIndex === -1 || dcIndex < hitIndex) {
                log('Skipping attack parse: save-based ability (DC before Hit or no Hit)');
                return result;
            }
        }
        result.isAttack = true;
        result.toHit = toHitMatch[1].replace('+', '');
        const typeMatch = description.match(/\b(melee|ranged)\s+(weapon\s+|spell\s+)?attack/i);
        if (typeMatch) {
            result.attackType = (typeMatch[1].charAt(0).toUpperCase() +
                typeMatch[1].slice(1).toLowerCase());
        }
        else if (description.match(/\branged\b/i)) {
            result.attackType = 'Ranged';
        }
        else {
            result.attackType = 'Melee';
        }
        const reachMatch = description.match(/(?:reach|range)\s+([\d\/]+\s*ft\.?)/i);
        if (reachMatch)
            result.reach = reachMatch[1];
        // Target: capture text after "reach/range X ft.," up to a sentence-ending period
        // Use a greedy match that skips periods followed by lowercase or digits (like "15 ft. cone")
        const targetMatch = description.match(/(?:reach|range)\s+[\d\/]+\s*ft\.?,\s*(.+?)\.(?:\s+(?:Hit|The|On|If|Each|$)|\s*$)/i);
        if (targetMatch)
            result.target = targetMatch[1].trim();
        const damageMatch = description.match(/(?:hit:|dealing)\s*\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
        if (damageMatch) {
            result.damage = damageMatch[1].trim().replace(/\s/g, '');
            result.damageType = damageMatch[2].trim();
        }
        const damage2Match = description.match(/plus\s+\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
        if (damage2Match) {
            result.damage2 = damage2Match[1].trim().replace(/\s/g, '');
            result.damageType2 = damage2Match[2].trim();
        }
        return result;
    }
    // ============ REPEATING SECTION HELPERS ============
    function getExistingRowIds(container) {
        const ids = new Set();
        container.querySelectorAll('.repitem').forEach((row) => {
            const id = row.getAttribute('data-reprowid');
            if (id)
                ids.add(id);
        });
        return ids;
    }
    async function clickAddAndWait(container, addButton, existingIds, label) {
        addButton.click();
        for (let attempt = 0; attempt < 30; attempt++) {
            await sleep(100);
            const rows = container.querySelectorAll('.repitem');
            for (const row of Array.from(rows)) {
                const id = row.getAttribute('data-reprowid');
                if (id && !existingIds.has(id)) {
                    log(`[${label}] New row after ${(attempt + 1) * 100}ms`);
                    await sleep(500);
                    return row;
                }
            }
        }
        // Retry once
        log(`[${label}] First click failed, retrying...`);
        addButton.click();
        for (let attempt = 0; attempt < 30; attempt++) {
            await sleep(100);
            const rows = container.querySelectorAll('.repitem');
            for (const row of Array.from(rows)) {
                const id = row.getAttribute('data-reprowid');
                if (id && !existingIds.has(id)) {
                    log(`[${label}] New row on retry after ${(attempt + 1) * 100}ms`);
                    await sleep(500);
                    return row;
                }
            }
        }
        log(`[${label}] ❌ No new row after retry`);
        return null;
    }
    async function closeRowForm(row) {
        const editButton = row.querySelector('button[name="act_edit"], button.npc_options-flag');
        if (!editButton)
            return;
        editButton.click();
        await sleep(500);
        const npcOptions = row.querySelector('.npc_options');
        if (npcOptions && npcOptions.offsetHeight > 0) {
            log('Form still open, clicking gear again');
            editButton.click();
            await sleep(500);
        }
    }
    // ============ REPEATING SECTIONS ============
    async function fillRepeatingSection(containerSelector, items, isAction) {
        if (!items?.length)
            return;
        const sectionLabel = isAction ? 'ACTIONS' : 'TRAITS';
        log(`[${sectionLabel}] === Starting, ${items.length} items ===`);
        const container = document.querySelector(containerSelector);
        if (!container) {
            log(`[${sectionLabel}] ❌ Container not found: ${containerSelector}`);
            return;
        }
        const addButton = container.nextElementSibling?.querySelector('.repcontrol_add');
        if (!addButton) {
            log(`[${sectionLabel}] ❌ Add button not found`);
            return;
        }
        let filled = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const label = `${sectionLabel} ${i + 1}`;
            log(`[${label}] "${item.name}"`);
            const existingIds = getExistingRowIds(container);
            const newRow = await clickAddAndWait(container, addButton, existingIds, label);
            if (!newRow)
                continue;
            // Fill name
            await fillRowField(newRow, '.npc_options input[name="attr_name"]', item.name, container);
            // Fill description
            await fillRowField(newRow, '.npc_options textarea[name="attr_description"]', item.description, container);
            // Handle attack fields
            if (isAction) {
                const attack = parseAttackDescription(item.description);
                if (attack.isAttack) {
                    log(`[${label}] Attack: ${attack.attackType}, +${attack.toHit}`);
                    const checkbox = newRow.querySelector('.npc_options input[type="checkbox"][name="attr_attack_flag"]');
                    if (checkbox) {
                        checkbox.click();
                        await sleep(300);
                    }
                    const typeSelect = newRow.querySelector('.npc_options select[name="attr_attack_type"]');
                    if (typeSelect) {
                        typeSelect.value = attack.attackType;
                        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        await sleep(200);
                    }
                    await fillRowField(newRow, '.npc_options input[name="attr_attack_range"]', attack.reach, container);
                    await fillRowField(newRow, '.npc_options input[name="attr_attack_tohit"]', attack.toHit, container);
                    await fillRowField(newRow, '.npc_options input[name="attr_attack_target"]', attack.target, container);
                    await fillRowField(newRow, '.attack_option:not(.actiondamage) input[name="attr_attack_damage"]', attack.damage, container);
                    await fillRowField(newRow, '.attack_option:not(.actiondamage) input[name="attr_attack_damagetype"]', attack.damageType, container);
                    await fillRowField(newRow, '.npc_options input[name="attr_attack_damage2"]', attack.damage2, container);
                    await fillRowField(newRow, '.npc_options input[name="attr_attack_damagetype2"]', attack.damageType2, container);
                }
            }
            // Close the form row
            await closeRowForm(newRow);
            await sleep(500);
            filled++;
        }
        log(`[${sectionLabel}] === Done: ${filled}/${items.length} ===`);
    }
    // ============ MAIN FILL FUNCTION ============
    async function fillMonster(monster) {
        log('Starting fill for:', monster.name);
        if (!(await waitForCharsheet())) {
            throw new Error('Character sheet not found. ' +
                'Please open a character sheet at https://app.roll20.net/characters first.');
        }
        // Check if the "Create an NPC" modal is still showing
        const npcCheckbox = document.querySelector('input[name="attr_mancer_npc"]');
        if (npcCheckbox && npcCheckbox.offsetParent !== null) {
            throw new Error('Please click "Create an NPC" on the character sheet first, then try again.');
        }
        // Verify NPC name field exists
        const nameField = document.querySelector('input[name="attr_npc_name"]');
        if (!nameField) {
            throw new Error('Could not find the NPC name field. ' +
                'Make sure this is an NPC character sheet using the D&D 5e by Roll20 template.');
        }
        // Check if a creature is already filled in
        if (nameField.value.trim() !== '') {
            const existingName = nameField.value.trim();
            log(`Sheet already has a creature: "${existingName}"`);
            throw new Error(`This sheet already has "${existingName}" filled in. ` +
                `Roll20 doesn't support overwriting existing data cleanly. ` +
                `Please create a new character at https://app.roll20.net/characters or delete this one first.`);
        }
        // Basic info
        await fillFieldByName('attr_npc_name', monster.name);
        await fillFieldByName('attr_npc_type', monster.type_and_alignment || '');
        // AC
        const acMatch = monster.armor_class?.match(/^(\d+)/);
        const acTypeMatch = monster.armor_class?.match(/\(([^)]+)\)/);
        if (acMatch)
            await fillFieldByName('attr_npc_ac', acMatch[1]);
        if (acTypeMatch)
            await fillFieldByName('attr_npc_actype', acTypeMatch[1]);
        // HP
        const hpMatch = monster.hit_points?.match(/^(\d+)/);
        const hpFormulaMatch = monster.hit_points?.match(/\(([^)]+)\)/);
        if (hpMatch) {
            const hpField = document.querySelector('input[name="attr_hp_max"][type="text"]');
            if (hpField)
                await fillTextField(hpField, hpMatch[1]);
        }
        if (hpFormulaMatch)
            await fillFieldByName('attr_npc_hpformula', hpFormulaMatch[1]);
        // Speed
        await fillFieldByName('attr_npc_speed', monster.speed || '');
        // Ability scores
        const attrs = parseAttributes(monster.attributes || '');
        await fillFieldByName('attr_strength_base', attrs.str);
        await fillFieldByName('attr_dexterity_base', attrs.dex);
        await fillFieldByName('attr_constitution_base', attrs.con);
        await fillFieldByName('attr_intelligence_base', attrs.int);
        await fillFieldByName('attr_wisdom_base', attrs.wis);
        await fillFieldByName('attr_charisma_base', attrs.cha);
        // Saving throws
        if (monster.saving_throws && monster.saving_throws !== 'none') {
            const saves = parseSavingThrows(monster.saving_throws);
            for (const [field, value] of Object.entries(saves)) {
                await fillFieldByName(`attr_${field}`, value);
            }
        }
        // Skills
        if (monster.skills && monster.skills !== 'none') {
            const skills = parseSkills(monster.skills);
            for (const [field, value] of Object.entries(skills)) {
                await fillFieldByName(`attr_${field}`, value);
            }
        }
        // Senses, Languages
        await fillFieldByName('attr_npc_senses', monster.senses || '');
        await fillFieldByName('attr_npc_languages', monster.languages || '');
        // Challenge Rating
        const crMatch = monster.challenge_rating?.match(/^([\d\/]+)/);
        if (crMatch)
            await fillFieldByName('attr_npc_challenge', crMatch[1]);
        // XP
        const xpMatch = monster.challenge_rating?.match(/\(([\d,]+)\s*XP\)/i);
        if (xpMatch)
            await fillFieldByName('attr_npc_xp', xpMatch[1].replace(/,/g, ''));
        // Proficiency Bonus
        const pb = (monster.proficiency_bonus || '').replace(/[+\s]/g, '');
        await fillFieldByName('attr_npc_pb', pb);
        // Resistances, Immunities
        await fillFieldByName('attr_npc_resistances', monster.damage_resistances || '');
        await fillFieldByName('attr_npc_immunities', monster.damage_immunities || '');
        await fillFieldByName('attr_npc_condition_immunities', monster.condition_immunities || '');
        // Spellcasting
        const spellcasting = parseSpellcasting(monster.abilities || []);
        if (spellcasting?.hasSpellcasting) {
            log('Detected spellcaster, filling spellcasting fields');
            const spellCheckbox = document.querySelector('input[name="attr_npcspellcastingflag"]');
            if (spellCheckbox) {
                log('Found spellcasting checkbox, checked:', spellCheckbox.checked);
                const checked = await checkCheckbox(spellCheckbox);
                if (checked) {
                    // Wait for the spell option fields to become visible
                    await sleep(1000);
                    // Set spellcasting ability
                    const abilitySelect = document.querySelector('select[name="attr_spellcasting_ability"]');
                    if (abilitySelect && spellcasting.ability) {
                        log('Setting spellcasting ability to:', spellcasting.ability);
                        abilitySelect.value = spellcasting.ability;
                        abilitySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        abilitySelect.blur();
                        await sleep(500);
                    }
                    // Set global magic attack modifier
                    if (spellcasting.spellAttack) {
                        await fillFieldByName('attr_globalmagicmod', spellcasting.spellAttack);
                    }
                    // Set caster level
                    if (spellcasting.casterLevel) {
                        await fillFieldByName('attr_caster_level', spellcasting.casterLevel);
                    }
                    // Set spell DC mod
                    if (spellcasting.spellDC) {
                        await fillFieldByName('attr_spell_dc_mod', spellcasting.spellDC);
                    }
                    log('Spellcasting fields filled');
                }
                else {
                    log('❌ Could not check spellcasting checkbox after all attempts');
                }
            }
            else {
                log('❌ Could not find spellcasting checkbox');
            }
        }
        // Traits (abilities)
        await fillRepeatingSection('.repcontainer[data-groupname="repeating_npctrait"]', monster.abilities || [], false);
        // Actions
        await fillRepeatingSection('.repcontainer[data-groupname="repeating_npcaction"]', monster.actions || [], true);
        // Legendary actions
        if (monster.legendary_actions?.length) {
            await fillFieldByName('attr_npc_legendary_actions', '3');
            await fillRepeatingSection('.repcontainer[data-groupname="repeating_npcaction-l"]', monster.legendary_actions, true);
        }
        log('Form fill complete for:', monster.name);
    }
    // ============ MESSAGE LISTENER ============
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.action === 'fillRoll20Form') {
            log('Received fillRoll20Form message');
            if (window.name !== 'character-sheet') {
                return false;
            }
            fillMonster(message.monster)
                .then(() => {
                log('Fill succeeded');
                sendResponse({ success: true });
            })
                .catch((error) => {
                log('Fill failed:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }
    });
    log('Message listener registered');
})();
