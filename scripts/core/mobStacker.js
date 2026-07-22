import { world, system } from "@minecraft/server";
import { getAdminSetting, isModuleEnabled } from "./moduleState.js";
import { isValidEntity } from "./scriptCompat.js";

const COLOR = "\u00a7";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const STACK_TAG_PREFIX = "labs_stack_";
const NO_STACK_TAG = "no_stack";
const DEFAULT_SCAN_TICKS = 100; // OTIMIZAÇÃO: Aumentado de 40 para 100 (5s)
const SPAWN_SCAN_DELAY_TICKS = 40;
const INITIAL_SCAN_DELAY_TICKS = 40;
const MAX_ALLOWED_STACK = 9999;
const STACK_NAME_MARKER = `${COLOR}7x${COLOR}f`;

const EXCLUDED_TYPE_IDS = new Set([
    "minecraft:player", "minecraft:item", "minecraft:xp_orb", "minecraft:area_effect_cloud",
    "minecraft:armor_stand", "minecraft:npc", "minecraft:ender_dragon", "minecraft:wither",
    "minecraft:boat", "minecraft:chest_boat", "minecraft:minecart", "minecraft:chest_minecart",
    "minecraft:command_block_minecart", "minecraft:hopper_minecart", "minecraft:tnt_minecart",
    "minecraft:painting", "minecraft:leash_knot", "minecraft:lightning_bolt", "minecraft:fireworks_rocket",
    "minecraft:arrow", "minecraft:thrown_trident", "minecraft:snowball", "minecraft:egg",
    "minecraft:ender_pearl", "minecraft:evocation_fang", "minecraft:wind_charge_projectile",
    "minecraft:breeze_wind_charge_projectile", "minecraft:fireball", "minecraft:small_fireball",
    "minecraft:dragon_fireball", "minecraft:wither_skull", "minecraft:wither_skull_dangerous",
    "minecraft:shulker_bullet", "minecraft:llama_spit", "minecraft:fishing_hook",
    "minecraft:villager", "minecraft:zombie_villager", "minecraft:villager_v2", "minecraft:zombie_villager_v2"
]);

const WHOLE_STACK_DEATH_CAUSES = new Set(["void", "suicide", "override", "none"]);
let scanTicks = 0;

function getNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function getMobStackerSettings() {
    const settings = getAdminSetting("mobstacker");
    return {
        radius: Math.max(1, getNumber(settings.radius, 6)),
        maxStack: Math.max(2, Math.min(MAX_ALLOWED_STACK, Math.floor(getNumber(settings.maxStack, 64)))),
        scanIntervalTicks: Math.max(600, Math.floor(getNumber(settings.scanIntervalSeconds, 30) * 20)), // OTIMIZAÇÃO: Mínimo 30s
        showNameTags: settings.showNameTags !== false,
        stackBabiesSeparately: settings.stackBabiesSeparately !== false,
    };
}

function getStackTag(entity) {
    try { return entity.getTags().find((tag) => String(tag).startsWith(STACK_TAG_PREFIX)) ?? ""; } catch { return ""; }
}

function getStackAmount(entity) {
    const tag = getStackTag(entity);
    const amount = Number(tag.slice(STACK_TAG_PREFIX.length));
    return Number.isFinite(amount) && amount > 1 ? Math.floor(amount) : 1;
}

function clearStackTags(entity) {
    try {
        for (const tag of entity.getTags()) {
            if (String(tag).startsWith(STACK_TAG_PREFIX)) entity.removeTag(tag);
        }
    } catch {}
}

function isStackName(nameTag) { return String(nameTag ?? "").includes(STACK_NAME_MARKER); }

function hasCustomName(entity) {
    const nameTag = String(entity?.nameTag ?? "").trim();
    return nameTag.length > 0 && !isStackName(nameTag) && getStackAmount(entity) <= 1;
}

