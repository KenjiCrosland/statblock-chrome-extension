/**
 * Content script for Roll20
 * Fills monster sheet forms with data from the extension
 */

(function () {
  interface Monster {
    name: string;
    type_and_alignment: string;
    armor_class: string;
    hit_points: string;
    speed: string;
    attributes: string;
    saving_throws: string;
    skills: string;
    damage_resistances: string;
    damage_immunities: string;
    condition_immunities: string;
    senses: string;
    languages: string;
    challenge_rating: string;
    proficiency_bonus: string;
    abilities: Array<{ name: string; description: string }>;
    actions: Array<{ name: string; description: string }>;
    legendary_actions?: Array<{ name: string; description: string }>;
  }

  interface ParsedAttack {
    isAttack: boolean;
    attackType: 'Melee' | 'Ranged';
    toHit: string;
    reach: string;
    target: string;
    damage: string;
    damageType: string;
    damage2: string;
    damageType2: string;
  }

  const DEV_MODE = true;

  function log(...args: any[]) {
    if (DEV_MODE) {
      console.log('[StatBlock Roll20]', ...args);
    }
  }

  log('Content script loaded in:', window.location.href);
  log('Frame name:', window.name);

  // ============ UTILITIES ============

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitForCharsheet(): Promise<boolean> {
    if (document.querySelector('#charsheet')) return true;
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (document.querySelector('#charsheet')) return true;
    }
    return false;
  }

  // ============ FORM FILLING ============

  async function fillTextField(
    field: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ): Promise<void> {
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

  async function fillFieldByName(
    name: string,
    value: string,
  ): Promise<boolean> {
    const field = document.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`input[name="${name}"], textarea[name="${name}"]`);
    if (!field) return false;
    await fillTextField(field, value);
    return true;
  }

  // Fill a field within a repeating row - uses click/focus + execCommand + click outside
  async function fillRowField(
    row: Element,
    selector: string,
    value: string,
    container: Element,
  ): Promise<void> {
    const field = row.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      selector,
    );
    if (!field || !value) return;

    field.click();
    field.focus();
    field.select();
    document.execCommand('insertText', false, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
    field.dispatchEvent(new Event('change', { bubbles: true }));

    // Click outside to ensure Roll20 registers the change
    (container as HTMLElement).click();
    await sleep(500);
  }

  // ============ PARSERS ============

  function parseAttributes(attrString: string): Record<string, string> {
    const result: Record<string, string> = {
      str: '10',
      dex: '10',
      con: '10',
      int: '10',
      wis: '10',
      cha: '10',
    };
    const patterns: [RegExp, string][] = [
      [/STR\s*(\d+)/i, 'str'],
      [/DEX\s*(\d+)/i, 'dex'],
      [/CON\s*(\d+)/i, 'con'],
      [/INT\s*(\d+)/i, 'int'],
      [/WIS\s*(\d+)/i, 'wis'],
      [/CHA\s*(\d+)/i, 'cha'],
    ];
    for (const [pattern, key] of patterns) {
      const match = attrString.match(pattern);
      if (match) result[key] = match[1];
    }
    return result;
  }

  function parseSavingThrows(saveString: string): Record<string, string> {
    const result: Record<string, string> = {};
    const patterns: [RegExp, string][] = [
      [/STR\s*([+-]?\d+)/i, 'npc_str_save_base'],
      [/DEX\s*([+-]?\d+)/i, 'npc_dex_save_base'],
      [/CON\s*([+-]?\d+)/i, 'npc_con_save_base'],
      [/INT\s*([+-]?\d+)/i, 'npc_int_save_base'],
      [/WIS\s*([+-]?\d+)/i, 'npc_wis_save_base'],
      [/CHA\s*([+-]?\d+)/i, 'npc_cha_save_base'],
    ];
    for (const [pattern, fieldName] of patterns) {
      const match = saveString.match(pattern);
      if (match) result[fieldName] = match[1].replace('+', '');
    }
    return result;
  }

  function parseSkills(skillString: string): Record<string, string> {
    const result: Record<string, string> = {};
    const skillMap: Record<string, string> = {
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
      if (skillMap[skillName]) result[skillMap[skillName]] = value;
    }
    return result;
  }

  function parseAttackDescription(description: string): ParsedAttack {
    const result: ParsedAttack = {
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

    const attackMatch = description.match(
      /(Melee|Ranged)\s+(Weapon|Spell)\s+Attack:\s*([+-]?\d+)\s*to hit/i,
    );
    if (!attackMatch) return result;

    result.isAttack = true;
    result.attackType = attackMatch[1].toLowerCase().startsWith('r')
      ? 'Ranged'
      : 'Melee';
    result.toHit = attackMatch[3].replace('+', '');

    const reachMatch = description.match(
      /(?:reach|range)\s+([\d\/]+\s*ft\.?)/i,
    );
    if (reachMatch) result.reach = reachMatch[1];

    const targetMatch = description.match(
      /(?:reach|range)\s+[\d\/]+\s*ft\.?,\s*(.+?)\./i,
    );
    if (targetMatch) result.target = targetMatch[1].trim();

    const damageMatch = description.match(
      /Hit:\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(\w+)\s*damage/i,
    );
    if (damageMatch) {
      result.damage = damageMatch[1].replace(/\s/g, '');
      result.damageType = damageMatch[2];
    }

    const damage2Match = description.match(
      /plus\s+\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(\w+)\s*damage/i,
    );
    if (damage2Match) {
      result.damage2 = damage2Match[1].replace(/\s/g, '');
      result.damageType2 = damage2Match[2];
    }

    return result;
  }

  // ============ REPEATING SECTION HELPERS ============

  function getExistingRowIds(container: Element): Set<string> {
    const ids = new Set<string>();
    container.querySelectorAll('.repitem').forEach((row) => {
      const id = row.getAttribute('data-reprowid');
      if (id) ids.add(id);
    });
    return ids;
  }

  async function clickAddAndWait(
    container: Element,
    addButton: HTMLButtonElement,
    existingIds: Set<string>,
    label: string,
  ): Promise<Element | null> {
    // Click Add
    addButton.click();

    // Poll for new row
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(100);
      const rows = container.querySelectorAll('.repitem');
      for (const row of Array.from(rows)) {
        const id = row.getAttribute('data-reprowid');
        if (id && !existingIds.has(id)) {
          log(`[${label}] New row after ${(attempt + 1) * 100}ms`);
          await sleep(500); // Let framework settle
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

  async function closeRowForm(row: Element): Promise<void> {
    const editButton = row.querySelector<HTMLButtonElement>(
      'button[name="act_edit"], button.npc_options-flag',
    );
    if (!editButton) return;

    editButton.click();
    await sleep(500);

    // Check if form is still visible (attack checkbox may have toggled it)
    const npcOptions = row.querySelector('.npc_options') as HTMLElement;
    if (npcOptions && npcOptions.offsetHeight > 0) {
      log('Form still open, clicking gear again');
      editButton.click();
      await sleep(500);
    }
  }

  // ============ REPEATING SECTIONS ============

  async function fillRepeatingSection(
    containerSelector: string,
    items: Array<{ name: string; description: string }>,
    isAction: boolean,
  ): Promise<void> {
    if (!items?.length) return;

    const sectionLabel = isAction ? 'ACTIONS' : 'TRAITS';
    log(`[${sectionLabel}] === Starting, ${items.length} items ===`);

    const container = document.querySelector(containerSelector);
    if (!container) {
      log(`[${sectionLabel}] ❌ Container not found: ${containerSelector}`);
      return;
    }

    const addButton = container.nextElementSibling?.querySelector(
      '.repcontrol_add',
    ) as HTMLButtonElement;
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
      const newRow = await clickAddAndWait(
        container,
        addButton,
        existingIds,
        label,
      );
      if (!newRow) continue;

      // Fill name
      await fillRowField(
        newRow,
        '.npc_options input[name="attr_name"]',
        item.name,
        container,
      );

      // Fill description
      await fillRowField(
        newRow,
        '.npc_options textarea[name="attr_description"]',
        item.description,
        container,
      );

      // Handle attack fields
      if (isAction) {
        const attack = parseAttackDescription(item.description);
        if (attack.isAttack) {
          log(`[${label}] Attack: ${attack.attackType}, +${attack.toHit}`);

          // Check the attack checkbox
          const checkbox = newRow.querySelector<HTMLInputElement>(
            '.npc_options input[type="checkbox"][name="attr_attack_flag"]',
          );
          if (checkbox) {
            checkbox.click();
            await sleep(300);
          }

          // Set attack type
          const typeSelect = newRow.querySelector<HTMLSelectElement>(
            '.npc_options select[name="attr_attack_type"]',
          );
          if (typeSelect) {
            typeSelect.value = attack.attackType;
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(200);
          }

          // Attack fields
          await fillRowField(
            newRow,
            '.npc_options input[name="attr_attack_range"]',
            attack.reach,
            container,
          );
          await fillRowField(
            newRow,
            '.npc_options input[name="attr_attack_tohit"]',
            attack.toHit,
            container,
          );
          await fillRowField(
            newRow,
            '.npc_options input[name="attr_attack_target"]',
            attack.target,
            container,
          );

          // Primary damage
          await fillRowField(
            newRow,
            '.attack_option:not(.actiondamage) input[name="attr_attack_damage"]',
            attack.damage,
            container,
          );
          await fillRowField(
            newRow,
            '.attack_option:not(.actiondamage) input[name="attr_attack_damagetype"]',
            attack.damageType,
            container,
          );

          // Secondary damage
          await fillRowField(
            newRow,
            '.npc_options input[name="attr_attack_damage2"]',
            attack.damage2,
            container,
          );
          await fillRowField(
            newRow,
            '.npc_options input[name="attr_attack_damagetype2"]',
            attack.damageType2,
            container,
          );
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

  async function fillMonster(monster: Monster): Promise<void> {
    log('Starting fill for:', monster.name);

    if (!(await waitForCharsheet())) {
      throw new Error('#charsheet not found');
    }

    // Check if a creature is already filled in
    const nameField = document.querySelector<HTMLInputElement>(
      'input[name="attr_npc_name"]',
    );
    if (nameField && nameField.value.trim() !== '') {
      const existingName = nameField.value.trim();
      log(`Sheet already has a creature: "${existingName}"`);
      throw new Error(
        `This sheet already has "${existingName}" filled in. ` +
          `Roll20 doesn't support overwriting existing data cleanly. ` +
          `Please create a new character at https://app.roll20.net/characters or delete this one first.`,
      );
    }

    // Basic info
    await fillFieldByName('attr_npc_name', monster.name);
    await fillFieldByName('attr_npc_type', monster.type_and_alignment || '');

    // AC
    const acMatch = monster.armor_class?.match(/^(\d+)/);
    const acTypeMatch = monster.armor_class?.match(/\(([^)]+)\)/);
    if (acMatch) await fillFieldByName('attr_npc_ac', acMatch[1]);
    if (acTypeMatch) await fillFieldByName('attr_npc_actype', acTypeMatch[1]);

    // HP
    const hpMatch = monster.hit_points?.match(/^(\d+)/);
    const hpFormulaMatch = monster.hit_points?.match(/\(([^)]+)\)/);
    if (hpMatch) {
      const hpField = document.querySelector<HTMLInputElement>(
        'input[name="attr_hp_max"][type="text"]',
      );
      if (hpField) await fillTextField(hpField, hpMatch[1]);
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
    if (crMatch) await fillFieldByName('attr_npc_challenge', crMatch[1]);

    // XP
    const xpMatch = monster.challenge_rating?.match(/\(([\d,]+)\s*XP\)/i);
    if (xpMatch)
      await fillFieldByName('attr_npc_xp', xpMatch[1].replace(/,/g, ''));

    // Proficiency Bonus
    const pb = (monster.proficiency_bonus || '').replace(/[+\s]/g, '');
    await fillFieldByName('attr_npc_pb', pb);

    // Resistances, Immunities
    await fillFieldByName(
      'attr_npc_resistances',
      monster.damage_resistances || '',
    );
    await fillFieldByName(
      'attr_npc_immunities',
      monster.damage_immunities || '',
    );
    await fillFieldByName(
      'attr_npc_condition_immunities',
      monster.condition_immunities || '',
    );

    // Traits (abilities)
    await fillRepeatingSection(
      '.repcontainer[data-groupname="repeating_npctrait"]',
      monster.abilities || [],
      false,
    );

    // Actions
    await fillRepeatingSection(
      '.repcontainer[data-groupname="repeating_npcaction"]',
      monster.actions || [],
      true,
    );

    // Legendary actions
    if (monster.legendary_actions?.length) {
      await fillFieldByName('attr_npc_legendary_actions', '3');
      await fillRepeatingSection(
        '.repcontainer[data-groupname="repeating_npcaction-l"]',
        monster.legendary_actions,
        true,
      );
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
