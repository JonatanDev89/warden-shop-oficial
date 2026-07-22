import { world } from "@minecraft/server";
import { getAdminSetting } from "./moduleState.js";
import { applyKnockbackCompat } from "./scriptCompat.js";

function getNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function getDimensionId(value) {
    const id = String(value || "minecraft:overworld");
    return id.startsWith("minecraft:") ? id : `minecraft:${id}`;
}

// OTIMIZAÇÃO: Cache de Spawn para não ler disco a cada hit
let spawnCache = null;
let lastSpawnUpdate = 0;

function isInSpawn(x, y, z, dimensionId) {
    const now = Date.now();
    if (!spawnCache || now - lastSpawnUpdate > 10000) {
        const spawn = getAdminSetting("spawn");
        spawnCache = {
            x: getNumber(spawn.x, 213.71),
            y: getNumber(spawn.y, 67.5),
            z: getNumber(spawn.z, 946.33),
            radius: Math.max(0, getNumber(spawn.radius, 100)),
            dimension: getDimensionId(spawn.dimension)
        };
        lastSpawnUpdate = now;
    }

    if (getDimensionId(dimensionId) !== spawnCache.dimension) return false;
    const dx = x - spawnCache.x, dy = y - spawnCache.y, dz = z - spawnCache.z;
    return (dx * dx + dy * dy + dz * dz) <= (spawnCache.radius * spawnCache.radius);
}

function isKnockbackSupported(entity) {
    if (!entity) return false;
    const typeId = entity.typeId ?? "";
    const unsupportedTypes = [
        "minecraft:item", "minecraft:arrow", "minecraft:snowball", "minecraft:egg", "minecraft:fireball",
        "minecraft:small_fireball", "minecraft:dragon_fireball", "minecraft:wither_skull", "minecraft:wither_skull_dangerous",
        "minecraft:shulker_bullet", "minecraft:llama_spit", "minecraft:ender_pearl", "minecraft:thrown_trident",
        "minecraft:fishing_hook", "minecraft:xp_orb", "minecraft:xp_bottle", "minecraft:eye_of_ender_signal",
        "minecraft:ender_crystal", "minecraft:boat", "minecraft:chest_boat", "minecraft:minecart", "minecraft:chest_minecart",
        "minecraft:hopper_minecart", "minecraft:tnt_minecart", "minecraft:command_block_minecart", "minecraft:tnt",
        "minecraft:falling_block", "minecraft:painting", "minecraft:leash_knot", "minecraft:armor_stand", "minecraft:area_effect_cloud",
    ];
    return !unsupportedTypes.includes(typeId);
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    try {
        const attacker = event.damagingEntity;
        const target = event.hitEntity;
        if (!attacker || !target || attacker.typeId !== "minecraft:player") return;
        if (!isKnockbackSupported(target)) return;
        const loc = attacker.location;
        if (isInSpawn(loc.x, loc.y, loc.z, attacker.dimension.id)) return;
        applyKnockbackCompat(target, attacker.getViewDirection(), 0.99, 0.11);
    } catch (error) {
        console.warn("[KBSystem] Erro: " + error);
    }
});
