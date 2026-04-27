// All Minecraft Bedrock enchantments available for kit configuration
export const ALL_ENCHANTS = [
  // ── Espada / Armas corpo a corpo ──────────────────────────────────────────
  { id: "sharpness",           name: "Afiação",                    maxLevel: 5, category: "Armas" },
  { id: "smite",               name: "Julgamento",                 maxLevel: 5, category: "Armas" },
  { id: "bane_of_arthropods",  name: "Ruína dos Artrópodes",       maxLevel: 5, category: "Armas" },
  { id: "knockback",           name: "Repulsão",                   maxLevel: 2, category: "Armas" },
  { id: "fire_aspect",         name: "Aspecto de Fogo",            maxLevel: 2, category: "Armas" },
  { id: "looting",             name: "Saque",                      maxLevel: 3, category: "Armas" },
  { id: "sweeping",            name: "Golpe Varredor",             maxLevel: 3, category: "Armas" },

  // ── Maça (Mace) — 1.21 Tricky Trials ─────────────────────────────────────
  { id: "density",             name: "Densidade",                  maxLevel: 5, category: "Maça" },
  { id: "breach",              name: "Brecha",                     maxLevel: 4, category: "Maça" },
  { id: "wind_burst",          name: "Explosão de Vento",          maxLevel: 3, category: "Maça" },

  // ── Lança (Spear) — Mounts of Mayhem 2025/2026 ───────────────────────────
  { id: "lunge",               name: "Investida",                  maxLevel: 3, category: "Lança" },

  // ── Armadura ──────────────────────────────────────────────────────────────
  { id: "protection",          name: "Proteção",                   maxLevel: 4, category: "Armadura" },
  { id: "fire_protection",     name: "Proteção contra Fogo",       maxLevel: 4, category: "Armadura" },
  { id: "blast_protection",    name: "Proteção contra Explosão",   maxLevel: 4, category: "Armadura" },
  { id: "projectile_protection", name: "Proteção contra Projéteis", maxLevel: 4, category: "Armadura" },
  { id: "thorns",              name: "Espinhos",                   maxLevel: 3, category: "Armadura" },
  { id: "respiration",         name: "Respiração",                 maxLevel: 3, category: "Capacete" },
  { id: "aqua_affinity",       name: "Afinidade Aquática",         maxLevel: 1, category: "Capacete" },
  { id: "feather_falling",     name: "Queda Suave",                maxLevel: 4, category: "Botas" },
  { id: "depth_strider",       name: "Caminhante das Profundezas", maxLevel: 3, category: "Botas" },
  { id: "frost_walker",        name: "Caminhante do Gelo",         maxLevel: 2, category: "Botas" },
  { id: "soul_speed",          name: "Velocidade da Alma",         maxLevel: 3, category: "Botas" },
  { id: "swift_sneak",         name: "Furtividade Ágil",           maxLevel: 3, category: "Pernas" },

  // ── Ferramentas ───────────────────────────────────────────────────────────
  { id: "efficiency",          name: "Eficiência",                 maxLevel: 5, category: "Ferramentas" },
  { id: "silk_touch",          name: "Toque de Seda",              maxLevel: 1, category: "Ferramentas" },
  { id: "fortune",             name: "Fortuna",                    maxLevel: 3, category: "Ferramentas" },

  // ── Arco ──────────────────────────────────────────────────────────────────
  { id: "power",               name: "Força",                      maxLevel: 5, category: "Arco" },
  { id: "punch",               name: "Impacto",                    maxLevel: 2, category: "Arco" },
  { id: "flame",               name: "Chama",                      maxLevel: 1, category: "Arco" },
  { id: "infinity",            name: "Infinidade",                 maxLevel: 1, category: "Arco" },

  // ── Besta ─────────────────────────────────────────────────────────────────
  { id: "multishot",           name: "Tiro Múltiplo",              maxLevel: 1, category: "Besta" },
  { id: "quick_charge",        name: "Carga Rápida",               maxLevel: 3, category: "Besta" },
  { id: "piercing",            name: "Perfuração",                 maxLevel: 4, category: "Besta" },

  // ── Tridente ──────────────────────────────────────────────────────────────
  { id: "impaling",            name: "Empalamento",                maxLevel: 5, category: "Tridente" },
  { id: "riptide",             name: "Correnteza",                 maxLevel: 3, category: "Tridente" },
  { id: "loyalty",             name: "Lealdade",                   maxLevel: 3, category: "Tridente" },
  { id: "channeling",          name: "Condutividade",              maxLevel: 1, category: "Tridente" },

  // ── Pesca ─────────────────────────────────────────────────────────────────
  { id: "luck_of_the_sea",     name: "Sorte do Mar",               maxLevel: 3, category: "Pesca" },
  { id: "lure",                name: "Isca",                       maxLevel: 3, category: "Pesca" },

  // ── Geral ─────────────────────────────────────────────────────────────────
  { id: "unbreaking",          name: "Inquebrável",                maxLevel: 3, category: "Geral" },
  { id: "mending",             name: "Remendo",                    maxLevel: 1, category: "Geral" },

  // ── Maldições ─────────────────────────────────────────────────────────────
  { id: "binding_curse",       name: "Maldição do Ligamento",      maxLevel: 1, category: "Maldição" },
  { id: "vanishing_curse",     name: "Maldição do Desaparecimento", maxLevel: 1, category: "Maldição" },
] as const;

export type EnchantId = typeof ALL_ENCHANTS[number]["id"];

export type EnchantEntry = { id: string; name: string; level: number };
export type BookEnchantOption = { id: string; name: string; maxLevel: number; price: string };

export type ArmorConfig = {
  type: "armor";
  priceFull: string;
  priceGod: string;
  enchantsFull: EnchantEntry[];
  enchantsGod: EnchantEntry[];
};

// Book: admin only sets a price per level; buyer picks any enchant freely
export type BookConfig = {
  type: "book";
  pricePerLevel: string;
};

// Tool: 1 per slot, user picks enchants with individual prices per level
export type ToolEnchantOption = { id: string; name: string; maxLevel: number; price: string };
export type ToolConfig = {
  type: "tool";
  basePrice: string;
  enchants: ToolEnchantOption[];
};

export type ItemConfig = ArmorConfig | BookConfig | ToolConfig | null;

export function parseItemConfig(raw: string | null | undefined): ItemConfig {
  if (!raw) return null;
  try { return JSON.parse(raw) as ItemConfig; } catch { return null; }
}

export const ARMOR_PIECES = [
  { minecraftId: "netherite_helmet",     name: "Capacete Netherite" },
  { minecraftId: "netherite_chestplate", name: "Peitoral Netherite" },
  { minecraftId: "netherite_leggings",   name: "Calças Netherite" },
  { minecraftId: "netherite_boots",      name: "Botas Netherite" },
  { minecraftId: "diamond_helmet",       name: "Capacete Diamante" },
  { minecraftId: "diamond_chestplate",   name: "Peitoral Diamante" },
  { minecraftId: "diamond_leggings",     name: "Calças Diamante" },
  { minecraftId: "diamond_boots",        name: "Botas Diamante" },
];
