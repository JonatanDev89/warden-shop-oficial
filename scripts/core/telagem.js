/**
 * telagem.js — Sistema de Telagem (Screen Share)
 *
 * - Persiste no world (sobrevive a quit/reload)
 * - Reaplicado automaticamente ao voltar
 * - Bloqueia todos os comandos do jogador telado
 * - Escuridão, freeze, pvp_off contínuos
 */

import { world, system } from "@minecraft/server";
import { isModuleEnabled } from "./moduleState.js";

const TELAGEM_TAG     = "em_telagem";
const PVP_OFF_TAG     = "pvp_off";
const STORAGE_KEY     = "warden_telagem_list";
const DARKNESS_TICKS  = 20;

// ── Persistência ──────────────────────────────────────────────────────────────
function loadTelagemList() {
    try {
        const raw = world.getDynamicProperty(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveTelagemList(list) {
    try {
        world.setDynamicProperty(STORAGE_KEY, JSON.stringify(list));
    } catch {}
}

function addToList(playerName, executorName) {
    const list = loadTelagemList();
    list[playerName] = { executor: executorName, since: Date.now() };
    saveTelagemList(list);
}

function removeFromList(playerName) {
    const list = loadTelagemList();
    delete list[playerName];
    saveTelagemList(list);
}

function isInList(playerName) {
    return !!loadTelagemList()[playerName];
}

// ── Intervalos ativos em memória ──────────────────────────────────────────────
const telagemIntervals = new Map(); // name → intervalId

// ── Aplica efeitos no jogador ─────────────────────────────────────────────────
function aplicarEfeitos(target) {
    if (!target.isValid) return;

    target.addTag(TELAGEM_TAG);
    target.addTag(PVP_OFF_TAG);

    // Freeze
    try {
        target.dimension.runCommand(`inputpermission set "${target.name}" movement disabled`);
        target.dimension.runCommand(`inputpermission set "${target.name}" camera disabled`);
    } catch {}

    // Título
    try {
        target.onScreenDisplay.setTitle("§c§lCOMPARTILHE SUA TELA", {
            subtitle:        "§fAbra o Discord e compartilhe sua tela para o staff",
            fadeInDuration:  10,
            stayDuration:    200,
            fadeOutDuration: 10
        });
    } catch {}
}

// ── Inicia loop de efeitos ────────────────────────────────────────────────────
function iniciarLoop(target) {
    if (telagemIntervals.has(target.name)) return;

    const id = system.runInterval(() => {
        if (!target.isValid) {
            pararLoop(target.name);
            return;
        }
        // Garante tags
        if (!target.hasTag(TELAGEM_TAG)) target.addTag(TELAGEM_TAG);
        if (!target.hasTag(PVP_OFF_TAG)) target.addTag(PVP_OFF_TAG);

        // Escuridão
        try { target.runCommand(`effect @s darkness 3 1 true`); } catch {}

        // ActionBar
        try {
            target.onScreenDisplay.setActionBar(
                `§c§l⚠ TELAGEM ATIVA §r§7| §fCompartilhe sua tela no Discord`
            );
        } catch {}
    }, DARKNESS_TICKS);

    telagemIntervals.set(target.name, id);
}

function pararLoop(playerName) {
    const id = telagemIntervals.get(playerName);
    if (id !== undefined) {
        system.clearRun(id);
        telagemIntervals.delete(playerName);
    }
}

// ── Iniciar telagem ───────────────────────────────────────────────────────────
function iniciarTelagem(target, executorName) {
    addToList(target.name, executorName);
    aplicarEfeitos(target);
    iniciarLoop(target);

    target.sendMessage("§c§l[TELAGEM] §r§fVocê está sendo telado. Compartilhe sua tela no Discord imediatamente!");

    for (const p of world.getAllPlayers()) {
        if (p.hasTag("admin")) {
            p.sendMessage(`§e[Telagem] §f${target.name} §7está sendo telado por §f${executorName}§7.`);
        }
    }

    notificarBridge(JSON.stringify({
        action: "telagem_start", player: target.name, executor: executorName
    }));
}

// ── Encerrar telagem ──────────────────────────────────────────────────────────
function encerrarTelagem(playerName, executorName = "Sistema") {
    if (!isInList(playerName)) return;

    removeFromList(playerName);
    pararLoop(playerName);

    const target = world.getAllPlayers().find(p => p.name === playerName);
    if (target && target.isValid) {
        target.removeTag(TELAGEM_TAG);
        target.removeTag(PVP_OFF_TAG);

        try {
            target.dimension.runCommand(`inputpermission set "${target.name}" movement enabled`);
            target.dimension.runCommand(`inputpermission set "${target.name}" camera enabled`);
        } catch {}

        try { target.runCommand(`effect @s darkness 0`); } catch {}

        try {
            target.onScreenDisplay.setTitle("§a§lTELAGEM ENCERRADA", {
                subtitle:        "§7Você pode continuar jogando",
                fadeInDuration:  5,
                stayDuration:    60,
                fadeOutDuration: 10
            });
        } catch {}

        target.sendMessage("§a[Telagem] §fSua telagem foi encerrada.");
    }

    for (const p of world.getAllPlayers()) {
        if (p.hasTag("admin")) {
            p.sendMessage(`§a[Telagem] §fTelagem de §f${playerName} §7encerrada por §f${executorName}§7.`);
        }
    }

    notificarBridge(JSON.stringify({
        action: "telagem_end", player: playerName, executor: executorName
    }));
}

// ── Notifica bridge ───────────────────────────────────────────────────────────
function notificarBridge(message) {
    try { system.sendScriptEvent("mce:clan_response", message); } catch {}
}

// ── Reaplicar ao voltar (playerSpawn) ─────────────────────────────────────────
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!isModuleEnabled("telagem")) return;
    if (!initialSpawn) return;
    if (!isInList(player.name)) return;

    system.runTimeout(() => {
        if (!player.isValid) return;
        aplicarEfeitos(player);
        iniciarLoop(player);
        player.sendMessage("§c§l[TELAGEM] §r§fVocê ainda está em telagem. Compartilhe sua tela no Discord!");

        notificarBridge(JSON.stringify({
            action: "telagem_reconnect", player: player.name
        }));

        for (const p of world.getAllPlayers()) {
            if (p.hasTag("admin") && p.name !== player.name) {
                p.sendMessage(`§e[Telagem] §f${player.name} §7voltou ao servidor — ainda em telagem!`);
            }
        }
    }, 20);
});