function formatEntityName(typeId) {
    const cleanId = String(typeId ?? "").replace(/^minecraft:/, "").replace(/_/g, " ").trim();
    if (!cleanId) return "Mob";
    return cleanId.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function updateStackName(entity, amount, settings) {
    try {
        if (amount <= 1) {
            if (isStackName(entity.nameTag)) entity.nameTag = "";
            return;
        }
        entity.nameTag = settings.showNameTags ? `${COLOR}e${formatEntityName(entity.typeId)} ${STACK_NAME_MARKER}${amount}` : "";
    } catch {}
}

function setStackAmount(entity, amount, settings) {
    if (!isValidEntity(entity)) return false;
    const safeAmount = Math.max(1, Math.floor(getNumber(amount, 1)));
    clearStackTags(entity);
    try { if (safeAmount > 1) entity.addTag(`${STACK_TAG_PREFIX}${safeAmount}`); } catch {}
    updateStackName(entity, safeAmount, settings);
    return true;
}

function isStackableEntity(entity) {
    if (!isValidEntity(entity) || !entity.typeId || EXCLUDED_TYPE_IDS.has(entity.typeId)) return false;
    try { if (entity.hasTag(NO_STACK_TAG)) return false; } catch {}
    if (hasCustomName(entity)) return false;
    return !!entity.getComponent("minecraft:health");
}

function getMergeKey(entity, settings) {
    const babyKey = settings.stackBabiesSeparately && entity.getComponent("minecraft:is_baby") ? "baby" : "adult";
    return `${entity.typeId}|${babyKey}`;
}

function getDistanceSquared(left, right) {
    const dx = left.x - right.x, dy = left.y - right.y, dz = left.z - right.z;
    return (dx * dx) + (dy * dy) + (dz * dz);
}

function mergeInto(base, other, settings) {
    if (!isStackableEntity(base) || !isStackableEntity(other)) return "none";
    const baseAmount = getStackAmount(base);
    const otherAmount = getStackAmount(other);
    const capacity = settings.maxStack - baseAmount;
    if (capacity <= 0) return "none";
    const transfer = Math.min(capacity, otherAmount);
    if (transfer <= 0) return "none";
    if (otherAmount > transfer) {
        setStackAmount(base, baseAmount + transfer, settings);
        setStackAmount(other, otherAmount - transfer, settings);
        return "partial";
    }
    try { other.remove(); } catch { return "none"; }
    setStackAmount(base, baseAmount + transfer, settings);
    return "merged";
}

function stackEntityGroup(group, settings, maxDistanceSquared) {
    const anchors = [];
    for (const entity of group) {
        if (!isStackableEntity(entity)) continue;
        let handled = false;
        for (const anchor of anchors) {
            if (!isStackableEntity(anchor) || getStackAmount(anchor) >= settings.maxStack || getDistanceSquared(anchor.location, entity.location) > maxDistanceSquared) continue;
            const result = mergeInto(anchor, entity, settings);
            handled = result !== "none";
            if (result === "partial") anchors.push(entity);
            if (handled) break;
        }
        if (!handled) {
            setStackAmount(entity, getStackAmount(entity), settings);
            anchors.push(entity);
        }
    }
}

function stackDimension(dimension, settings) {
    const groups = new Map();
    let entities = [];
    try { entities = dimension.getEntities(); } catch { return; }
    for (const entity of entities) {
        if (!isStackableEntity(entity)) continue;
        const key = getMergeKey(entity, settings);
        const group = groups.get(key) ?? [];
        group.push(entity);
        groups.set(key, group);
    }
    const maxDistSq = settings.radius * settings.radius;
    for (const group of groups.values()) { if (group.length > 1) stackEntityGroup(group, settings, maxDistSq); }
}

function scanAllDimensions(settings) {
    for (const dimId of DIMENSIONS) { try { stackDimension(world.getDimension(dimId), settings); } catch {} }
}

function stackAroundEntity(entity, settings = getMobStackerSettings()) {
    if (!isStackableEntity(entity)) return;
    try {
        const candidates = entity.dimension.getEntities({ type: entity.typeId, location: entity.location, maxDistance: settings.radius });
        if (candidates.length <= 1) {
            setStackAmount(entity, getStackAmount(entity), settings);
            return;
        }
        stackEntityGroup(candidates, settings, settings.radius * settings.radius);
    } catch {}
}

// EVENTOS REATIVOS (OTIMIZADOS)
world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => { if (isModuleEnabled("mobstacker")) scanAllDimensions(getMobStackerSettings()); }, INITIAL_SCAN_DELAY_TICKS);
});

world.afterEvents.entitySpawn.subscribe((event) => {
    if (!isModuleEnabled("mobstacker")) return;
    system.runTimeout(() => { if (isValidEntity(event.entity)) stackAroundEntity(event.entity); }, SPAWN_SCAN_DELAY_TICKS);
});

world.afterEvents.entityDie.subscribe((event) => {
    if (!isModuleEnabled("mobstacker")) return;
    const dead = event.deadEntity;
    if (!dead || EXCLUDED_TYPE_IDS.has(dead.typeId)) return;
    const amount = getStackAmount(dead);
    if (amount <= 1 || WHOLE_STACK_DEATH_CAUSES.has(String(event.damageSource?.cause || "").toLowerCase())) return;
    
    const { typeId, dimension, location } = dead;
    system.run(() => {
        try {
            const next = dimension.spawnEntity(typeId, location);
            setStackAmount(next, amount - 1, getMobStackerSettings());
            system.runTimeout(() => { if (isValidEntity(next)) stackAroundEntity(next); }, 1);
        } catch {}
    });
});

// LOOP GLOBAL (MUITO MAIS LENTO PARA ECONOMIZAR CPU)
system.runInterval(() => {
    if (!isModuleEnabled("mobstacker")) return;
    const settings = getMobStackerSettings();
    scanTicks += DEFAULT_SCAN_TICKS;
    if (scanTicks < settings.scanIntervalTicks) return;
    scanTicks = 0;
    scanAllDimensions(settings);
}, DEFAULT_SCAN_TICKS);
