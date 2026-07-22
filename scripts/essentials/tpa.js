import {
    world,
    system,
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";

import { ActionFormData } from "@minecraft/server-ui";
import { isModuleEnabled, showForm } from "../core/moduleState.js";
import { getCommandSourceEntity, getOnlinePlayers, isValidEntity } from "../core/scriptCompat.js";
import { getTeleportDelaySeconds, tryUseTeleportCooldown } from "../core/teleportCooldown.js";
import { addRequestToQueue, removeRequest, getRequestsForPlayer } from "./tpa_requests.js";

const TP_DELAY_SECONDS = 5;
const REQUEST_TIME = 30 * 20;

const requests = new Map(); // Para o modo clássico (tela)
const tpaDisabledPlayers = new Set();

// Tag para identificar se o player quer TPA na tela ou no menu
const TAG_TPA_MENU = "tpa_mode:menu";

export function isTpaMenuMode(player) {
    return player.hasTag(TAG_TPA_MENU);
}

export function setTpaMenuMode(player, useMenu) {
    if (useMenu) {
        player.addTag(TAG_TPA_MENU);
        player.sendMessage("§aModo de TPA alterado: Agora os pedidos irao para o seu Menu de Solicitacoes.");
    } else {
        player.removeTag(TAG_TPA_MENU);
        player.sendMessage("§eModo de TPA alterado: Agora os pedidos aparecerão diretamente na sua tela.");
    }
}

function isTpaDisabled(player) {
    return tpaDisabledPlayers.has(player.id);
}

function setTpaDisabled(player, disabled) {
    if (disabled) {
        tpaDisabledPlayers.add(player.id);
        player.sendMessage("§cTPA desativado. Voce nao recebera pedidos de teleporte.");
    } else {
        tpaDisabledPlayers.delete(player.id);
        player.sendMessage("§aTPA ativado. Voce voltara a receber pedidos de teleporte.");
    }
}

function hasMoved(player, startLoc) {
    const loc = player.location;
    return (
        Math.floor(loc.x) !== Math.floor(startLoc.x) ||
        Math.floor(loc.y) !== Math.floor(startLoc.y) ||
        Math.floor(loc.z) !== Math.floor(startLoc.z)
    );
}

export function teleportWithDelay(player, target) {
    if (!isModuleEnabled("tpa")) return;
    if (!player || !target) return;

    const startLoc = player.location;
    const delaySeconds = getTeleportDelaySeconds(player, TP_DELAY_SECONDS);

    function tick(remaining) {
        if (!isValidEntity(player) || !isValidEntity(target)) return;
        if (!isModuleEnabled("tpa")) return;

        if (hasMoved(player, startLoc)) {
            player.sendMessage("§cTeleport cancelado (movimento)");
            return;
        }

        if (remaining <= 0) {
            try {
                player.teleport(target.location, { dimension: target.dimension });
                player.sendMessage("§aTeleportado!");
            } catch {
                player.sendMessage("§cErro no teleport");
            }
            return;
        }

        player.sendMessage(`§eTeleportando em §f${remaining}...`);
        system.runTimeout(() => tick(remaining - 1), 20);
    }

    tick(delaySeconds);
}

function showTPARequestUI(target, sender, type) {
    if (!isModuleEnabled("tpa")) return;

    system.run(() => {
        const form = new ActionFormData()
            .title("§ePedido de Teleporte")
            .body(
                `§7${sender.name} quer ${
                    type === "tpa" ? "§air ate voce" : "§ete puxar ate ele"
                }`
            )
            .button("§aAceitar")
            .button("§cRecusar");

        showForm(form, target).then((result) => {
            if (result.canceled) {
                denyRequest(target);
                return;
            }

            if (result.selection === 0) acceptRequest(target);
            if (result.selection === 1) denyRequest(target);
        }).catch(() => {});
    });
}

function addRequest(target, sender, type) {
    if (!isModuleEnabled("tpa")) return;

    // No modo menu, podemos ter múltiplos pedidos de pessoas diferentes
    if (!isTpaMenuMode(target) && requests.has(target.id)) {
        sender.sendMessage("§cEsse jogador ja tem um pedido pendente na tela.");
        return;
    }

    if (isTpaDisabled(target)) {
        sender.sendMessage("§cEsse jogador esta com TPA desativado.");
        return;
    }

    if (!tryUseTeleportCooldown(sender, type === "tpa" ? "TPA" : "TPAHere")) return;

    if (isTpaMenuMode(target)) {
        // MODO MENU: Adiciona na fila silenciosa
        addRequestToQueue(target, sender, type);
        sender.sendMessage("§aPedido enviado para o menu de solicitações do jogador!");
        target.sendMessage(`§e[TPA] §f${sender.name} §7enviou uma solicitação. Abra o menu para ver.`);
    } else {
        // MODO TELA: Comportamento original
        requests.set(target.id, { sender, type });
        sender.sendMessage("§aPedido enviado!");
        target.sendMessage("§eVoce recebeu um pedido de teleporte!");
        showTPARequestUI(target, sender, type);

        system.runTimeout(() => {
            const data = requests.get(target.id);
            if (data && data.sender.id === sender.id) {
                requests.delete(target.id);
                target.sendMessage("§cPedido expirou");
                sender.sendMessage("§cSeu pedido expirou");
            }
        }, REQUEST_TIME);
    }
}

export function acceptRequest(player, specificSenderId = null) {
    if (!isModuleEnabled("tpa")) return;

    let data;
    let isFromQueue = false;

    if (specificSenderId) {
        // Aceitando do menu de solicitações
        const queue = getRequestsForPlayer(player);
        data = queue.find(req => req.sender.id === specificSenderId);
        isFromQueue = true;
    } else {
        // Aceitando o pedido atual da tela
        data = requests.get(player.id);
    }

    if (!data) {
        player.sendMessage("§cSem pedidos pendentes");
        return;
    }

    const sender = data.sender;
    if (!sender || !isValidEntity(sender)) {
        if (isFromQueue) removeRequest(player.id, specificSenderId);
        else requests.delete(player.id);
        player.sendMessage("§cO jogador que enviou o pedido não está mais online.");
        return;
    }

    if (data.type === "tpa") {
        teleportWithDelay(sender, player);
    } else {
        teleportWithDelay(player, sender);
    }

    player.sendMessage("§aPedido aceito!");
    sender.sendMessage("§aPedido aceito!");
    
    if (isFromQueue) removeRequest(player.id, sender.id);
    else requests.delete(player.id);
}

export function denyRequest(player, specificSenderId = null) {
    if (!isModuleEnabled("tpa")) return;

    let data;
    let isFromQueue = false;

    if (specificSenderId) {
        const queue = getRequestsForPlayer(player);
        data = queue.find(req => req.sender.id === specificSenderId);
        isFromQueue = true;
    } else {
        data = requests.get(player.id);
    }

    if (!data) return;

    data.sender?.sendMessage(`§c${player.name} recusou seu pedido`);
    player.sendMessage("§cPedido recusado");
    
    if (isFromQueue) removeRequest(player.id, specificSenderId);
    else requests.delete(player.id);
}

world.afterEvents.playerLeave.subscribe((event) => {
    requests.delete(event.playerId);
    tpaDisabledPlayers.delete(event.playerId);
});

function getPlayerByName(name) {
    if (!name) return null;
    const players = getOnlinePlayers();
    const exactMatch = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (exactMatch) return exactMatch;
    
    const partialMatches = players.filter((p) => p.name.toLowerCase().includes(name.toLowerCase()));
    if (partialMatches.length === 1) return partialMatches[0];
    
    return null;
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    CommandBridge.register("tpa", (player, args) => {
        if (!isModuleEnabled("tpa")) {
            player.sendMessage("§cSistema de TPA desativado.");
            return;
        }
        const option = args[0]?.toLowerCase();
        if (option === "off" || option === "on") {
            setTpaDisabled(player, option === "off");
            return;
        }
        if (option === "menu") {
            setTpaMenuMode(player, true);
            return;
        }
        if (option === "tela") {
            setTpaMenuMode(player, false);
            return;
        }
        const targetName = args[0];
        const target = getPlayerByName(targetName);
        if (!target || player.id === target.id) {
            player.sendMessage("§cJogador nao encontrado ou invalido.");
            return;
        }
        addRequest(target, player, "tpa");
    });

    CommandBridge.register("tpahere", (player, args) => {
        if (!isModuleEnabled("tpa")) {
            player.sendMessage("§cSistema de TPA desativado.");
            return;
        }
        const targetName = args[0];
        const target = getPlayerByName(targetName);
        if (!target || player.id === target.id) {
            player.sendMessage("§cJogador nao encontrado ou invalido.");
            return;
        }
        addRequest(target, player, "tpahere");
    });

    CommandBridge.register("tpaccept", (player, args) => {
        if (!isModuleEnabled("tpa")) {
            player.sendMessage("§cSistema de TPA desativado.");
            return;
        }
        acceptRequest(player);
    });

    CommandBridge.register("tpdeny", (player, args) => {
        if (!isModuleEnabled("tpa")) {
            player.sendMessage("§cSistema de TPA desativado.");
            return;
        }
        denyRequest(player);
    });
    
    if (!customCommandRegistry) return;

    // Comandos LabsDev omitidos para brevidade, mas seguem a mesma lógica do CommandBridge
});

export function sendTPA(sender, target) {
    addRequest(target, sender, "tpa");
}

export function sendTPAHere(sender, target) {
    addRequest(target, sender, "tpahere");
}
