import { system, world, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { isModuleEnabled } from "../core/moduleState.js";
import { getCommandSourceEntity, isValidEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";

const TP_DELAY = 5;
const RTP_RADIUS = 4000;
const IN_COMBAT_KEY = "labsdev:in_combat";
const IN_COMBAT_TAG = "labsdev_in_combat";

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomLocation(player) {
    return {
        x: randomBetween(-RTP_RADIUS, RTP_RADIUS),
        y: 150,
        z: randomBetween(-RTP_RADIUS, RTP_RADIUS),
        dimension: player.dimension,
    };
}

function hasMoved(player, startLoc) {
    const current = player.location;
    return (
        Math.floor(current.x) !== Math.floor(startLoc.x) ||
        Math.floor(current.y) !== Math.floor(startLoc.y) ||
        Math.floor(current.z) !== Math.floor(startLoc.z)
    );
}

function isInCombat(player) {
    return player?.getDynamicProperty(IN_COMBAT_KEY) === true || player?.hasTag(IN_COMBAT_TAG);
}

function rtp(player) {
    if (!isModuleEnabled("rtp")) return;
    if (!player) return;

    if (isInCombat(player)) {
        player.sendMessage("§cVoce esta em combate!");
        return;
    }

    if (!tryUseTeleportCooldown(player, "RTP")) return;

    const startLoc = player.location;
    const delaySeconds = getTeleportDelaySeconds(player, TP_DELAY);

    player.sendMessage("§eProcurando local seguro...");

    const destination = getRandomLocation(player);

    function tick(remaining) {
        if (!isValidEntity(player)) return;
        if (!isModuleEnabled("rtp")) return;

        if (hasMoved(player, startLoc)) {
            player.sendMessage("§cRTP cancelado (movimento)");
            return;
        }

        if (isInCombat(player)) {
            player.sendMessage("§cRTP cancelado (combate)");
            return;
        }

        if (remaining <= 0) {
            try {
                player.teleport(
                    { x: destination.x, y: destination.y, z: destination.z },
                    { dimension: destination.dimension }
                );

                // Efeitos de proteção da V6 para garantir sobrevivência
                player.addEffect("slow_falling", 20 * 15, {
                    amplifier: 0,
                    showParticles: true,
                });
                
                player.addEffect("resistance", 20 * 10, {
                    amplifier: 4,
                    showParticles: false
                });

                player.sendMessage("§aTeleportado para local aleatorio!");
            } catch (e) {
                player.sendMessage("§cErro ao teleportar. Tente novamente.");
            }
            return;
        }

        player.onScreenDisplay.setActionBar(`§eTeleportando em §f${remaining}s...`);
        system.runTimeout(() => tick(remaining - 1), 20);
    }

    tick(delaySeconds);
}

system.beforeEvents.startup.subscribe((event) => {
    // Registra o comando 'rtp' na CommandBridge para o prefixo '!'
    CommandBridge.register("rtp", (player, args) => {
        if (!isModuleEnabled("rtp")) {
            player.sendMessage("§cSistema de RTP desativado.");
            return;
        }
        rtp(player);
    });
    const registry = event.customCommandRegistry;
    if (!registry) return;

    registry.registerCommand(
        {
            name: "labsdev:rtp",
            description: "Teleportar para um local aleatorio",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        },
        (origin) => {
            if (!isModuleEnabled("rtp")) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "Sistema de RTP desativado.",
                };
            }

            const source = getCommandSourceEntity(origin);

            if (!source || !source.location) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "Esse comando so pode ser usado por jogadores.",
                };
            }

            system.run(() => rtp(source));

            return {
                status: CustomCommandStatus.Success,
                message: "RTP iniciado!",
            };
        }
    );
});
