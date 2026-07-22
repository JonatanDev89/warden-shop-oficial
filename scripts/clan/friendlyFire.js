import { system, world } from "@minecraft/server";
import { isModuleEnabled } from "../core/moduleState.js";
import { getTeamSystem } from "./teamManager.js";

const MESSAGE_COOLDOWN_MS = 2000;

const lastWarn = new Map();

function getProjectileOwner(entity) {
    try {
        const projectile = entity?.getComponent?.("minecraft:projectile");
        return projectile?.owner ?? projectile?.source ?? null;
    } catch {
        return null;
    }
}

function getAttackingPlayer(event) {
    const source = event.damageSource;
    const directDamager = source?.damagingEntity ?? event.damagingEntity ?? null;

    if (directDamager?.typeId === "minecraft:player") {
        return directDamager;
    }

    const projectile = source?.damagingProjectile ?? directDamager;
    const projectileOwner = getProjectileOwner(projectile);

    return projectileOwner?.typeId === "minecraft:player" ? projectileOwner : null;
}

function warnAttacker(player) {
    const now = Date.now();
    const last = lastWarn.get(player.id) ?? 0;

    if (now - last < MESSAGE_COOLDOWN_MS) return;

    lastWarn.set(player.id, now);
    system.run(() => {
        try {
            player.sendMessage("\u00a7cVoce nao pode atacar membros do seu clan.");
        } catch {}
    });
}

world.beforeEvents.entityHurt.subscribe((event) => {
    if (!isModuleEnabled("clan")) return;

    const victim = event.hurtEntity;
    if (victim?.typeId !== "minecraft:player") return;

    const attacker = getAttackingPlayer(event);
    if (!attacker || attacker.id === victim.id) return;

    const teamSystem = getTeamSystem();
    if (!teamSystem?.isTeam(attacker, victim)) return;

    event.cancel = true;
    warnAttacker(attacker);
});

world.beforeEvents.playerLeave.subscribe((event) => {
    if (event.player?.id) {
        lastWarn.delete(event.player.id);
    }
});
