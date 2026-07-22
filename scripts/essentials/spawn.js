import {
    CommandPermissionLevel,
    CustomCommandStatus,
    system,
    world,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { getAdminSetting, isModuleEnabled } from "../core/moduleState.js";
import { getCommandSourceEntity, isValidEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";

const COLOR = "\u00a7";
const SPAWN_DELAY_SECONDS = 5;
const IN_COMBAT_KEY = "labsdev:in_combat";
const IN_COMBAT_TAG = "labsdev_in_combat";

function getNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function getCommandPlayer(origin) {
    return getCommandSourceEntity(origin);
}

function getSpawnDimension(dimensionId) {
    const id = String(dimensionId || "minecraft:overworld");
    const candidates = [
        id,
        id.replace("minecraft:", ""),
        id.startsWith("minecraft:") ? id : `minecraft:${id}`,
    ];

    for (const candidate of candidates) {
        try {
            return world.getDimension(candidate);
        } catch {}
    }

    return world.getDimension("overworld");
}

function hasMoved(player, startLoc) {
    const loc = player.location;
    return (
        Math.floor(loc.x) !== Math.floor(startLoc.x) ||
        Math.floor(loc.y) !== Math.floor(startLoc.y) ||
        Math.floor(loc.z) !== Math.floor(startLoc.z)
    );
}

function isInCombat(player) {
    return player?.getDynamicProperty(IN_COMBAT_KEY) === true || player?.hasTag(IN_COMBAT_TAG);
}

function teleportToSpawn(player) {
    if (!isModuleEnabled("spawn")) return;
    if (!player) return;

    if (isInCombat(player)) {
        player.sendMessage(`${COLOR}cVoce esta em combate.`);
        return;
    }

    if (!tryUseTeleportCooldown(player, "/labsdev:spawn")) return;

    const spawn = getAdminSetting("spawn");
    const destination = {
        x: getNumber(spawn.x, 213.71),
        y: getNumber(spawn.y, 67.5),
        z: getNumber(spawn.z, 946.33),
    };
    const dimension = getSpawnDimension(spawn.dimension);
    const startLoc = player.location;
    const delaySeconds = getTeleportDelaySeconds(player, SPAWN_DELAY_SECONDS);

    if (delaySeconds <= 0) {
        player.teleport(destination, { dimension });
        player.sendMessage(`${COLOR}aTeleportado para o spawn.`);
        return;
    }

    function tick(remaining) {
        if (!isValidEntity(player)) return;
        if (!isModuleEnabled("spawn")) return;

        if (hasMoved(player, startLoc)) {
            player.sendMessage(`${COLOR}cSpawn cancelado por movimento.`);
            return;
        }

        if (remaining <= 0) {
            player.teleport(destination, { dimension });
            player.sendMessage(`${COLOR}aTeleportado para o spawn.`);
            return;
        }

        player.onScreenDisplay.setActionBar(`${COLOR}eTeleportando em ${COLOR}f${remaining}s`);
        system.runTimeout(() => tick(remaining - 1), 20);
    }

    tick(delaySeconds);
}

function registerCommandSafe(registry, name) {
    try {
        registry.registerCommand(
            {
                name,
                description: "Ir para o spawn",
                permissionLevel: CommandPermissionLevel.Any,
                cheatsRequired: false,
            },
            (origin) => {
                if (!isModuleEnabled("spawn")) {
                    return { status: CustomCommandStatus.Failure, message: "Sistema de spawn desativado." };
                }

                const player = getCommandPlayer(origin);
                if (!player) {
                    return { status: CustomCommandStatus.Failure, message: "Somente jogadores." };
                }

                system.run(() => teleportToSpawn(player));
                return { status: CustomCommandStatus.Success };
            }
        );
    } catch (error) {
        console.warn(`[Spawn] Nao foi possivel registrar ${name}:`, error);
    }
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    CommandBridge.register("spawn", (player, args) => {
        if (!isModuleEnabled("spawn")) {
            player.sendMessage("§cSistema de spawn desativado.");
            return;
        }
        teleportToSpawn(player);
    });
    if (!customCommandRegistry) return;

    registerCommandSafe(customCommandRegistry, "labsdev:spawn");
});
