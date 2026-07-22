import { world, system } from "@minecraft/server";
import { getAdminSetting, isModuleEnabled } from "./moduleState.js";
import { getOnlinePlayers } from "./scriptCompat.js";

const CHECK_INTERVAL = 10; // OTIMIZAÇÃO: 0.5s (era 0.25s)
const CLEANUP_INTERVAL = 60; // OTIMIZAÇÃO: 3s para remoção de monstros (era 1s)
const DIMENSIONS = ["overworld", "nether", "the_end"];

const inside = new Map();

function getSafeZones() {
    const spawn = getAdminSetting("spawn");
    const safezones = getAdminSetting("safezones");
    const zones = [
        {
            id: "spawn",
            name: "Spawn",
            x: Number(spawn.x) || 0,
            y: Number(spawn.y) || 0,
            z: Number(spawn.z) || 0,
            radius: Number(spawn.radius) || 0,
            dimension: spawn.dimension || "overworld",
            protectPvp: spawn.protectPvp !== false,
            protectExplosion: spawn.protectExplosion !== false,
            blockBuckets: spawn.blockBuckets !== false,
            blockInteract: spawn.blockInteract !== false,
            allowStaffBuild: spawn.allowStaffBuild === true, // Corrigido: Apenas staff constrói se for true
            removeEntities: spawn.removeEntities !== false,
            entryMsg: spawn.entryMsg || "§a✔ Você entrou na Safe Zone",
            exitMsg: spawn.exitMsg || "§c✖ Você saiu da Safe Zone",
            builtin: true
        }
    ];

    if (Array.isArray(safezones.zones)) {
        safezones.zones.forEach((z, i) => {
            zones.push({
                index: i,
                id: z.id || `zone_${i}`,
                name: z.name || `SafeZone ${i + 1}`,
                x: Number(z.x) || 0,
                y: Number(z.y) || 0,
                z: Number(z.z) || 0,
                radius: Number(z.radius) || 0,
                dimension: z.dimension || "overworld",
                protectPvp: z.protectPvp !== false,
                protectExplosion: z.protectExplosion !== false,
                blockBuckets: z.blockBuckets !== false,
                blockInteract: z.blockInteract !== false,
                allowStaffBuild: z.allowStaffBuild === true,
                removeEntities: z.removeEntities !== false,
                entryMsg: z.entryMsg || "§a✔ Você entrou na Safe Zone",
                exitMsg: z.exitMsg || "§c✖ Você saiu da Safe Zone"
            });
        });
    }
    return zones.filter(z => z.radius > 0);
}

// Verifica se uma POSIÇÃO (não apenas entidade) está dentro da zona
function isPosInsideZone(location, dimensionId, zone) {
    if (!location) return false;
    const entDim = dimensionId.replace("minecraft:", "");
    const zoneDim = zone.dimension.replace("minecraft:", "");
    if (entDim !== zoneDim) return false;

    const dx = Math.abs(location.x - zone.x);
    const dy = Math.abs(location.y - zone.y);
    const dz = Math.abs(location.z - zone.z);

    return dx <= zone.radius && dy <= zone.radius && dz <= zone.radius;
}

function getZoneAtPos(location, dimensionId) {
    return getSafeZones().find(zone => isPosInsideZone(location, dimensionId, zone)) || null;
}

function isStaff(player) {
    if (!player) return false;
    // Tags sincronizadas com o ADMIN_TAGS do moduleState.js + verificação de Creative
    const adminTags = [
        "admin", "adm", "owner", "dono", "staff", "mod", "moderador", "op", "dev", "developer", "helper", "suporte", "support", "builder",
        "rank_owner", "rank_dev", "rank_admin", "rank_mod", "rank_staff_access", "rank_support", "rank_helper", "rank_staff", "rank_builder"
    ];
    const hasAdminTag = adminTags.some(tag => player.hasTag(tag));
    const isCreative = player.getGameMode?.() === "creative" || player.gameMode === "creative";
    
    return hasAdminTag || isCreative;
}

function getEventDimensionId(ev) {
    return ev?.dimension?.id || ev?.block?.dimension?.id || ev?.player?.dimension?.id || "minecraft:overworld";
}

