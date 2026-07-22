import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
    system,
    world,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { ActionFormData } from "@minecraft/server-ui";
import { isModuleEnabled, showForm } from "../core/moduleState.js";
import { getCommandSourceEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";

const HOME_KEY = "player_homes";
const TP_DELAY_SECONDS = 5;
const IN_COMBAT_KEY = "labsdev:in_combat";
const IN_COMBAT_TAG = "labsdev_in_combat";
const OVERWORLD = "minecraft:overworld";
const HOME_NAME_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

system.beforeEvents.startup.subscribe((event) => {
    // Registra os comandos de homes na CommandBridge para o prefixo '!'
    CommandBridge.register("sethome", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        const name = args[0];
        if (!name) {
            player.sendMessage("§cUse: !sethome <nome> §7ou §c/sethome <nome>");
            return;
        }
        setHomeForPlayer(player, name);
    });

    CommandBridge.register("home", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        const name = args[0];
        if (!name) {
            player.sendMessage("§cUse: !home <nome> §7ou §c/home <nome>");
            return;
        }
        teleportToHomeByName(player, name);
    });

    CommandBridge.register("listhome", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        listHomesForPlayer(player);
    });

    CommandBridge.register("delhome", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        const name = args[0];
        if (!name) {
            player.sendMessage("§cUse: !delhome <nome> §7ou §c/delhome <nome>");
            return;
        }
        deleteHomeForPlayer(player, name);
    });

    CommandBridge.register("homesui", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        openHomesUI(player);
    });

    CommandBridge.register("delhomeui", (player, args) => {
        if (!isModuleEnabled("homes")) {
            player.sendMessage("§cSistema de homes desativado.");
            return;
        }
        openDeleteHomeUI(player);
    });
    const cmd = event.customCommandRegistry;
    const prop = event.propertyRegistry;

    if (prop) {
        try {
            prop.registerEntityTypeDynamicProperties({
                identifier: "minecraft:player",
                properties: [{ id: HOME_KEY, type: "string" }],
            });
        } catch (error) {
            console.warn("[Homes] Nao foi possivel registrar dynamic property:", error);
        }
    }

    if (!cmd) return;

    cmd.registerCommand(
        {
            name: "labsdev:sethome",
            description: "Salvar home",
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [{ name: "nome", type: CustomCommandParamType.String }],
        },
        (origin, arg) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            const name = getCommandArg(arg);
            system.run(() => setHomeForPlayer(player, name));
            return { status: CustomCommandStatus.Success };
        }
    );

    cmd.registerCommand(
        {
            name: "labsdev:listhome",
            description: "Listar homes",
            permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            system.run(() => listHomesForPlayer(player));
            return { status: CustomCommandStatus.Success };
        }
    );

    cmd.registerCommand(
        {
            name: "labsdev:homesui",
            description: "Abrir UI de homes",
            permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            system.run(() => openHomesUI(player));
            return { status: CustomCommandStatus.Success };
        }
    );

    cmd.registerCommand(
        {
            name: "labsdev:delhomeui",
            description: "UI deletar home",
            permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            system.run(() => openDeleteHomeUI(player));
            return { status: CustomCommandStatus.Success };
        }
    );

    cmd.registerCommand(
        {
            name: "labsdev:home",
            description: "Ir para home",
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [{ name: "nome", type: CustomCommandParamType.String }],
        },
        (origin, arg) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            const name = getCommandArg(arg);
            system.run(() => teleportToHomeByName(player, name));
            return { status: CustomCommandStatus.Success };
        }
    );

    cmd.registerCommand(
        {
            name: "labsdev:delhome",
            description: "Deletar home",
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [{ name: "nome", type: CustomCommandParamType.String }],
        },
        (origin, arg) => {
            const player = getCommandPlayer(origin);
            if (!player || !isModuleEnabled("homes")) return { status: CustomCommandStatus.Failure };

            const name = getCommandArg(arg);
            system.run(() => deleteHomeForPlayer(player, name));
            return { status: CustomCommandStatus.Success };
        }
    );
});

