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
  // Mapeamento de Cabeças (Bedrock -> Java)
  "skull_zombie": "zombie_head",
  "skull_creeper": "creeper_head",
  "skull_skeleton": "skeleton_skull",
  "skull_wither": "wither_skeleton_skull",
  "skull_player": "player_head",
  "skull_dragon": "dragon_head",
  "skull": "skeleton_skull", // Padrão
};

/**
 * Normaliza o ID do Minecraft para o formato esperado pela API de texturas (Java Edition style).
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

  // Correção para Cabeças do Bedrock (skull_mob -> mob_head)
  if (id.startsWith("skull_")) {
    const mob = id.replace("skull_", "");
    if (mob === "zombie" || mob === "creeper" || mob === "dragon") {
      return `${mob}_head`;
    }
    if (mob === "skeleton" || mob === "wither") {
      return `${mob}_skeleton_skull`;
    }
  }

  return id;
}

/**
 * Retorna a URL da textura para um ID do Minecraft.
 */
export function getItemTexture(minecraftId: string, customImageUrl?: string | null): string {
  if (customImageUrl) return customImageUrl;

  const normalizedId = normalizeMinecraftId(minecraftId);

  // Fonte principal: Minecraft Inventory API (S7A)
  return `https://minecraft-inventory.s7a.dev/items/${normalizedId}.png`;
}

/**
 * Fornece uma URL de fallback caso a primeira falhe.
 */
export function getItemTextureFallback(minecraftId: string): string {
  const normalizedId = normalizeMinecraftId(minecraftId);

  // Fallback 1: PrismLauncher master
  return `https://raw.githubusercontent.com/PrismLauncher/MC-Assets/master/Assets/minecraft/textures/item/${normalizedId}.png`;
}

/**
 * Fallback de "último recurso"
 */
export function getGenericFallback(): string {
  return "https://minecraft-inventory.s7a.dev/items/barrier.png";
}
