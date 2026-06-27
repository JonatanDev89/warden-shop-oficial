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
  // Moldes de Ferraria (Armor Trims)
  "dune_armor_trim": "dune_armor_trim_smithing_template",
  "coast_armor_trim": "coast_armor_trim_smithing_template",
  "ward_armor_trim": "ward_armor_trim_smithing_template",
  "silence_armor_trim": "silence_armor_trim_smithing_template",
  "snout_armor_trim": "snout_armor_trim_smithing_template",
  "rib_armor_trim": "rib_armor_trim_smithing_template",
  "eye_armor_trim": "eye_armor_trim_smithing_template",
  "spire_armor_trim": "spire_armor_trim_smithing_template",
  // Poções com Efeitos (para diferenciação visual)
  "strength_potion": "strength_potion",
  "speed_potion": "speed_potion",
  "haste_potion": "haste_potion",
  "healing_potion": "healing_potion",
  "instant_health_potion": "healing_potion",
  "night_vision_potion": "night_vision_potion",
  "invisibility_potion": "invisibility_potion",
  "resistance_potion": "resistance_potion",
  "fire_resistance_potion": "fire_resistance_potion",
  "regeneration_potion": "regeneration_potion",
  "weakness_potion": "weakness_potion",
  "poison_potion": "poison_potion",
  "slowness_potion": "slowness_potion",
  "jump_boost_potion": "jump_boost_potion",
  "water_breathing_potion": "water_breathing_potion",
  "luck_potion": "luck_potion",
  "slow_falling_potion": "slow_falling_potion",
  "turtle_master_potion": "turtle_master_potion",
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

  // Correção para Moldes de Ferraria
  const trimNames = ["sentry", "vex", "wild", "coast", "dune", "wayfinder", "raiser", "shaper", "host", "ward", "silence", "tide", "snout", "rib", "eye", "spire", "bolt", "flow"];
  if (trimNames.includes(id)) {
    return `${id}_armor_trim_smithing_template`;
  }

  if (id.endsWith("_trim") || id.endsWith("_armor_trim")) {
    const name = id.replace("_armor_trim", "").replace("_trim", "");
    if (trimNames.includes(name)) {
      return `${name}_armor_trim_smithing_template`;
    }
  }

  // Poções com efeitos específicos (ex: strength_potion, speed_potion, etc)
  const potionEffects = ["strength", "speed", "haste", "healing", "instant_health", "night_vision", "invisibility", "resistance", "fire_resistance", "regeneration", "weakness", "poison", "slowness", "jump_boost", "water_breathing", "luck", "slow_falling", "turtle_master", "swiftness", "leaping", "harming", "wind_charging", "weaving", "oozing", "infestation"];
  
  if (id.includes("_potion")) {
    // Caso especial: swiftness -> speed no Java
    if (id.includes("swiftness")) {
      return id.replace("swiftness", "speed");
    }
    // Caso especial: leaping -> jump_boost no Java
    if (id.includes("leaping")) {
      return id.replace("leaping", "jump_boost");
    }
    // Caso especial: harming -> instant_damage no Java
    if (id.includes("harming")) {
      return id.replace("harming", "instant_damage");
    }

    let effect = id;
    if (id.startsWith("splash_")) {
      effect = id.replace("splash_", "");
    } else if (id.startsWith("lingering_")) {
      effect = id.replace("lingering_", "");
    }
    
    const effectName = effect.replace("_potion", "");
    if (potionEffects.includes(effectName)) {
      return id;
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

  // Para poções com efeitos, usar fonte alternativa (PrismLauncher)
  if (normalizedId.includes("_potion")) {
    return `https://raw.githubusercontent.com/PrismLauncher/MC-Assets/master/Assets/minecraft/textures/item/${normalizedId}.png`;
  }

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
