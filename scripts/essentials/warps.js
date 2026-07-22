import {
    system,
    world,
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";

import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isAdmin, isModuleEnabled, showForm } from "../core/moduleState.js";
import { getCommandSourceEntity, isValidEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";

// =========================
// CONFIG
// =========================

const DB_KEY = "labsdev:warps";
const WARP_ICON = "textures/icons/warps";
const MAX_WARP_NAME_LENGTH = 64;
const WARP_NAME_PATTERN = /^[A-Za-z0-9 _§&-]{1,64}$/;
const WARP_DELAY_SECONDS = 5;

// =========================
// STORAGE (PERSISTENTE)
// =========================

function loadWarps() {
    try {
        const raw = world.getDynamicProperty(DB_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveWarps(data) {
    world.setDynamicProperty(DB_KEY, JSON.stringify(data));
}

function getCommandPlayer(origin) {
    return getCommandSourceEntity(origin);
}

function getCommandArg(args, index = 0) {
    if (Array.isArray(args)) return args[index];
    return args;
}

function normalizeWarpName(name) {
    return String(name ?? "").trim();
}

function colorizeWarpName(name) {
    return normalizeWarpName(name).replace(/[&§]([0-9a-fklmnor])/gi, (_, code) => `§${String(code).toLowerCase()}`);
}

function stripWarpFormatting(name) {
    return normalizeWarpName(name).replace(/§[0-9a-fklmnor]/gi, "").replace(/&[0-9a-fklmnor]/gi, "");
}

function getWarpKey(name) {
    return stripWarpFormatting(name).toLowerCase();
}

function validateWarpName(player, name) {
    const rawName = normalizeWarpName(name).replace(/\s+/g, " ");
    const displayName = colorizeWarpName(rawName);
    const cleanName = stripWarpFormatting(displayName).trim();

    if (!rawName || !cleanName) {
        player.sendMessage("§cDigite o nome da warp.");
        return null;
    }

    // Valida o texto exibido com suporte a espaços, cores com &/§, _ e -.
    // O tamanho é contado sem códigos de formatação para não punir nomes coloridos.
    if (cleanName.length > MAX_WARP_NAME_LENGTH || !WARP_NAME_PATTERN.test(rawName)) {
        player.sendMessage(`§cUse um nome de warp com 1 a ${MAX_WARP_NAME_LENGTH} caracteres: letras, numeros, espaco, _ ou -. Cores com &a ou §a sao permitidas.`);
        return null;
    }

    return {
        keyName: cleanName,
        displayName,
    };
}

function getSavedDimension(dimensionId) {
    const cleanId = String(dimensionId || "overworld");
    const candidates = [
        cleanId,
        cleanId.replace("minecraft:", ""),
        cleanId.startsWith("minecraft:") ? cleanId : `minecraft:${cleanId}`,
    ];

    for (const candidate of candidates) {
        try {
            return world.getDimension(candidate);
        } catch {
            // Try the next known dimension id shape.
        }
    }

    return null;
}

function isValidWarp(warpData) {
    return Boolean(
        warpData &&
        Number.isFinite(Number(warpData.x)) &&
        Number.isFinite(Number(warpData.y)) &&
        Number.isFinite(Number(warpData.z)) &&
        typeof warpData.dimension === "string"
    );
}

function getSortedWarpKeys(data) {
    return Object.keys(data).sort((left, right) => {
        const leftName = stripWarpFormatting(data[left]?.name ?? left).toLowerCase();
        const rightName = stripWarpFormatting(data[right]?.name ?? right).toLowerCase();
        return leftName.localeCompare(rightName);
    });
}

function findWarpEntry(data, name) {
    const requestedKey = getWarpKey(name);
    if (data[requestedKey]) return { key: requestedKey, warp: data[requestedKey] };

    // Compatibilidade com dados antigos: tenta localizar pelo nome exibido/keyName salvo.
    for (const key of Object.keys(data)) {
        const warpData = data[key];
        const candidates = [key, warpData?.keyName, warpData?.name]
            .filter(value => value !== undefined && value !== null)
            .map(value => getWarpKey(value));

        if (candidates.includes(requestedKey)) return { key, warp: warpData };
    }

    return null;
}

function hasMoved(player, startLoc) {
    const loc = player.location;
    return (
        Math.floor(loc.x) !== Math.floor(startLoc.x) ||
        Math.floor(loc.y) !== Math.floor(startLoc.y) ||
        Math.floor(loc.z) !== Math.floor(startLoc.z)
    );
}

function teleportPlayerToWarp(player, warpData, key, dimension) {
    const destination = {
        x: Number(warpData.x),
        y: Number(warpData.y),
        z: Number(warpData.z),
    };

    try {
        player.teleport(destination, { dimension });
        player.sendMessage(`§a✔ Teleportado para §r${warpData.name ?? key}`);
    } catch (error) {
        console.warn("[Warps] Erro ao teleportar:", error);
        player.sendMessage("§cErro ao teleportar");
    }
}

// =========================
// CORE
// =========================

function setWarp(player, name) {
    if (!isModuleEnabled("warps")) return;
    if (!player) return;

    const warpName = validateWarpName(player, name);
    if (!warpName) return;

    const data = loadWarps();
    const key = getWarpKey(warpName.keyName);

    data[key] = {
        name: warpName.displayName,
        keyName: warpName.keyName,
        x: player.location.x,
        y: player.location.y,
        z: player.location.z,
        dimension: player.dimension.id
    };

    saveWarps(data);

    player.sendMessage(`§a✔ Warp criada: §r${warpName.displayName}`);
}

function delWarp(player, name) {
    if (!isModuleEnabled("warps")) return;
    if (!player) return;

    const data = loadWarps();
    const entry = findWarpEntry(data, name);

    if (!entry) {
        player.sendMessage("§cWarp não existe!");
        return;
    }

    const cleanName = stripWarpFormatting(entry.warp?.name ?? name);
    delete data[entry.key];
    saveWarps(data);

    player.sendMessage(`§c✖ Warp removida: §e${cleanName}`);
}

function warp(player, name) {
    if (!isModuleEnabled("warps")) return;
    if (!player) return;

    const data = loadWarps();
    const entry = findWarpEntry(data, name);

    if (!entry) {
        player.sendMessage("§cWarp não existe!");
        return;
    }

    const { key, warp: w } = entry;

    if (!isValidWarp(w)) {
        player.sendMessage("§cWarp corrompida. Remova e crie novamente com /setwarp.");
        return;
    }

    const dimension = getSavedDimension(w.dimension);
    if (!dimension) {
        player.sendMessage("§cDimensão da warp não existe mais.");
        return;
    }

    if (!tryUseTeleportCooldown(player, "warp")) return;

    const delaySeconds = getTeleportDelaySeconds(player, WARP_DELAY_SECONDS);
    if (delaySeconds <= 0) {
        teleportPlayerToWarp(player, w, key, dimension);
        return;
    }

    const startLoc = player.location;
    player.sendMessage(`§eTeleportando em §f${delaySeconds}s§e... nao se mova!`);

    function tick(remaining) {
        if (!isValidEntity(player)) return;
        if (!isModuleEnabled("warps")) return;

        if (hasMoved(player, startLoc)) {
            player.sendMessage("§cWarp cancelada por movimento.");
            return;
        }

        if (remaining <= 0) {
            teleportPlayerToWarp(player, w, key, dimension);
            return;
        }

        player.onScreenDisplay.setActionBar(`§eWarp em §f${remaining}s`);
        system.runTimeout(() => tick(remaining - 1), 20);
    }

    tick(delaySeconds);
}

// =========================
// GUI
// =========================

function openWarpMenu(player) {
    if (!isModuleEnabled("warps")) return;
    if (!player) return;

    const data = loadWarps();
    const names = getSortedWarpKeys(data);

    const form = new ActionFormData()
        .title("§8§lWARPS")
        .body("§7Selecione uma warp:");

    if (names.length === 0) {
        form.button("§8Sem warps cadastradas");
    } else {
        names.forEach(n => form.button(`§f${data[n]?.name ?? n}`));
    }

    showForm(form, player).then(res => {
        if (res.canceled) return;

        const name = names[res.selection];
        if (!name) return;

        warp(player, name);
    });
}

// =========================
// GUI ADMIN - Criar Warp com cores
// =========================

export function openCreateWarpForm(player) {
    if (!isAdmin(player)) {
        player.sendMessage("§cSem permissão.");
        return;
    }
    const form = new ModalFormData()
        .title("§8§lCRIAR WARP")
        .textField("§fNome da warp (use &l&2 para cores)", "Ex: &l&2Spawn", { defaultValue: "" });
    showForm(form, player).then((result) => {
        if (result.canceled) return;
        const rawName = String(result.formValues?.[0] ?? "").trim();
        if (!rawName) {
            player.sendMessage("§cDigite um nome para a warp.");
            return;
        }
        setWarp(player, rawName);
    }).catch(() => {});
}

// =========================
// COMMANDS
// =========================

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    // Registra os comandos de warps na CommandBridge para o prefixo '!'
    CommandBridge.register("setwarp", (player, args) => {
        if (!isModuleEnabled("warps")) {
            player.sendMessage("§cSistema de warps desativado.");
            return;
        }
        if (!isAdmin(player)) {
            player.sendMessage("§cVoce nao tem permissao para usar este comando.");
            return;
        }
        // Pega todos os argumentos e junta com espaço para suportar nomes com cores que o bridge pode ter separado
        const name = args.join(" ");
        if (!name) {
            player.sendMessage("§cUse: !setwarp <nome> §7ou §c/setwarp <nome>");
            return;
        }
        setWarp(player, name);
    });

    CommandBridge.register("warp", (player, args) => {
        if (!isModuleEnabled("warps")) {
            player.sendMessage("§cSistema de warps desativado.");
            return;
        }
        const name = args.join(" ");
        if (!name) {
            player.sendMessage("§cUse: !warp <nome> §7ou §c/warp <nome>");
            return;
        }
        warp(player, name);
    });

    CommandBridge.register("warps", (player, args) => {
        if (!isModuleEnabled("warps")) {
            player.sendMessage("§cSistema de warps desativado.");
            return;
        }
        openWarpMenu(player);
    });

    CommandBridge.register("delwarp", (player, args) => {
        if (!isModuleEnabled("warps")) {
            player.sendMessage("§cSistema de warps desativado.");
            return;
        }
        if (!isAdmin(player)) {
            player.sendMessage("§cVoce nao tem permissao para usar este comando.");
            return;
        }
        const name = args.join(" ");
        if (!name) {
            player.sendMessage("§cUse: !delwarp <nome> §7ou §c/delwarp <nome>");
            return;
        }
        delWarp(player, name);
    });
    if (!customCommandRegistry) return;

    // SETWARP
    customCommandRegistry.registerCommand({
        name: "labsdev:setwarp",
        description: "Criar warp",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false,
        mandatoryParameters: [
            { name: "name", type: CustomCommandParamType.String }
        ],
    }, (origin, args) => {
        if (!isModuleEnabled("warps")) return { status: CustomCommandStatus.Failure };

        const player = getCommandPlayer(origin);
        if (!player) return { status: CustomCommandStatus.Failure };

        const name = getCommandArg(args);
        system.run(() => setWarp(player, name));
        return { status: CustomCommandStatus.Success };
    });

    // WARP
    customCommandRegistry.registerCommand({
        name: "labsdev:warp",
        description: "Ir para warp",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [
            { name: "name", type: CustomCommandParamType.String }
        ],
    }, (origin, args) => {
        if (!isModuleEnabled("warps")) return { status: CustomCommandStatus.Failure };

        const player = getCommandPlayer(origin);
        if (!player) return { status: CustomCommandStatus.Failure };

        const name = getCommandArg(args);
        system.run(() => warp(player, name));
        return { status: CustomCommandStatus.Success };
    });

    // GUI MENU
    customCommandRegistry.registerCommand({
        name: "labsdev:warps",
        description: "Menu de warps",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
    }, (origin) => {
        if (!isModuleEnabled("warps")) return { status: CustomCommandStatus.Failure };

        const player = getCommandPlayer(origin);
        if (!player) return { status: CustomCommandStatus.Failure };

        system.run(() => {
            openWarpMenu(player);
        });

        return { status: CustomCommandStatus.Success };
    });

    // DELWARP
    customCommandRegistry.registerCommand({
        name: "labsdev:delwarp",
        description: "Remover warp",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false,
        mandatoryParameters: [
            { name: "name", type: CustomCommandParamType.String }
        ],
    }, (origin, args) => {
        if (!isModuleEnabled("warps")) return { status: CustomCommandStatus.Failure };

        const player = getCommandPlayer(origin);
        if (!player) return { status: CustomCommandStatus.Failure };

        const name = getCommandArg(args);
        system.run(() => delWarp(player, name));
        return { status: CustomCommandStatus.Success };
    });

});
