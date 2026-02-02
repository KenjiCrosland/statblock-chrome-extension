/**
 * Monster ability (special trait, feature, or passive ability)
 */
export interface MonsterAbility {
  name: string;
  description: string;
}

/**
 * Monster action (attack, spell, or special action)
 */
export interface MonsterAction {
  name: string;
  description: string;
}

/**
 * Complete monster statblock
 */
export interface Monster {
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
  abilities: MonsterAbility[];
  actions: MonsterAction[];
  legendary_actions?: MonsterAction[];
  monsterDescription: string;
  monsterType: string;
  selectedChallengeRating: string;
  monsterName?: string;
  caster: boolean;
}

/**
 * Monster collection stored in localStorage
 * Key is category name, value is array of monsters
 */
export interface MonsterCollection {
  [category: string]: Monster[] | string | undefined;
  generationCount?: string;
  firstGenerationTime?: string;
}

/**
 * Storage keys used by the extension
 */
export const STORAGE_KEYS = {
  MONSTERS: 'monsters',
  LAST_SYNC: 'lastSync',
  SYNC_ENABLED: 'syncEnabled',
} as const;