system.runInterval(() => {
    if (!isModuleEnabled("safezone")) return;

    const players = world.getPlayers();
    if (players.length === 0) return;

    const zones = getSafeZones();
    if (zones.length === 0) return;

    for (const player of players) {
        const zone = zones.find(z => isPosInsideZone(player.location, player.dimension.id, z)) || null;
        const nowInside = !!zone;
        const wasInside = inside.get(player.id) || false;

        if (nowInside !== wasInside) {
            const msg = nowInside ? (zone.entryMsg || "§a✔ Você entrou na Safe Zone") : (inside.get(player.id + "_lastMsg") || "§c✖ Você saiu da Safe Zone");
            player.onScreenDisplay.setActionBar(msg);
            inside.set(player.id, nowInside);
            if (nowInside) inside.set(player.id + "_lastMsg", zone.exitMsg);
        }
        
        if (nowInside && zone.protectPvp) {
            if (!player.hasTag("pvp_off")) player.addTag("pvp_off");
        } else {
            if (player.hasTag("pvp_off")) player.removeTag("pvp_off");
        }
    }
}, CHECK_INTERVAL);

// PROTEÇÃO DE BLOCO BASEADA NA POSIÇÃO DO BLOCO (MUITO MAIS PRECISA)
world.beforeEvents.playerBreakBlock.subscribe(ev => {
    if (!isModuleEnabled("safezone") || isStaff(ev.player) || !ev.block) return;
    // structure_block e structure_void nunca devem ser bloqueados pela safezone
    const blockType = ev.block.typeId || "";
    if (blockType.includes("structure_block") || blockType.includes("structure_void")) return;
    const zone = getZoneAtPos(ev.block.location, getEventDimensionId(ev));
    if (zone) ev.cancel = true; // Se o bloco está na zona, cancela.
});

world.beforeEvents.playerPlaceBlock.subscribe(ev => {
    if (!isModuleEnabled("safezone") || isStaff(ev.player) || !ev.block) return;
    // structure_block e structure_void nunca devem ser bloqueados pela safezone
    const blockType = ev.block.typeId || "";
    if (blockType.includes("structure_block") || blockType.includes("structure_void")) return;
    const zone = getZoneAtPos(ev.block.location, getEventDimensionId(ev));
    if (zone) ev.cancel = true;
});

world.beforeEvents.entityHurt.subscribe(ev => {
    if (!isModuleEnabled("safezone")) return;
    const victim = ev.hurtEntity;
    const zone = getZoneAtPos(victim.location, victim.dimension.id);
    if (!zone) return;

    if (victim.typeId === "minecraft:player" && zone.protectPvp) {
        ev.cancel = true;
        return;
    }

    if (ev.damageSource.cause === "entityExplosion" && zone.protectExplosion) {
        ev.cancel = true;
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
    if (!isModuleEnabled("safezone") || isStaff(ev.player) || !ev.block) return;
    const zone = getZoneAtPos(ev.block.location, getEventDimensionId(ev));
    if (!zone) return;

    const item = ev.itemStack?.typeId || "";
    const block = ev.block.typeId || "";

    if (zone.blockBuckets && (item.includes("bucket") || item.includes("flint_and_steel"))) {
        ev.cancel = true;
        return;
    }

    if (zone.blockInteract) {
        // structure_block e outros blocos técnicos nunca devem ser bloqueados
        const isTechnicalBlock = block.includes("structure_block") || 
                                block.includes("structure_void") || 
                                block.includes("command_block") || 
                                block.includes("jigsaw");
                                
        if (isTechnicalBlock) return;

        const containers = ["chest", "shulker", "barrel", "hopper", "furnace", "anvil", "dropper", "dispenser"];
        if (containers.some(c => block.includes(c))) {
            ev.cancel = true;
        }
    }
});

world.beforeEvents.explosion.subscribe(ev => {
    if (!isModuleEnabled("safezone")) return;
    const blocks = ev.getImpactedBlocks();
    const zones = getSafeZones().filter(z => z.protectExplosion);
    
    for (const b of blocks) {
        if (zones.some(z => isPosInsideZone(b.location, getEventDimensionId(ev), z))) {
            ev.cancel = true;
            break;
        }
    }
});

// REMOÇÃO ULTRA RÁPIDA DE MONSTROS (0.5 segundos)
system.runInterval(() => {
    if (!isModuleEnabled("safezone")) return;
    const zones = getSafeZones().filter(z => z.removeEntities);
    if (zones.length === 0) return;

    DIMENSIONS.forEach(dimId => {
        try {
            const dim = world.getDimension(dimId);
            for (const entity of dim.getEntities({ families: ["monster"] })) {
                if (zones.some(z => isPosInsideZone(entity.location, dimId, z))) {
                    entity.remove();
                }
            }
        } catch {}
    });
}, CLEANUP_INTERVAL);