// ── Bloquear todo dano durante telagem ───────────────────────────────────────
world.beforeEvents.entityHurt.subscribe((ev) => {
    if (!isModuleEnabled("telagem")) return;
    if (ev.hurtEntity?.typeId !== "minecraft:player") return;
    if (!isInList(ev.hurtEntity.name)) return;
    ev.cancel = true;
});

// ── Bloquear bússola e itens durante telagem ──────────────────────────────────
world.beforeEvents.itemUse.subscribe((ev) => {
    if (!isModuleEnabled("telagem")) return;
    if (!isInList(ev.source.name)) return;
    
    // structure_block e itens de admin não devem ser bloqueados, mas o jogador telado
    // não deveria ter acesso a eles de qualquer forma. Vamos bloquear apenas itens comuns.
    const item = ev.itemStack?.typeId || "";
    if (item.includes("structure_block") || item.includes("structure_void") || item.includes("command_block")) return;
    
    ev.cancel = true;
    ev.source.sendMessage("§c[Telagem] Você não pode usar itens durante a telagem.");
});

// ── Bloquear comandos do jogador telado ───────────────────────────────────────
world.beforeEvents.chatSend.subscribe((ev) => {
    if (!isModuleEnabled("telagem")) return;
    const msg = ev.message.trim();
    if (!isInList(ev.sender.name)) return;

    // Se o jogador tiver tag de admin/staff e estiver testando a telagem, não bloqueia comandos de admin
    const isAdmin = ev.sender.hasTag("admin") || ev.sender.hasTag("Staff") || ev.sender.hasTag("staff") || ev.sender.hasTag("owner") || ev.sender.hasTag("dono");
    if (isAdmin && (msg.startsWith("/structure") || msg.startsWith("/fill") || msg.startsWith("/setblock"))) return;

    // Bloqueia qualquer comando (! ou /)
    if (msg.startsWith("!") || msg.startsWith("/")) {
        ev.cancel = true;
        ev.sender.sendMessage("§c[Telagem] Você não pode usar comandos durante a telagem.");
        return;
    }

    // Bloqueia chat normal também
    ev.cancel = true;
    ev.sender.sendMessage("§c[Telagem] Você não pode usar o chat durante a telagem.");
});

// ── Notificar saída durante telagem ──────────────────────────────────────────
world.beforeEvents.playerLeave.subscribe(({ player }) => {
    if (!isModuleEnabled("telagem")) return;
    if (!isInList(player.name)) return;

    pararLoop(player.name);
    // NÃO remove da lista — persiste para quando voltar

    notificarBridge(JSON.stringify({
        action: "telagem_disconnect", player: player.name
    }));

    for (const p of world.getAllPlayers()) {
        if (p.hasTag("admin") && p.name !== player.name) {
            p.sendMessage(`§c[Telagem] §f${player.name} §7saiu durante a telagem!`);
        }
    }
});

// ── Listeners de scriptevent ──────────────────────────────────────────────────
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (!isModuleEnabled("telagem")) return;
    if (id === "warden:telagem") {
        const targetName = message?.trim();
        if (!targetName) return;
        if (sourceEntity && !sourceEntity.hasTag("admin")) {
            sourceEntity.sendMessage("§c[Telagem] Apenas administradores podem usar este comando.");
            return;
        }
        const target = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
        if (!target) {
            if (sourceEntity) sourceEntity.sendMessage(`§c[Telagem] Jogador "${targetName}" não está online.`);
            return;
        }
        system.run(() => iniciarTelagem(target, sourceEntity?.name ?? "Console"));
    }

    if (id === "warden:telagem_end") {
        const targetName = message?.trim();
        if (!targetName) return;
        if (sourceEntity && !sourceEntity.hasTag("admin")) {
            sourceEntity.sendMessage("§c[Telagem] Apenas administradores podem usar este comando.");
            return;
        }
        system.run(() => encerrarTelagem(targetName, sourceEntity?.name ?? "Console"));
    }
});

// ── Restaurar loops ao iniciar o servidor (reload) ───────────────────────────
system.run(() => {
    if (!isModuleEnabled("telagem")) return;
    const list = loadTelagemList();
    for (const playerName of Object.keys(list)) {
        const target = world.getAllPlayers().find(p => p.name === playerName);
        if (target && target.isValid) {
            aplicarEfeitos(target);
            iniciarLoop(target);
        }
    }
    if (Object.keys(list).length > 0) {
        console.warn(`[Telagem] ${Object.keys(list).length} jogador(es) em telagem restaurado(s).`);
    }
});
