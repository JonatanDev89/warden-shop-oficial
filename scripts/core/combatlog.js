import { world, system, GameMode } from "@minecraft/server";
import { getAdminSetting, isModuleEnabled } from "./moduleState.js";
import { getTeamSystem } from "../clan/teamManager.js";
import { TopPlayers } from "./topPlayers.js";
import { tryRunCommand } from "./commandUtils.js";
import { getOnlinePlayers, isValidEntity } from "./scriptCompat.js";

const COMBAT_TICK_INTERVAL = 10;
const COMBAT_TIME_KEY = "labsdev:combat_time";
const IN_COMBAT_KEY = "labsdev:in_combat";
const IN_COMBAT_TAG = "labsdev_in_combat";
const PUNISH_KEY = "labsdev:punish";
const PREFIX = "§8§l[§b§lLabsDev§8§l]§r";

const activeCombat = new Map();
let cachedSafeZones = [];
let lastSafeZoneUpdate = 0;

function updateSafeZoneCache() {
    const now = Date.now();
    if (now - lastSafeZoneUpdate < 10000 && cachedSafeZones.length > 0) return cachedSafeZones;
    const spawn = getAdminSetting("spawn");
    const safezones = getAdminSetting("safezones");
    const zones = [{
        x: Number(spawn.x) || 0, y: Number(spawn.y) || 0, z: Number(spawn.z) || 0,
        radius: Number(spawn.radius) || 0, dimension: spawn.dimension || "minecraft:overworld"
    }];
    if (Array.isArray(safezones?.zones)) {
        safezones.zones.forEach(z => zones.push({ x: Number(z.x), y: Number(z.y), z: Number(z.z), radius: Number(z.radius), dimension: z.dimension || "minecraft:overworld" }));
    }
    cachedSafeZones = zones.filter(z => z.radius > 0);
    lastSafeZoneUpdate = now;
    return cachedSafeZones;
}

function isInSafeZone(player) {
    const zones = updateSafeZoneCache();
    const loc = player.location;
    if (!loc) return false;
    const dim = player.dimension.id;
    return zones.some(z => z.dimension === dim && (Math.pow(loc.x - z.x, 2) + Math.pow(loc.y - z.y, 2) + Math.pow(loc.z - z.z, 2)) <= Math.pow(z.radius, 2));
}

function setCombatState(player, expiresAt, attackerId = null) {
    const current = activeCombat.get(player.id);
    if (current && expiresAt - current.expiresAt < 2000) return; 
    activeCombat.set(player.id, { expiresAt, attackerId });
    player.setDynamicProperty(COMBAT_TIME_KEY, expiresAt);
    player.setDynamicProperty(IN_COMBAT_KEY, true);
    if (!current) {
        player.onScreenDisplay.setActionBar("§c§lCOMBATE INICIADO!");
        try { player.addTag(IN_COMBAT_TAG); } catch {}
    }
}

function clearCombatState(player) {
    activeCombat.delete(player.id);
    player.setDynamicProperty(COMBAT_TIME_KEY, undefined);
    player.setDynamicProperty(IN_COMBAT_KEY, false);
    try { player.removeTag(IN_COMBAT_TAG); } catch {}
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    if (!isModuleEnabled("combatlog")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    if (attacker?.typeId !== "minecraft:player" || victim?.typeId !== "minecraft:player") return;
    if (isModuleEnabled("clan") && getTeamSystem()?.isTeam(attacker, victim)) return;
    const settings = getAdminSetting("combatlog");
    if (settings.disableInSpawn && (isInSafeZone(attacker) || isInSafeZone(victim))) return;
    const expiresAt = Date.now() + (settings.seconds || 20) * 1000;
    setCombatState(attacker, expiresAt, victim.id);
    setCombatState(victim, expiresAt, attacker.id);
});

system.runInterval(() => {
    if (!isModuleEnabled("combatlog") || activeCombat.size === 0) return;
    const now = Date.now();
    const settings = getAdminSetting("combatlog");
    
    // OTIMIZAÇÃO: Só percorre jogadores que REALMENTE estão em combate
    for (const player of world.getPlayers()) {
        const data = activeCombat.get(player.id);
        if (!data) continue;
        
        if (settings.disableInSpawn && isInSafeZone(player)) { 
            clearCombatState(player); 
            continue; 
        }
        
        const remaining = Math.ceil((data.expiresAt - now) / 1000);
        if (remaining > 0) {
            player.onScreenDisplay.setActionBar(`§8[ §f§l${remaining}s §7restantes §8]`);
        } else {
            clearCombatState(player);
            player.sendMessage(`${PREFIX} §aVocê não está mais em combate.`);
        }
    }
}, COMBAT_TICK_INTERVAL);