function getCommandPlayer(origin) {
    return getCommandSourceEntity(origin);
}

function getCommandArg(value, index = 0) {
    if (Array.isArray(value)) {
        return value[index];
    }

    if (value && typeof value === "object" && "value" in value) {
        return value.value;
    }

    if (value && typeof value === "object" && "name" in value) {
        return value.name;
    }

    return value;
}

function normalizeHomeName(name) {
    return String(name ?? "").trim();
}

function color(code) {
    return `\u00a7${code}`;
}

export function getHomes(player) {
    try {
        const data = player.getDynamicProperty(HOME_KEY);
        if (data === undefined || data === null) return {};
        
        // Se for string, tenta fazer o parse
        if (typeof data === "string" && data.trim() !== "") {
            try {
                const homes = JSON.parse(data);
                return (homes && typeof homes === "object") ? homes : {};
            } catch {
                return {};
            }
        }
        
        // Se já for objeto (comportamento de algumas versões da API)
        if (typeof data === "object" && !Array.isArray(data)) {
            return data;
        }
    } catch (e) {
        console.warn("[Homes] Erro ao ler homes:", e);
    }
    return {};
}

function saveHomes(player, homes) {
    player.setDynamicProperty(HOME_KEY, JSON.stringify(homes));
}

export function setHomeForPlayer(player, name) {
    const homeName = normalizeHomeName(name);

    if (!HOME_NAME_PATTERN.test(homeName)) {
        player.sendMessage(`${color("c")}Use 1 a 24 caracteres: letras, numeros, _ ou -.`);
        return false;
    }

    const loc = player.location;
    const homes = getHomes(player);

    homes[homeName] = {
        x: loc.x,
        y: loc.y,
        z: loc.z,
        dimension: player.dimension.id,
    };

    saveHomes(player, homes);
    player.sendMessage(`${color("a")}Home '${homeName}' salva!`);
    return true;
}

export function listHomesForPlayer(player) {
    const names = Object.keys(getHomes(player)).sort((left, right) => left.localeCompare(right));

    if (names.length === 0) {
        player.sendMessage(`${color("c")}Voce nao tem homes.`);
        return names;
    }

    player.sendMessage(`${color("a")}Suas homes:`);
    for (const name of names) {
        player.sendMessage(`${color("7")}- ${name}`);
    }

    return names;
}

export function teleportToHomeByName(player, name) {
    const homeName = normalizeHomeName(name);
    const homes = getHomes(player);
    const home = homes[homeName];

    if (!homeName || !home) {
        player.sendMessage(`${color("c")}Home nao encontrada!`);
        return false;
    }

    teleportWithDelay(player, home, homeName);
    return true;
}

export function deleteHomeForPlayer(player, name) {
    const homeName = normalizeHomeName(name);
    const homes = getHomes(player);

    if (!homeName || !homes[homeName]) {
        player.sendMessage(`${color("c")}Home nao encontrada!`);
        return false;
    }

    delete homes[homeName];
    saveHomes(player, homes);
    player.sendMessage(`${color("c")}Home '${homeName}' removida`);
    return true;
}

function hasMoved(player, startLoc) {
    const loc = player.location;
    return (
        Math.floor(loc.x) !== Math.floor(startLoc.x) ||
        Math.floor(loc.y) !== Math.floor(startLoc.y) ||
        Math.floor(loc.z) !== Math.floor(startLoc.z)
    );
}

function runCountdown(player, seconds, onTick, onComplete, onCancel) {
    const startLoc = player.location;

    function tick(remaining) {
        if (!isValidPlayer(player)) return;
        if (!isModuleEnabled("homes")) return;

        if (hasMoved(player, startLoc)) {
            onCancel();
            return;
        }

        if (remaining <= 0) {
            onComplete();
            return;
        }

        onTick(remaining);
        system.runTimeout(() => tick(remaining - 1), 20);
    }

    tick(seconds);
}

