export type PotionDeliveryType = "normal" | "splash" | "lingering";

export type PotionMetadata = {
  itemId: "potion" | "splash_potion" | "lingering_potion";
  data: number;
  effectId: string;
  deliveryType: PotionDeliveryType;
  level?: "I" | "II";
};

type PotionDefinition = {
  levelI: number;
  levelII?: number;
};

/**
 * Bedrock usa o ID `potion` (ou splash_potion/lingering_potion) com data value.
 * Os IDs cadastrados na loja são IDs do efeito e não IDs de item Bedrock.
 */
const POTION_DEFINITIONS: Record<string, PotionDefinition> = {
  regeneration: { levelI: 28, levelII: 30 },
  swiftness: { levelI: 14, levelII: 16 },
  fire_resistance: { levelI: 12 },
  healing: { levelI: 21, levelII: 22 },
  night_vision: { levelI: 5 },
  strength: { levelI: 31, levelII: 33 },
  leaping: { levelI: 9, levelII: 11 },
  invisibility: { levelI: 7 },
  water_breathing: { levelI: 19 },
  poison: { levelI: 25, levelII: 27 },
  weakness: { levelI: 34 },
  slowness: { levelI: 17, levelII: 42 },
  harming: { levelI: 23, levelII: 24 },
  slow_falling: { levelI: 40 },
  turtle_master: { levelI: 37, levelII: 39 },
  wind_charging: { levelI: 43 },
  weaving: { levelI: 44 },
  oozing: { levelI: 45 },
  infestation: { levelI: 46 },
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^minecraft:/, "");
}

function inferDeliveryType(value: string): PotionDeliveryType {
  if (value.startsWith("splash_") || value.includes("_splash_potion")) return "splash";
  if (value.startsWith("lingering_") || value.includes("_lingering_potion")) return "lingering";
  return "normal";
}

function inferEffectId(value: string): string {
  return value
    .replace(/^splash_/, "")
    .replace(/^lingering_/, "")
    .replace(/^potion_/, "")
    .replace(/_potion$/, "");
}

function parseEncodedLabel(label: unknown): {
  deliveryType?: PotionDeliveryType;
  effectId?: string;
  level?: "I" | "II";
  data?: number;
} {
  const parts = String(label ?? "").split(":");
  if (parts[0] !== "potion") return {};

  const deliveryType = parts[1] as PotionDeliveryType;
  const level = parts[3] === "II" ? "II" : parts[3] === "I" ? "I" : undefined;
  const parsedData = Number(parts[4]);

  return {
    deliveryType: deliveryType === "splash" || deliveryType === "lingering" || deliveryType === "normal"
      ? deliveryType
      : undefined,
    effectId: normalize(parts[2]) || undefined,
    level,
    data: Number.isInteger(parsedData) && parsedData >= 0 ? parsedData : undefined,
  };
}

/**
 * Reconstrói os dados necessários para que o addon entregue uma poção real.
 * `option` permite aproveitar metadados que já estejam salvos no item
 * configurável; o fallback pelo ID mantém compatibilidade com pedidos antigos.
 */
export function getPotionMetadata(
  minecraftId: unknown,
  configLabel?: unknown,
  option?: Record<string, unknown>,
): PotionMetadata | null {
  const encoded = parseEncodedLabel(configLabel);
  const optionId = normalize(option?.id);
  const rawId = optionId || normalize(minecraftId);
  const effectId = encoded.effectId || inferEffectId(rawId);
  const definition = POTION_DEFINITIONS[effectId];

  if (!definition) return null;

  const optionType = normalize(option?.potionType) as PotionDeliveryType;
  const deliveryType = encoded.deliveryType || (
    optionType === "splash" || optionType === "lingering" || optionType === "normal"
      ? optionType
      : inferDeliveryType(rawId)
  );
  const level = encoded.level || (option?.level === "II" ? "II" : option?.level === "I" ? "I" : undefined);
  const optionData = Number(option?.data);
  const data = encoded.data ?? (
    Number.isInteger(optionData) && optionData >= 0
      ? optionData
      : level === "II" && definition.levelII !== undefined
        ? definition.levelII
        : definition.levelI
  );

  return {
    itemId: deliveryType === "normal" ? "potion" : `${deliveryType}_potion`,
    data,
    effectId,
    deliveryType,
    level,
  };
}

export function findPotionOption(
  kitItems: Array<{ itemConfig?: string | null }>,
  minecraftId: string,
): Record<string, unknown> | undefined {
  for (const kitItem of kitItems) {
    if (!kitItem.itemConfig) continue;
    try {
      const config = JSON.parse(kitItem.itemConfig);
      if (config?.type !== "potion" || !Array.isArray(config.options)) continue;
      const option = config.options.find((candidate: any) => normalize(candidate?.id) === normalize(minecraftId));
      if (option) return option as Record<string, unknown>;
    } catch {
      // Configuração inválida não deve impedir a entrega dos outros itens.
    }
  }
  return undefined;
}

export const potionDefinitions = POTION_DEFINITIONS;
