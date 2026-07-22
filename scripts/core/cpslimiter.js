import { world, system } from "@minecraft/server";
import { isModuleEnabled } from "./moduleState.js";
import { getOnlinePlayers } from "./scriptCompat.js";

const MAX_CPS = 25;
const WINDOW_MS = 1000;
const PUNISH_SECONDS = 8;
const MESSAGE_COOLDOWN_MS = 3000;
const PUNISH_COOLDOWN_MS = 4000;

const playerClicks = new Map();

function getState(playerId) {
    let state = playerClicks.get(playerId);

    if (!state) {
        state = {
            timestamps: [],
            lastWarnAt: 0,
            lastPunishAt: 0,
        };
        playerClicks.set(playerId, state);
    }

    return state;
}

function pruneTimestamps(state, now) {
    const recent = state.timestamps.filter((timestamp) => now - timestamp <= WINDOW_MS);
    state.timestamps = recent;
    return recent.length;
}

function registerClick(player) {
    const now = Date.now();
    const state = getState(player.id);

    state.timestamps.push(now);
    return {
        cps: pruneTimestamps(state, now),
        state,
        now,
    };
}

function punish(player, cps, state, now) {
    if (now - state.lastPunishAt < PUNISH_COOLDOWN_MS) return;

    state.lastPunishAt = now;

    try {
        player.addEffect("weakness", PUNISH_SECONDS * 20, {
            amplifier: 2,
            showParticles: false,
        });
    } catch {}

    if (now - state.lastWarnAt >= MESSAGE_COOLDOWN_MS) {
        state.lastWarnAt = now;
        player.sendMessage(`§cCPS alto detectado (${cps}). Fraqueza aplicada.`);
    }
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    if (!isModuleEnabled("cpslimiter")) return;

    const player = event.damagingEntity;
    if (player?.typeId !== "minecraft:player") return;

    const { cps, state, now } = registerClick(player);
    if (cps > MAX_CPS) {
        punish(player, cps, state, now);
    }
});

system.runInterval(() => {
    if (!isModuleEnabled("cpslimiter")) return;

    const now = Date.now();
    const onlineIds = new Set(getOnlinePlayers().map((player) => player.id));

    for (const [playerId, state] of playerClicks.entries()) {
        pruneTimestamps(state, now);

        const stale = state.timestamps.length === 0 && now - state.lastPunishAt > WINDOW_MS;
        if (!onlineIds.has(playerId) || stale) {
            playerClicks.delete(playerId);
        }
    }
}, 100);