function isValidPlayer(player) {
    if (!player) return false;

    try {
        const isValid = player.isValid;
        return typeof isValid === "function" ? isValid.call(player) : isValid !== false;
    } catch {
        return false;
    }
}

function isInCombat(player) {
    return player?.getDynamicProperty(IN_COMBAT_KEY) === true || player?.hasTag(IN_COMBAT_TAG);
}

function getHomeDimension(home) {
    const id = String(home?.dimension || OVERWORLD);
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

function getHomeLocation(home) {
    const x = Number(home?.x);
    const y = Number(home?.y);
    const z = Number(home?.z);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }

    return { x, y, z };
}

function returnTo(backAction) {
    if (typeof backAction === "function") {
        system.run(backAction);
    }
}

function teleportWithDelay(player, home, name) {
    if (!isModuleEnabled("homes")) return;

    if (isInCombat(player)) {
        player.sendMessage(`${color("c")}Voce esta em combate!`);
        return;
    }

    const destination = getHomeLocation(home);
    if (!destination) {
        player.sendMessage(`${color("c")}Essa home esta com local invalido.`);
        return;
    }

    const dimension = getHomeDimension(home);
    if (!tryUseTeleportCooldown(player, "home")) return;

    const delaySeconds = getTeleportDelaySeconds(player, TP_DELAY_SECONDS);
    if (delaySeconds <= 0) {
        player.teleport(destination, { dimension });
        player.sendMessage(`${color("a")}Teleportado para '${name}'`);
        return;
    }

    player.sendMessage(`${color("e")}Teleportando em ${delaySeconds} segundos... nao se mova!`);

    runCountdown(
        player,
        delaySeconds,
        () => {},
        () => {
            if (isInCombat(player)) {
                player.sendMessage(`${color("c")}Teleport cancelado (combate)`);
                return;
            }

            player.teleport(destination, { dimension });
            player.sendMessage(`${color("a")}Teleportado para '${name}'`);
        },
        () => {
            player.sendMessage(`${color("c")}Teleport cancelado (movimento)`);
        }
    );
}

export function openHomesUI(player, backAction = null) {
    if (!isModuleEnabled("homes")) return;

    const homes = getHomes(player);
    const names = Object.keys(homes).sort((left, right) => left.localeCompare(right));

    if (names.length === 0) {
        player.sendMessage(`${color("c")}Voce nao tem homes.`);
        returnTo(backAction);
        return;
    }

    const form = new ActionFormData()
        .title(`${color("b")}Suas Homes`)
        .body(`${color("7")}Clique para teleportar`);

    for (const name of names) {
        form.button(`${color("a")}${name}`);
    }

    showForm(form, player).then((result) => {
        if (result.canceled) {
            returnTo(backAction);
            return;
        }

        const selected = names[result.selection];
        if (!selected) {
            returnTo(backAction);
            return;
        }

        teleportToHomeByName(player, selected);
    }).catch(() => {
        player.sendMessage(`${color("c")}Nao foi possivel abrir suas homes.`);
        returnTo(backAction);
    });
}

export function openDeleteHomeUI(player, backAction = null) {
    if (!isModuleEnabled("homes")) return;

    const homes = getHomes(player);
    const names = Object.keys(homes).sort((left, right) => left.localeCompare(right));

    if (names.length === 0) {
        player.sendMessage(`${color("c")}Voce nao tem homes.`);
        returnTo(backAction);
        return;
    }

    const form = new ActionFormData()
        .title(`${color("c")}Deletar Home`)
        .body(`${color("7")}Selecione uma home`);

    for (const name of names) {
        form.button(`${color("c")}${name}`);
    }

    showForm(form, player).then((result) => {
        if (result.canceled) {
            returnTo(backAction);
            return;
        }

        const selected = names[result.selection];
        if (!selected) {
            returnTo(backAction);
            return;
        }

        deleteHomeForPlayer(player, selected);
        returnTo(backAction);
    }).catch(() => {
        player.sendMessage(`${color("c")}Nao foi possivel abrir suas homes.`);
        returnTo(backAction);
    });
}
