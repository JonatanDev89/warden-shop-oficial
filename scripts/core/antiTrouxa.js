import { world, system } from "@minecraft/server";
import { isModuleEnabled } from "./moduleState.js";
import { getOnlinePlayers, isValidEntity } from "./scriptCompat.js";

const COLOR = "\u00a7";
const MODULE_ID = "antitrouxa";
const PREFIX = `${COLOR}8[${COLOR}cAntiTrouxa${COLOR}8]${COLOR}r`;
const PLAYER_SCAN_INTERVAL = 1200; // Aumentado para 60s (Varredura de fundo leve)
const PLAYER_WARNING_COOLDOWN = 5000;
const MAX_NESTED_CONTAINER_DEPTH = 3; // Reduzido para economizar CPU

const TROUXA_TYPE_IDS = new Set([
    "minecraft:bundle", "minecraft:white_bundle", "minecraft:light_gray_bundle", "minecraft:gray_bundle",
    "minecraft:black_bundle", "minecraft:brown_bundle", "minecraft:red_bundle", "minecraft:orange_bundle",
    "minecraft:yellow_bundle", "minecraft:lime_bundle", "minecraft:green_bundle", "minecraft:cyan_bundle",
    "minecraft:light_blue_bundle", "minecraft:blue_bundle", "minecraft:purple_bundle", "minecraft:magenta_bundle", "minecraft:pink_bundle"
]);

const lastPlayerWarning = new Map();

function getInventoryContainer(target) {
    try { return target?.getComponent("minecraft:inventory")?.container ?? null; } catch { return null; }
}

function getEnderInventoryContainer(player) {
    try { return player?.getComponent("minecraft:ender_inventory")?.container ?? null; } catch { return null; }
}

function getItemStorageContainer(item) {
    try { return item?.getComponent("minecraft:inventory")?.container ?? null; } catch { return null; }
}

// Função principal de limpeza (Otimizada)
function removeTrouxasFromContainer(container, depth = 0) {
    if (!container || depth > MAX_NESTED_CONTAINER_DEPTH) return 0;
    let removed = 0;
    try {
        const size = container.size;
        for (let slot = 0; slot < size; slot++) {
            const item = container.getItem(slot);
            if (!item) continue;
            
            // Verifica se é uma trouxa/bundle
            if (TROUXA_TYPE_IDS.has(item.typeId) || item.typeId.endsWith("_bundle")) {
                container.setItem(slot, undefined);
                removed += item.amount;
                continue;
            }
            
            // Verifica dentro de itens que podem ter inventário (Shulkers, etc)
            const nested = getItemStorageContainer(item);
            if (nested) {
                const r = removeTrouxasFromContainer(nested, depth + 1);
                if (r > 0) { 
                    removed += r; 
                    container.setItem(slot, item); 
                }
            }
        }
    } catch {}
    return removed;
}

function warnPlayer(player, removed) {
    if (!player || removed <= 0) return;
    const now = Date.now();
    if (now - (lastPlayerWarning.get(player.id) || 0) < PLAYER_WARNING_COOLDOWN) return;
    lastPlayerWarning.set(player.id, now);
    player.sendMessage(`${PREFIX} ${COLOR}cItens proibidos (Trouxas) foram removidos para evitar lag.`);
}

function scanPlayer(player, shouldWarn = true) {
    if (!isValidEntity(player)) return 0;
    // Limpa inventário normal e Ender Chest
    const removed = removeTrouxasFromContainer(getInventoryContainer(player)) + 
                    removeTrouxasFromContainer(getEnderInventoryContainer(player));
    if (shouldWarn) warnPlayer(player, removed);
    return removed;
}

// --- EVENTOS REATIVOS (Gasta CPU apenas quando algo acontece) ---

// Quando o jogador nasce ou entra
world.afterEvents.playerSpawn.subscribe(ev => { 
    if (isModuleEnabled(MODULE_ID)) system.run(() => scanPlayer(ev.player)); 
});

// Quando o jogador tenta usar um item (se for trouxa, cancela e limpa)
world.beforeEvents.itemUse.subscribe(ev => {
    if (isModuleEnabled(MODULE_ID) && (TROUXA_TYPE_IDS.has(ev.itemStack.typeId) || ev.itemStack.typeId.endsWith("_bundle"))) {
        ev.cancel = true;
        system.run(() => scanPlayer(ev.source));
    }
});

// Quando o jogador abre um baú, funil, etc (Limpa o bloco e o player na hora)
world.afterEvents.playerInteractWithBlock.subscribe(ev => {
    if (!isModuleEnabled(MODULE_ID)) return;
    system.run(() => {
        scanPlayer(ev.player);
        const container = ev.block.getComponent("minecraft:inventory")?.container;
        if (container) removeTrouxasFromContainer(container);
    });
});

// Quando um item nasce no chão (se for trouxa, remove na hora)
world.afterEvents.entitySpawn.subscribe(ev => {
    if (!isModuleEnabled(MODULE_ID)) return;
    if (ev.entity.typeId === "minecraft:item") {
        system.run(() => {
            if (!isValidEntity(ev.entity)) return;
            const item = ev.entity.getComponent("minecraft:item")?.itemStack;
            if (item && (TROUXA_TYPE_IDS.has(item.typeId) || item.typeId.endsWith("_bundle"))) {
                ev.entity.remove();
            }
        });
    }
});

// Loop de fundo muito lento apenas para garantir (1 vez por minuto)
system.runInterval(() => { 
    if (isModuleEnabled(MODULE_ID)) {
        getOnlinePlayers().forEach(p => scanPlayer(p, false)); 
    }
}, PLAYER_SCAN_INTERVAL);
