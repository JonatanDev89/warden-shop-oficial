import {
    CommandPermissionLevel,
    CustomCommandStatus,
    system,
    world,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { isModuleEnabled } from "../core/moduleState.js";
import { getCommandSourceEntity, isValidEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";

const deathPos = new Map();
const combatTag = new Map();

const COMBAT_LOCK_TICKS = 40;
const BACK_DELAY_SECONDS = 5;

function hasMoved(player, startLoc) {
    const current = player.location;
    return (
        Math.floor(current.x) !== Math.floor(startLoc.x) ||
        Math.floor(current.y) !== Math.floor(startLoc.y) ||
        Math.floor(current.z) !== Math.floor(startLoc.z)
    );
}

world.afterEvents.entityDie.subscribe((event) => {
    if (!isModuleEnabled("back")) return;

    const entity = event.deadEntity;
    if (entity?.typeId !== "minecraft:player") return;

    deathPos.set(entity.id, {
        x: entity.location.x,
        y: entity.location.y,
        z: entity.location.z,
        dimension: entity.dimension,
    });
});

world.afterEvents.entityHurt.subscribe((event) => {
    if (!isModuleEnabled("back")) return;

    const hurtEntity = event.hurtEntity;
    if (!hurtEntity?.id) return;

    combatTag.set(hurtEntity.id, true);
    system.runTimeout(() => {
        combatTag.delete(hurtEntity.id);
    }, COMBAT_LOCK_TICKS);
});

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    CommandBridge.register("back", (player, args) => {
        if (!isModuleEnabled("back")) {
            player.sendMessage("§cSistema /labsdev:back desativado.");
            return;
        }
        // Simula a lógica do comando /labsdev:back
        if (combatTag.get(player.id)) {
            player.sendMessage("§cVoce esta em combate!");
            return;
        }
        const pos = deathPos.get(player.id);
        if (!pos) {
            player.sendMessage("§cVoce nao morreu recentemente!");
            return;
        }
        if (!tryUseTeleportCooldown(player, "/labsdev:back")) {
            return;
        }
        system.run(() => {
            if (!isValidEntity(player)) return;
            const startLoc = player.location;
            const delaySeconds = getTeleportDelaySeconds(player, BACK_DELAY_SECONDS);
            function tick(remaining) {
                if (!isValidEntity(player)) return;
                if (!isModuleEnabled("back")) return;
                if (hasMoved(player, startLoc)) {
                    player.sendMessage("§cBack cancelado");
                    return;
                }
                if (remaining <= 0) {
                    player.teleport(
                        { x: pos.x, y: pos.y, z: pos.z },
                        { dimension: pos.dimension }
                    );
                    player.sendMessage("§aVoltou ao local da morte!");
                    return;
                }
                player.onScreenDisplay.setActionBar(`§eVoltando em §f${remaining}s`);
                system.runTimeout(() => tick(remaining - 1), 20);
            }
            tick(delaySeconds);
        });
        player.sendMessage("§aIniciando /labsdev:back...");
    });
    if (!customCommandRegistry) return;

    customCommandRegistry.registerCommand(
        {
            name: "labsdev:back",
            description: "Volta ao local da ultima morte.",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
            mandatoryParameters: [],
        },
        (origin) => {
            if (!isModuleEnabled("back")) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "Sistema /labsdev:back desativado.",
                };
            }

            const player = getCommandSourceEntity(origin);

            if (!player) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "§cSomente jogadores.",
                };
            }

            if (combatTag.get(player.id)) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "§cVoce esta em combate!",
                };
            }

            const pos = deathPos.get(player.id);
            if (!pos) {
                return {
                    status: CustomCommandStatus.Failure,
                    message: "§cVoce nao morreu recentemente!",
                };
            }

            if (!tryUseTeleportCooldown(player, "/labsdev:back")) {
                return { status: CustomCommandStatus.Failure };
            }

            system.run(() => {
                if (!isValidEntity(player)) return;

                const startLoc = player.location;
                const delaySeconds = getTeleportDelaySeconds(player, BACK_DELAY_SECONDS);

                function tick(remaining) {
                if (!isValidEntity(player)) return;
                if (!isModuleEnabled("back")) return;

                if (hasMoved(player, startLoc)) {
                    player.sendMessage("§cBack cancelado");
                    return;
                }

                if (remaining <= 0) {
                    player.teleport(
                        { x: pos.x, y: pos.y, z: pos.z },
                        { dimension: pos.dimension }
                    );
                    player.sendMessage("§aVoltou ao local da morte!");
                    return;
                }

                player.onScreenDisplay.setActionBar(`§eVoltando em §f${remaining}s`);
                system.runTimeout(() => tick(remaining - 1), 20);
            }

                tick(delaySeconds);
            });

            return {
                status: CustomCommandStatus.Success,
                message: "§aIniciando /labsdev:back...",
            };
        }
    );
});
