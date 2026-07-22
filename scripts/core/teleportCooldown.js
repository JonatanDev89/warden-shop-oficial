import { isAdmin } from "./moduleState.js";

const COLOR = "\u00a7";
const DEFAULT_COOLDOWN_MS = 5 * 1000;
const cooldowns = new Map();

export function hasTeleportCooldownBypass(player) {
    return isAdmin(player);
}

export function getTeleportDelaySeconds(player, fallbackSeconds = 5) {
    return hasTeleportCooldownBypass(player) ? 0 : fallbackSeconds;
}

export function tryUseTeleportCooldown(player, label = "teleporte", cooldownMs = DEFAULT_COOLDOWN_MS) {
    if (!player || hasTeleportCooldownBypass(player)) return true;

    const key = player.id ?? player.name;
    if (!key) return true;

    const now = Date.now();
    const lastUse = cooldowns.get(key) ?? 0;
    const remaining = cooldownMs - (now - lastUse);

    if (remaining > 0) {
        player.sendMessage(`${COLOR}cAguarde ${COLOR}e${Math.ceil(remaining / 1000)}s ${COLOR}cpara usar ${label} novamente.`);
        return false;
    }

    cooldowns.set(key, now);
    return true;
}
