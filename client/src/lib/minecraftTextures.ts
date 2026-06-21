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
  "golden_apple": "golden_apple",
  "netherite_helmet": "netherite_helmet",
  "netherite_chestplate": "netherite_chestplate",
  "netherite_leggings": "netherite_leggings",
  "netherite_boots": "netherite_boots",
  "spawn_egg": "spawn_egg",
  "egg_spawn": "spawn_egg", // Algumas versões usam invertido
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
 * Retorna a URL da textura para um ID do Minecraft.
 * Tenta normalizar o ID e fornece fallbacks se a imagem principal falhar.
 */
export function getItemTexture(minecraftId: string, customImageUrl?: string | null): string {
  if (customImageUrl) return customImageUrl;

  const id = minecraftId.toLowerCase().trim();
  let normalizedId = BEDROCK_TO_JAVA_MAP[id] || id;

  // Caso especial: IDs que o S7A não tem mas outras fontes tem
  if (normalizedId === "spawn_egg") {
    return "https://raw.githubusercontent.com/PrismLauncher/MC-Assets/master/Assets/minecraft/textures/item/spawn_egg.png";
  }

  // Fonte 1: Minecraft Inventory API (S7A) - Muito boa para itens 2D
  return `https://minecraft-inventory.s7a.dev/items/${normalizedId}.png`;
}

/**
 * Fornece uma URL de fallback caso a primeira falhe.
 * Pode ser usada no evento onError das imagens.
 */
export function getItemTextureFallback(minecraftId: string): string {
  const id = minecraftId.toLowerCase().trim();
  const normalizedId = BEDROCK_TO_JAVA_MAP[id] || id;

  // Fonte 2: MC-Assets (GitHub) - Backup confiável
  return `https://raw.githubusercontent.com/PrismLauncher/MC-Assets/master/Assets/minecraft/textures/item/${normalizedId}.png`;
}

/**
 * Fallback de "último recurso" (ícone de bloco ou item genérico)
 */
export function getGenericFallback(): string {
  return "https://minecraft-inventory.s7a.dev/items/barrier.png";
}