world.beforeEvents.playerLeave.subscribe((event) => {
    if (!isModuleEnabled("combatlog")) return;
    const player = event.player;
    const settings = getAdminSetting("combatlog");
    if (!settings.punishOnLogout) return;
    const expiresAt = Number(player.getDynamicProperty(COMBAT_TIME_KEY) || 0);
    if (expiresAt <= Date.now()) return;
    const combatData = activeCombat.get(player.id);
    if (combatData?.attackerId) {
        const attacker = world.getAllPlayers().find(p => p.id === combatData.attackerId);
        if (attacker) {
            const attackerRef = attacker;
            const victimRef = player;
            system.run(() => TopPlayers.handleKill(attackerRef, victimRef));
        }
    }
    if (settings.dropItems) {
        const inv = player.getComponent("minecraft:inventory")?.container;
        const loc = { x: player.location.x, y: player.location.y, z: player.location.z };
        const dim = player.dimension;
        if (inv) {
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item) { 
                    const itemStack = item.clone();
                    system.run(() => {
                        try { dim.spawnItem(itemStack, loc); } catch(e) {}
                    }); 
                    // NÃO usamos setItem(i, undefined) aqui para evitar ReferenceError na saída
                }
            }
        }
        // Equipamentos (armaduras)
        const equippable = player.getComponent("minecraft:equippable");
        if (equippable) {
            const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
            for (const slot of slots) {
                const item = equippable.getEquipment(slot);
                if (item) {
                    const itemStack = item.clone();
                    system.run(() => {
                        try { dim.spawnItem(itemStack, loc); } catch(e) {}
                    });
                    // NÃO usamos setEquipment(slot, undefined) aqui para evitar ReferenceError na saída
                }
            }
        }
    }
    player.setDynamicProperty(PUNISH_KEY, true);
    world.sendMessage(`${PREFIX} §f${player.name} §7deslogou em combate!`);
});

world.afterEvents.entityDie.subscribe((event) => {
    if (!isModuleEnabled("top_players")) return;
    const victim = event.deadEntity;
    const attacker = event.damageSource?.damagingEntity;

    if (victim?.typeId === "minecraft:player" && attacker?.typeId === "minecraft:player") {
        system.run(() => {
            if (isValidEntity(attacker) && isValidEntity(victim)) {
                TopPlayers.handleKill(attacker, victim);
            }
        });
    }
});

world.afterEvents.playerLeave.subscribe((event) => {
    if (!isModuleEnabled("combatlog") || !event.initialSpawn) return;
    const player = event.player;
    
    // Delay de 2 segundos (40 ticks) para garantir que o player carregou o inventário e a posição
    system.runTimeout(() => {
        // Usando a verificação de validade robusta do próprio plugin
        if (!isValidEntity(player)) return;
        
        // Verifica se o jogador tem a propriedade de punição salva
        const shouldPunish = player.getDynamicProperty(PUNISH_KEY);
        if (shouldPunish) {
            const settings = getAdminSetting("combatlog");
            
            // 1. Limpeza Garantida do Inventário (Se configurado)
            if (settings.dropItems) {
                try {
                    const inv = player.getComponent("minecraft:inventory")?.container;
                    if (inv) {
                        for (let i = 0; i < inv.size; i++) {
                            try { inv.setItem(i, undefined); } catch(e) {}
                        }
                    }
                    const equippable = player.getComponent("minecraft:equippable");
                    if (equippable) {
                        const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
                        for (const slot of slots) {
                            try { equippable.setEquipment(slot, undefined); } catch(e) {}
                        }
                    }
                } catch (e) {}
            }

            // 2. Morte Garantida via Método Estável do Plugin
            if (settings.killOnJoin) {
                try {
                    // Usando o tryRunCommand que já existe no plugin para máxima segurança
                    tryRunCommand(player, "kill @s");
                    player.sendMessage(`${PREFIX} §cVocê foi morto por deslogar em combate!`);
                } catch (e) {
                    // Fallback para comando via dimensão se o player falhar
                    try { player.dimension.runCommand(`kill "${player.name}"`); } catch (e2) {}
                }
            }
            
            // 3. Limpa o estado de punição
            player.setDynamicProperty(PUNISH_KEY, false);
            clearCombatState(player);
        }
    }, 40);
});
