import { describe, expect, it } from "vitest";
import { findPotionOption, getPotionMetadata } from "./addon-potions";

describe("addon potion metadata", () => {
  it("converts a legacy normal potion id to a Bedrock item and data value", () => {
    expect(getPotionMetadata("regeneration_potion")).toEqual({
      itemId: "potion",
      data: 28,
      effectId: "regeneration",
      deliveryType: "normal",
    });
  });

  it("supports splash and lingering potion ids", () => {
    expect(getPotionMetadata("splash_strength_potion")).toMatchObject({
      itemId: "splash_potion",
      data: 31,
      effectId: "strength",
      deliveryType: "splash",
    });
    expect(getPotionMetadata("lingering_healing_potion")).toMatchObject({
      itemId: "lingering_potion",
      data: 21,
      effectId: "healing",
      deliveryType: "lingering",
    });
  });

  it("honors explicit data and level encoded for a newly created order", () => {
    expect(getPotionMetadata("strength_potion", "potion:normal:strength:II:33")).toEqual({
      itemId: "potion",
      data: 33,
      effectId: "strength",
      deliveryType: "normal",
      level: "II",
    });
  });

  it("finds potion options inside the configurable kit item", () => {
    const option = findPotionOption([
      {
        itemConfig: JSON.stringify({
          type: "potion",
          options: [{ id: "regeneration_potion", name: "Regeneração", data: 28 }],
        }),
      },
    ], "regeneration_potion");

    expect(option).toMatchObject({ id: "regeneration_potion", data: 28 });
  });

  it("returns null for an unknown non-potion item", () => {
    expect(getPotionMetadata("diamond_sword")).toBeNull();
  });
});
