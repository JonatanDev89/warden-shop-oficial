/**
 * Biblioteca centralizada para gerenciar texturas do Minecraft (Bedrock & Java).
 * Inclui mapeamento de IDs problemáticos e fallback para múltiplas fontes.
 */

const BEDROCK_TO_JAVA_MAP: Record<string, string> = {
  "elytra": "elytra",
  "totem": "totem_of_undying",
  "totem_of_undying": "totem_of_undying",
  "mace": "mace",
  "trident": "trident",
  "enchanted_golden_apple": "enchanted_golden_apple",
  "apple_enchanted": "enchanted_golden_apple",
  "golden_apple": "golden_apple",
  "apple_golden": "golden_apple",
  "netherite_helmet": "netherite_helmet",
  "netherite_chestplate": "netherite_chestplate",
  "netherite_leggings": "netherite_leggings",
  "netherite_boots": "netherite_boots",
  "ender_pearl": "ender_pearl",
  "end_crystal": "end_crystal",
  "experience_bottle": "experience_bottle",
  "honey_bottle": "honey_bottle",
  "dragon_breath": "dragon_breath",
  "firework_rocket": "firework_rocket",
  "fire_charge": "fire_charge",
  "flint_and_steel": "flint_and_steel",
  "fishing_rod": "fishing_rod",
  "shears": "shears",
  "bow": "bow",
  "crossbow": "crossbow",
  "arrow": "arrow",
  "spectral_arrow": "spectral_arrow",
  "tipped_arrow": "tipped_arrow",
  "potion": "potion",
  "splash_potion": "splash_potion",
  "lingering_potion": "lingering_potion",
};

/**
 * Normaliza o ID do Minecraft para o formato esperado pela API de texturas (Java Edition style).
 * Exemplo: spawn_egg_zombie -> zombie_spawn_egg
 */
function normalizeMinecraftId(minecraftId: string): string {
  let id = minecraftId.toLowerCase().trim();
  
  // Remove o prefixo "minecraft:" se existir
  if (id.startsWith("minecraft:")) {
    id = id.substring(10);
  }

  // Verifica mapeamento manual primeiro
  if (BEDROCK_TO_JAVA_MAP[id]) {
    return BEDROCK_TO_JAVA_MAP[id];
  }

  // Correção para Spawn Eggs do Bedrock (spawn_egg_mob -> mob_spawn_egg)
  if (id.startsWith("spawn_egg_")) {
    const mob = id.replace("spawn_egg_", "");
    return `${mob}_spawn_egg`;
  }

  // Correção para Spawn Eggs invertidos (egg_spawn_mob -> mob_spawn_egg)
  if (id.startsWith("egg_spawn_")) {
    const mob = id.replace("egg_spawn_", "");
    return `${mob}_spawn_egg`;
  }

  return id;
}

/**
 * Retorna a URL da textura para um ID do Minecraft.
 * Tenta normalizar o ID e fornece fallbacks se a imagem principal falhar.
 */
export function getItemTexture(minecraftId: string, customImageUrl?: string | null): string {
  if (customImageUrl) return customImageUrl;

  const normalizedId = normalizeMinecraftId(minecraftId);

  // Fonte principal: Minecraft Inventory API (S7A) — suporta spawn eggs e demais itens
  return `https://minecraft-inventory.s7a.dev/items/${normalizedId}.png`;
}

/**
 * Fornece uma URL de fallback caso a primeira falhe.
 * Pode ser usada no evento onError das imagens.
 */
export function getItemTextureFallback(minecraftId: string): string {
  const normalizedId = normalizeMinecraftId(minecraftId);

  // Fallback: repositório de assets do Minecraft no GitHub (branch master)
  return `https://raw.githubusercontent.com/PrismLauncher/MC-Assets/master/Assets/minecraft/textures/item/${normalizedId}.png`;
}

/**
 * Fallback de "último recurso" (ícone de bloco ou item genérico)
 */
export function getGenericFallback(): string {
  return "https://minecraft-inventory.s7a.dev/items/barrier.png";
}
