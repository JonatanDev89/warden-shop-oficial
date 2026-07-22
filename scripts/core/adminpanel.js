import {
    CommandPermissionLevel,
    CustomCommandStatus,
    system,
    world,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { tryRunCommand } from "./commandUtils.js";
import { runClearLag } from "./clearLag.js";
import { getCommandSourceEntity, getOnlinePlayers as getOnlinePlayersCompat } from "./scriptCompat.js";
import {
    MODULES,
    clearPlayerBan,
    getAdminSetting,
    getAllBanEntries,
    getBanEntry,
    isAdmin,
    isModuleEnabled,
    loadAdminState,
    setAdminSetting,
    setPlayerBan,
    setModuleEnabled,
    showForm,
} from "./moduleState.js";
import {
    RANK_COLOR_OPTIONS,
    clearPlayerRank,
    createCustomRank,
    deleteCustomRank,
    formatRankBadge,
    formatRankTag,
    getAllRanks,
    getManualRankId,
    getPlayerRank,
    setPlayerRank,
    updateRankDisplay,
} from "./ranks.js";
import { getTeamSystem } from "../clan/teamManager.js";
import { openAuroraMainPanel } from "./CPS_Config.js";
import { TopPlayers } from "./topPlayers.js";
import { openCreateWarpForm } from "../essentials/warps.js";

const COLOR = "\u00a7";
const HOME_KEY = "player_homes";
const MUTE_KEY = "labsdev:muted_players";
const DEFAULT_BAN_REASON = "Banido pela staff.";
const EQUIPMENT_SLOTS = ["Head", "Chest", "Legs", "Feet", "Offhand"];
const ENDER_CHEST_COMPONENT_IDS = [
    "minecraft:ender_inventory",
    "minecraft:ender_chest_inventory",
    "minecraft:ender_chest",
    "minecraft:enderchest",
];
const SAFEZONE_NAME_PATTERN = /^[A-Za-z0-9 _-]{1,24}$/;
const PANEL_ICONS = Object.freeze({
    create: "textures/icons/clan_create",
    manage: "textures/icons/clan_manage",
    back: "textures/icons/clan_back",
});

// ── Medidor de TPS ──────────────────────────────────────────────────────────
let lastTickTime = Date.now();
let currentTPS = 20;
const tpsHistory = [];

system.runInterval(() => {
    const now = Date.now();
    const delta = now - lastTickTime;
    lastTickTime = now;
    
    // Calcula o TPS baseado no tempo real entre os intervalos de 1 tick (50ms ideal)
    const tps = Math.min(20, 1000 / delta);
    tpsHistory.push(tps);
    if (tpsHistory.length > 20) tpsHistory.shift();
    
    // Média dos últimos 20 ticks para um valor mais estável
    currentTPS = tpsHistory.reduce((a, b) => a + b, 0) / tpsHistory.length;
}, 1);

function getTPSColor(tps) {
    if (tps >= 18) return `${COLOR}a`; // Verde
    if (tps >= 14) return `${COLOR}e`; // Amarelo
    return `${COLOR}c`; // Vermelho
}

function panelTitle(title, color = `${COLOR}c`) {
    return `${color}${COLOR}l${title}`;
}

function panelBody(subtitle, lines = []) {
    return [
        `${COLOR}7+--------------------+`,
        `${COLOR}7| ${COLOR}fLabs Essentials ${COLOR}7|`,
        `${COLOR}7+--------------------+`,
        "",
        `${COLOR}f${subtitle}`,
        "",
        ...lines,
    ].join("\n");
}

function buttonText(color, title, subtitle) {
    return `${color}${COLOR}l${title}\n${COLOR}f${subtitle}`;
}

function textFieldOptions(defaultValue) {
    return { defaultValue: String(defaultValue ?? "") };
}

function toggleOptions(defaultValue) {
    return { defaultValue: defaultValue === true };
}

function dropdownOptions(defaultValueIndex) {
    const index = Math.max(0, Math.floor(Number(defaultValueIndex) || 0));
    return { defaultValueIndex: index };
}

function getCommandPlayer(origin) {
    return getCommandSourceEntity(origin);
}

function deny(player) {
    player?.sendMessage(`${COLOR}cApenas staff pode usar o admin panel.`);
}

function getOnlinePlayers() {
    try {
        return getOnlinePlayersCompat().sort((left, right) => left.name.localeCompare(right.name));
    } catch {
        return [];
    }
}

function findOnlinePlayer(name) {
    const targetName = String(name ?? "");
    const targetKey = targetName.trim().toLowerCase();
    try {
        return getOnlinePlayersCompat().find((player) => player.name === targetName || player.name.toLowerCase() === targetKey) ?? null;
    } catch {
        return null;
    }
}

function getNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function getFormNumber(value, fallback) {
    return getNumber(String(value ?? "").replace(",", "."), fallback);
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

function sendIfValid(player, message) {
    if (!isValidPlayer(player)) return false;

    try {
        player.sendMessage(message);
        return true;
    } catch {
        return false;
    }
}

function normalizeDimensionId(value) {
    const id = String(value || "minecraft:overworld");
    return id.startsWith("minecraft:") ? id : `minecraft:${id}`;
}

function getCustomSafeZones() {
    const safezones = getAdminSetting("safezones");
    const source = Array.isArray(safezones.zones) ? safezones.zones : [];

    return source.map((zone, index) => ({
        id: String(zone?.id ?? `zone_${index}`).trim() || `zone_${index}`,
        name: String(zone?.name ?? `SafeZone ${index + 1}`).trim().slice(0, 24) || `SafeZone ${index + 1}`,
        x: getNumber(zone?.x, 0),
        y: getNumber(zone?.y, 0),
        z: getNumber(zone?.z, 0),
        radius: Math.max(1, Math.floor(getNumber(zone?.radius, 25))),
        dimension: normalizeDimensionId(zone?.dimension ?? zone?.dimensionId),
        protectPvp: zone?.protectPvp !== false,
        protectExplosion: zone?.protectExplosion !== false,
        blockBuckets: zone?.blockBuckets !== false,
        blockInteract: zone?.blockInteract !== false,
        allowStaffBuild: zone?.allowStaffBuild !== false,
        removeEntities: zone?.removeEntities !== false,
        entryMsg: zone?.entryMsg || "§a✔ Você entrou na Safe Zone",
        exitMsg: zone?.exitMsg || "§c✖ Você saiu da Safe Zone",
        createdAt: Number.isFinite(Number(zone?.createdAt)) ? Number(zone.createdAt) : Date.now(),
    }));
}

function saveCustomSafeZones(zones) {
    setAdminSetting("safezones", { zones: Array.isArray(zones) ? zones : [] });
}

function createSafeZoneId() {
    return `zone_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getCustomSafeZone(zoneId) {
    return getCustomSafeZones().find((zone) => zone.id === zoneId) ?? null;
}

function formatZoneLocation(zone) {
    const dimension = String(zone.dimension ?? "minecraft:overworld").replace("minecraft:", "");
    return `${Number(zone.x).toFixed(1)}, ${Number(zone.y).toFixed(1)}, ${Number(zone.z).toFixed(1)} (${dimension})`;
}

function getSafeZoneStatusLine(zone) {
    return [
        zone.protectPvp !== false ? `${COLOR}aPvP` : `${COLOR}cPvP`,
        zone.protectExplosion !== false ? `${COLOR}aExp` : `${COLOR}cExp`,
        zone.blockBuckets !== false ? `${COLOR}aBalde` : `${COLOR}cBalde`,
    ].join(`${COLOR}7/`);
}

function cleanReason(reason, fallback = DEFAULT_BAN_REASON) {
    const text = String(reason ?? "").replace(/[\r\n]/g, " ").trim();
    return (text || fallback).slice(0, 120);
}

function escapeCommandText(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function runKickCommand(player, reason = DEFAULT_BAN_REASON) {
    if (!isValidPlayer(player)) return;

    const kickReason = cleanReason(reason);
    system.run(() => {
        if (tryRunCommand(player, `kick @s ${kickReason}`)) {
            return;
        }

        tryRunCommand(
            world.getDimension("overworld"),
            `kick "${escapeCommandText(player.name)}" ${kickReason}`
        );
    });
}

function enforcePlayerBan(player) {
    if (!isValidPlayer(player)) return false;

    const ban = getBanEntry({ playerName: player?.name, playerId: player?.id });
    if (!ban) return false;

    sendIfValid(player, `${COLOR}cVoce esta banido. Motivo: ${COLOR}f${ban.reason ?? DEFAULT_BAN_REASON}`);
    runKickCommand(player, ban.reason ?? DEFAULT_BAN_REASON);
    return true;
}

// ── Funções de inventário (corrigidas) ─────────────────────────────────────
function getInventoryContainer(player) {
    try {
        return player?.getComponent("minecraft:inventory")?.container ?? null;
    } catch {
        return null;
    }
}

function getContainerItemCount(container) {
    if (!container) return 0;
    try {
        let count = 0;
        for (let i = 0; i < container.size; i++) {
            if (container.getItem(i)) count++;
        }
        return count;
    } catch {
        return 0;
    }
}

function getContainerLines(container, emptyText = "Vazio.", start = 0, end = 35) {
    if (!container) return [emptyText];
    const lines = [];
    try {
        for (let i = start; i <= Math.min(end, container.size - 1); i++) {
            const item = container.getItem(i);
            if (item) {
                const name = item.nameTag ?? item.typeId.replace("minecraft:", "").replace(/_/g, " ");
                lines.push(`${COLOR}7[${i}] ${COLOR}f${name} ${COLOR}8x${item.amount}`);
            }
        }
    } catch {}
    return lines.length > 0 ? lines : [emptyText];
}

function clearContainerItems(container) {
    if (!container) return;
    try {
        for (let i = 0; i < container.size; i++) {
            container.setItem(i, undefined);
        }
    } catch {}
}

function clearEquipmentItems(player) {
    if (!player) return;
    try {
        const equipment = player.getComponent("minecraft:equippable");
        if (equipment) {
            for (const slot of ["Head", "Chest", "Legs", "Feet", "Offhand", "Mainhand"]) {
                try { equipment.setEquipment(slot, undefined); } catch {}
            }
        }
    } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

function refreshPlayerDisplay(player) {
    if (!isValidPlayer(player)) return;

    const teamSystem = isModuleEnabled("clan") ? getTeamSystem() : null;
    if (teamSystem?.updatePlayerDisplay) {
        try {
            teamSystem.updatePlayerDisplay(player);
        } catch {}
        return;
    }

    try {
        updateRankDisplay(player);
    } catch {}
}

export function openAdminPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const onlineCount = getOnlinePlayersCompat().length;
    const tpsColor = getTPSColor(currentTPS);
    const tpsText = currentTPS.toFixed(1);

    const form = new ActionFormData()
        .title(panelTitle("ADMIN PANEL"))
        .body(panelBody("Controle rápido do servidor:", [
            `${COLOR}7Staff: ${COLOR}f${player.name}`,
            `${COLOR}aJogadores online: ${COLOR}e${onlineCount} ${tpsColor}TPS: ${COLOR}e${tpsText}`
        ]))
        .button(buttonText(`${COLOR}e`, "Modulos", "Ativar/desativar sistemas"))
        .button(buttonText(`${COLOR}b`, "Config", "KB, CombatLog, SafeZone e ClearLag"))
        .button(buttonText(`${COLOR}a`, "Players", "Homes, inventario e ban"))
        .button(buttonText(`${COLOR}6`, "Spawn", "Setar local e raio"))
        .button(buttonText(`${COLOR}d`, "Ranks", "Setar cargo dos players"))
        .button(buttonText(`${COLOR}c`, "Bans", "Listar e remover bans"))
        .button(buttonText(`${COLOR}9`, "Clans", "Gerenciar clãs existentes"));
    showForm(form, player).then((result) => {
        if (result.canceled) return;
        if (result.selection === 0) openModulesPanel(player);
        if (result.selection === 1) openSettingsPanel(player);
        if (result.selection === 2) openStaffPlayersPanel(player);
        if (result.selection === 3) openSpawnPanel(player);
        if (result.selection === 4) openRanksPanel(player);
        if (result.selection === 5) openBansPanel(player);
        if (result.selection === 6) openAdminClansPanel(player);
    }).catch(() => {});
}

function openAdminClansPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const teamSystem = getTeamSystem();
    if (!teamSystem) {
        player.sendMessage(`${COLOR}cSistema de clãs não carregado.`);
        return;
    }

    const clans = Array.from(teamSystem.teams.values());
    const form = new ActionFormData()
        .title(panelTitle("GERENCIAR CLANS", `${COLOR}9`))
        .body(panelBody("Selecione um clã para gerenciar:", [
            `${COLOR}7Total de clãs: ${COLOR}f${clans.length}`,
        ]));

    for (const clan of clans) {
        form.button(buttonText(`${COLOR}9`, clan.name, `Tag: [${clan.tag}] - Membros: ${clan.members.size}`));
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Admin Panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === clans.length) {
            openAdminPanel(player);
            return;
        }

        const selectedClan = clans[result.selection];
        if (selectedClan) {
            openAdminClanDetailsPanel(player, selectedClan.name);
        }
    }).catch(() => {});
}

function openAdminClanDetailsPanel(player, clanName) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.teams.get(clanName);
    if (!team) {
        player.sendMessage(`${COLOR}cClã não encontrado.`);
        openAdminClansPanel(player);
        return;
    }

    const leaderName = team.members.get(team.leader) ?? "Desconhecido";
    const homeText = team.home ? `§a${Math.floor(team.home.x)}, ${Math.floor(team.home.y)}, ${Math.floor(team.home.z)}` : "§cNão definida";

    const form = new ActionFormData()
        .title(panelTitle(`CLAN: ${team.name}`, `${COLOR}9`))
        .body(panelBody("Informações e Gerenciamento:", [
            `${COLOR}7Tag: §f[${team.tag}]`,
            `${COLOR}7Líder: §f${leaderName}`,
            `${COLOR}7Membros: §f${team.members.size}/${team.settings?.maxMembers ?? 15}`,
            `${COLOR}7Home: ${homeText}`,
        ]))
        .button(buttonText(`${COLOR}e`, "Membros", "Listar e expulsar membros"))
        .button(buttonText(`${COLOR}a`, "Mudar Líder", "Transferir liderança"))
        .button(buttonText(`${COLOR}b`, "Mudar Limite", "Alterar limite de membros"))
        .button(buttonText(`${COLOR}d`, "Editar Nome/Tag", "Mudar visual do clã"))
        .button(buttonText(`${COLOR}a`, "Teleportar Base", "Ir até a home do clã"))
        .button(buttonText(`${COLOR}c`, "Excluir Clã", "Apagar clã permanentemente"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Lista de Clãs"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) openAdminClanMembersPanel(player, clanName);
        if (result.selection === 1) openAdminClanTransferLeadership(player, clanName);
        if (result.selection === 2) openAdminClanLimitForm(player, clanName);
        if (result.selection === 3) openAdminClanRenameForm(player, clanName);
        if (result.selection === 4) {
            if (team.home) {
                player.teleport({ x: team.home.x, y: team.home.y, z: team.home.z }, { dimension: world.getDimension(team.home.dimensionId ?? "overworld") });
                player.sendMessage(`${COLOR}aTeleportado para a base do clã ${team.name}.`);
            } else {
                player.sendMessage(`${COLOR}cEste clã não possui home definida.`);
                openAdminClanDetailsPanel(player, clanName);
            }
        }
        if (result.selection === 5) openAdminClanDeleteConfirm(player, clanName);
        if (result.selection === 6) openAdminClansPanel(player);
    }).catch(() => {});
}

function openAdminClanRenameForm(admin, clanName) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.teams.get(clanName);
    if (!team) return;

    const form = new ModalFormData()
        .title(panelTitle("EDITAR CLAN", `${COLOR}d`))
        .textField("Nome do clan", "Ex: §eL§fa§cb§es", { defaultValue: team.name })
        .textField("Tag do clan", "Ex: §eA§fS§cG", { defaultValue: team.tag });

    showForm(form, admin).then((result) => {
        if (result.canceled) {
            openAdminClanDetailsPanel(admin, clanName);
            return;
        }

        const newName = String(result.formValues[0] || "").trim();
        const newTag = String(result.formValues[1] || "").trim();

        // O líder no renameTeam é ignorado se passarmos o leaderId do próprio clã ou forçarmos
        const updateResult = teamSystem.renameTeam(clanName, team.leader, newName, newTag);
        admin.sendMessage(updateResult.msg);
        
        // Se o nome mudou, precisamos usar o novo nome para reabrir o painel
        const finalName = updateResult.retorna ? (newName.replace(/§./g, "").trim() || clanName) : clanName;
        
        // Forçar salvamento imediato após edição de admin
        if (updateResult.retorna) {
            teamSystem.markDirty();
            teamSystem.saveTeams();
        }
        
        openAdminClanDetailsPanel(admin, finalName);
    }).catch(() => {});
}

function openAdminClanMembersPanel(player, clanName) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.teams.get(clanName);
    if (!team) return;

    const members = Array.from(team.members.entries());
    const form = new ActionFormData()
        .title(panelTitle("MEMBROS DO CLÃ", `${COLOR}e`))
        .body(panelBody(`Clã: ${team.name}`, [
            `${COLOR}7Clique em um membro para expulsar.`,
        ]));

    for (const [id, name] of members) {
        const role = id === team.leader ? "§6[Líder]" : (team.subLeaders?.has(id) ? "§5[Sublíder]" : "§b[Membro]");
        form.button(buttonText(`${COLOR}f`, name, role));
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Detalhes do Clã"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === members.length) {
            openAdminClanDetailsPanel(player, clanName);
            return;
        }

        const [memberId, memberName] = members[result.selection];
        const confirm = new MessageFormData()
            .title("§c§lEXPULSAR MEMBRO")
            .body(`§7Você tem certeza que deseja expulsar §f${memberName} §7do clã §f${team.name}§7?`)
            .button1("§aConfirmar")
            .button2("§cCancelar");

        showForm(confirm, player).then((res) => {
            if (res.canceled || res.selection === 1) {
                openAdminClanMembersPanel(player, clanName);
                return;
            }

            const resultKick = teamSystem.kickFromTeam(memberId, clanName);
            player.sendMessage(resultKick.retorna ? `§a${resultKick.msg}` : `§c${resultKick.msg}`);
            openAdminClanMembersPanel(player, clanName);
        });
    }).catch(() => {});
}

function openAdminClanLimitForm(player, clanName) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.teams.get(clanName);
    if (!team) return;

    const form = new ModalFormData()
        .title(panelTitle("LIMITE DE MEMBROS", `${COLOR}b`))
        .textField("Novo limite de membros", "15", textFieldOptions(team.settings?.maxMembers ?? 15));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openAdminClanDetailsPanel(player, clanName);
            return;
        }

        const newLimit = Math.floor(getFormNumber(result.formValues[0], 15));
        const res = teamSystem.setTeamLimit(clanName, player.id, newLimit, true);
        
        // Forçar salvamento imediato após edição de admin
        if (res.retorna) {
            teamSystem.markDirty();
            teamSystem.saveTeams();
        }
        
        player.sendMessage(res.retorna ? `§a${res.msg}` : `§c${res.msg}`);
        openAdminClanDetailsPanel(player, clanName);
    }).catch(() => {});
}

function openAdminClanTransferLeadership(player, clanName) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.teams.get(clanName);
    if (!team) return;

    const members = Array.from(team.members.entries());
    const form = new ActionFormData()
        .title(panelTitle("TRANSFERIR LIDERANÇA", `${COLOR}a`))
        .body(panelBody(`Clã: ${team.name}`, [
            `${COLOR}7Selecione o novo líder:`,
        ]));

    for (const [id, name] of members) {
        form.button(buttonText(`${COLOR}f`, name, id === team.leader ? "§6[Líder Atual]" : "§7[Membro]"));
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Detalhes do Clã"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === members.length) {
            openAdminClanDetailsPanel(player, clanName);
            return;
        }

        const [newLeaderId, newLeaderName] = members[result.selection];
        const res = teamSystem.transferLeadership(clanName, team.leader, newLeaderId, true);
        player.sendMessage(res.retorna ? `§a${res.msg}` : `§c${res.msg}`);
        openAdminClanDetailsPanel(player, clanName);
    }).catch(() => {});
}

function openAdminClanDeleteConfirm(player, clanName) {
    const confirm = new MessageFormData()
        .title("§c§lEXCLUIR CLÃ")
        .body(`§7Você tem certeza que deseja §cEXCLUIR PERMANENTEMENTE §7o clã §f${clanName}§7?\n\n§c§lAVISO: §r§7Esta ação não pode ser desfeita e todos os membros serão expulsos.`)
        .button1("§aConfirmar Exclusão")
        .button2("§cCancelar");

    showForm(confirm, player).then((res) => {
        if (res.canceled || res.selection === 1) {
            openAdminClanDetailsPanel(player, clanName);
            return;
        }

        const teamSystem = getTeamSystem();
        const result = teamSystem.deleteTeam(clanName);
        player.sendMessage(result.retorna ? `§a${result.msg}` : `§c${result.msg}`);
        openAdminClansPanel(player);
    });
}

function openModulesPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const state = loadAdminState();
    const form = new ActionFormData()
        .title(panelTitle("MODULOS", `${COLOR}e`))
        .body(panelBody("Clique para alternar:", [
            `${COLOR}aLigado ${COLOR}7/ ${COLOR}cDesligado`,
        ]));

    for (const module of MODULES) {
        const enabled = state.modules[module.id] !== false;
        form.button(buttonText(enabled ? `${COLOR}a` : `${COLOR}c`, module.label, enabled ? "Ligado" : "Desligado"));
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === MODULES.length) {
            openAdminPanel(player);
            return;
        }

        const module = MODULES[result.selection];
        if (!module) return;

        const enabled = state.modules[module.id] !== false;
        setModuleEnabled(module.id, !enabled);
        if (module.id === "ranks" || module.id === "clan" || module.id === "top_players") {
            for (const target of getOnlinePlayers()) {
                refreshPlayerDisplay(target);
            }
        }
        player.sendMessage(`${COLOR}e${module.label}: ${!enabled ? `${COLOR}aON` : `${COLOR}cOFF`}`);
        openModulesPanel(player);
    }).catch(() => {});
}

function openSettingsPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const combat = getAdminSetting("combatlog");
    const clearLag = getAdminSetting("clearlag");
    const mobStacker = getAdminSetting("mobstacker");
    const safeZoneCount = getCustomSafeZones().length + 1;
    const form = new ActionFormData()
        .title(panelTitle("CONFIG", `${COLOR}b`))
        .body(panelBody("Ajustes rapidos:", [
            `${COLOR}7CombatLog: ${COLOR}f${getNumber(combat.seconds, 20)}s`,
            `${COLOR}7ClearLag: ${COLOR}f${getNumber(clearLag.intervalSeconds, 180)}s`,
            `${COLOR}7MobStacker: ${COLOR}f${getNumber(mobStacker.maxStack, 64)} por stack`,
            `${COLOR}7SafeZones: ${COLOR}f${safeZoneCount} ${COLOR}8(spawn + extras)`,
        ]))
        .button(buttonText(`${COLOR}c`, "CombatLog", "Tempo e punicoes"))
        .button(buttonText(`${COLOR}e`, "ClearLag", "Intervalo e alvos da limpeza"))
        .button(buttonText(`${COLOR}a`, "Mob Stacker", "Raio, limite e nomes"))
        .button(buttonText(`${COLOR}6`, "SafeZone", "PvP, build staff e entidades"))
        .button(buttonText(`${COLOR}u`, "CPS CONFIG", "Monitoramento e Ranking"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) openCombatLogPanel(player);
        if (result.selection === 1) openClearLagPanel(player);
        if (result.selection === 2) openMobStackerPanel(player);
        if (result.selection === 3) openSafeZonePanel(player);
        if (result.selection === 4) openAuroraMainPanel(player);
        if (result.selection === 5) openAdminPanel(player);
    }).catch(() => {});
}

function openCombatLogPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const combat = getAdminSetting("combatlog");
    const form = new ModalFormData()
        .title(panelTitle("COMBATE PRO", `${COLOR}c`))
        .toggle("Ativar CombatLog", toggleOptions(isModuleEnabled("combatlog")))
        .toggle("Punir logout em combate", toggleOptions(combat.punishOnLogout !== false))
        .toggle("Ativar raio virtual das SafeZones", toggleOptions(combat.disableInSpawn !== false))
        .toggle("Ativar Drop-de-itens", toggleOptions(combat.dropItems !== false))
        .toggle("Ativar Perda-de-itens", toggleOptions(combat.killOnJoin !== false))
        .toggle("Ignorar criativo", toggleOptions(combat.ignoreCreative !== false))
        .textField("Tempo em combate (segundos)", "20", textFieldOptions(getNumber(combat.seconds, 20)));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openSettingsPanel(player);
            return;
        }

        const seconds = Math.max(1, Math.floor(getFormNumber(result.formValues?.[6], 20)));
        setModuleEnabled("combatlog", result.formValues?.[0] !== false);
        setAdminSetting("combatlog", {
            seconds,
            punishOnLogout: result.formValues?.[1] !== false,
            disableInSpawn: result.formValues?.[2] !== false,
            dropItems: result.formValues?.[3] !== false,
            killOnJoin: result.formValues?.[4] !== false,
            ignoreCreative: result.formValues?.[5] !== false,
        });

        player.sendMessage(`${COLOR}aCombatLog atualizado. Status: ${isModuleEnabled("combatlog") ? `${COLOR}aON` : `${COLOR}cOFF`}${COLOR}a.`);
        openSettingsPanel(player);
    }).catch(() => {});
}

function openSafeZonePanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const zones = getCustomSafeZones();
    const form = new ActionFormData()
        .title(panelTitle("PROTECTION SERVER", `${COLOR}6`))
        .body(panelBody("Gerencie as protecoes do seu servidor aqui.", [
            `${COLOR}7Status ${isModuleEnabled("safezone") ? `${COLOR}aON` : `${COLOR}cOFF`}`,
            `${COLOR}7Areas criadas: ${COLOR}f${zones.length}`,
            `${COLOR}7Feito por: ${COLOR}fEoo adzX`,
        ]))
        .button(buttonText(`${COLOR}f`, "+ Nova area", "Criar protecao"), PANEL_ICONS.create)
        .button(buttonText(`${COLOR}e`, "Gerenciar areas", "Configurar PvP/Mobs"), PANEL_ICONS.manage)
        .button(buttonText(`${COLOR}c`, "Fechar Menu", "Sair do painel"), PANEL_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) system.run(() => openCreateSafeZoneForm(player));
        if (result.selection === 1) system.run(() => openSafeZoneManagePanel(player));
        if (result.selection === 2) openSettingsPanel(player);
    }).catch(() => {});
}

function openSafeZoneManagePanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const form = new ActionFormData()
        .title(panelTitle("GERENCIAR AREAS", `${COLOR}e`))
        .body(panelBody("Escolha o que configurar:", [
            `${COLOR}7Modulo: ${isModuleEnabled("safezone") ? `${COLOR}aLigado` : `${COLOR}cDesligado`}`,
            `${COLOR}7Spawn e areas extras usam PvP, build de staff e limpeza de mobs.`,
        ]))
        .button(buttonText(`${COLOR}a`, "Areas extras", "Editar ou remover protecoes"), PANEL_ICONS.manage)
        .button(buttonText(`${COLOR}6`, "Area do Spawn", "Centro, raio e regras"), PANEL_ICONS.create)
        .button(buttonText(`${COLOR}c`, isModuleEnabled("safezone") ? "Desligar protecao" : "Ligar protecao", "Alternar modulo"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Protection Server"), PANEL_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) system.run(() => openCustomSafeZoneList(player));
        if (result.selection === 1) system.run(() => openSpawnSafeZonePanel(player));
        if (result.selection === 2) {
            setModuleEnabled("safezone", !isModuleEnabled("safezone"));
            system.run(() => openSafeZoneManagePanel(player));
        }
        if (result.selection === 3) openSafeZonePanel(player);
    }).catch(() => {});
}

function openCreateSafeZoneForm(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const form = new ModalFormData()
        .title(panelTitle("CRIAR SAFEZONE", `${COLOR}a`))
        .textField("Nome", "loja")
        .textField("Raio", "50", textFieldOptions("50"))
        .toggle("Proteger PvP", toggleOptions(true))
        .toggle("Proteger contra Crystal/Explosão", toggleOptions(true))
        .toggle("Bloquear Baldes/Fogo", toggleOptions(true))
        .toggle("Bloquear Interação (Baús/Máquinas)", toggleOptions(true))
        .toggle("Staff pode quebrar blocos", toggleOptions(true))
        .toggle("Remover entidades", toggleOptions(true))
        .textField("Msg Entrada", "§a✔ Você entrou na Safe Zone", textFieldOptions("§a✔ Você entrou na Safe Zone"))
        .textField("Msg Saída", "§c✖ Você saiu da Safe Zone", textFieldOptions("§c✖ Você saiu da Safe Zone"));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openSafeZonePanel(player);
            return;
        }

        const name = String(result.formValues?.[0] ?? "").trim();
        const radius = Math.max(1, Math.floor(getFormNumber(result.formValues?.[1], 50)));

        if (!SAFEZONE_NAME_PATTERN.test(name)) {
            player.sendMessage(`${COLOR}cUse um nome com 1 a 24 caracteres.`);
            system.run(() => openCreateSafeZoneForm(player));
            return;
        }

        const loc = player.location;
        const zones = getCustomSafeZones();
        zones.push({
            id: createSafeZoneId(),
            name,
            x: loc.x,
            y: loc.y,
            z: loc.z,
            radius,
            dimension: normalizeDimensionId(player.dimension?.id),
            protectPvp: result.formValues?.[2] !== false,
            protectExplosion: result.formValues?.[3] !== false,
            blockBuckets: result.formValues?.[4] !== false,
            blockInteract: result.formValues?.[5] !== false,
            allowStaffBuild: result.formValues?.[6] !== false,
            removeEntities: result.formValues?.[7] !== false,
            entryMsg: result.formValues?.[8] || "§a✔ Você entrou na Safe Zone",
            exitMsg: result.formValues?.[9] || "§c✖ Você saiu da Safe Zone",
            createdAt: Date.now(),
        });

        saveCustomSafeZones(zones);
        player.sendMessage(`${COLOR}aSafeZone ${COLOR}f${name}${COLOR}a criada.`);
        openSafeZonePanel(player);
    }).catch(() => {});
}

function openCustomSafeZoneList(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const zones = getCustomSafeZones();
    const form = new ActionFormData()
        .title(panelTitle("SAFEZONES", `${COLOR}b`))
        .body(panelBody("Zonas extras:", [
            `${COLOR}7Total: ${COLOR}f${zones.length}`,
        ]));

    for (const zone of zones) {
        form.button(buttonText(`${COLOR}a`, zone.name, `R ${zone.radius} | ${formatZoneLocation(zone)}`));
    }

    form.button(buttonText(`${COLOR}a`, "Criar aqui", "Nova SafeZone na sua posicao"));
    form.button(buttonText(`${COLOR}7`, "Voltar", "SafeZone"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === zones.length) {
            system.run(() => openCreateSafeZoneForm(player));
            return;
        }

        if (result.selection === zones.length + 1) {
            openSafeZonePanel(player);
            return;
        }

        const zone = zones[result.selection];
        if (zone) system.run(() => openCustomSafeZonePanel(player, zone.id));
    }).catch(() => {});
}

function openCustomSafeZonePanel(player, zoneId) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const zone = getCustomSafeZone(zoneId);
    if (!zone) {
        player.sendMessage(`${COLOR}cSafeZone nao encontrada.`);
        system.run(() => openCustomSafeZoneList(player));
        return;
    }

    const form = new ActionFormData()
        .title(panelTitle(zone.name, `${COLOR}a`))
        .body(panelBody("Detalhes da SafeZone:", [
            `${COLOR}7Meio: ${COLOR}f${formatZoneLocation(zone)}`,
            `${COLOR}7Raio: ${COLOR}f${zone.radius}`,
            `${COLOR}7Regras: ${getSafeZoneStatusLine(zone)}`,
        ]))
        .button(buttonText(`${COLOR}a`, "Setar meio aqui", "Usar sua posicao atual"))
        .button(buttonText(`${COLOR}e`, "Editar", "Nome, raio e mensagens"))
        .button(buttonText(`${COLOR}c`, "Excluir", "Remover esta SafeZone"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Lista"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            const loc = player.location;
            const zones = getCustomSafeZones().map((entry) => (
                entry.id === zone.id
                    ? { ...entry, x: loc.x, y: loc.y, z: loc.z, dimension: normalizeDimensionId(player.dimension?.id) }
                    : entry
            ));

            saveCustomSafeZones(zones);
            player.sendMessage(`${COLOR}aMeio da SafeZone atualizado.`);
            system.run(() => openCustomSafeZonePanel(player, zone.id));
            return;
        }

        if (result.selection === 1) system.run(() => openEditCustomSafeZoneForm(player, zone.id));
        if (result.selection === 2) system.run(() => confirmDeleteCustomSafeZone(player, zone.id));
        if (result.selection === 3) system.run(() => openCustomSafeZoneList(player));
    }).catch(() => {});
}

function openEditCustomSafeZoneForm(player, zoneId) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const zone = getCustomSafeZone(zoneId);
    if (!zone) {
        player.sendMessage(`${COLOR}cSafeZone nao encontrada.`);
        system.run(() => openCustomSafeZoneList(player));
        return;
    }

    const form = new ModalFormData()
        .title(panelTitle("EDITAR SAFEZONE", `${COLOR}e`))
        .textField("Nome", zone.name, textFieldOptions(zone.name))
        .textField("Raio", "50", textFieldOptions(zone.radius))
        .toggle("Proteger PvP", toggleOptions(zone.protectPvp !== false))
        .toggle("Proteger contra Crystal/Explosão", toggleOptions(zone.protectExplosion !== false))
        .toggle("Bloquear Baldes/Fogo", toggleOptions(zone.blockBuckets !== false))
        .toggle("Bloquear Interação (Baús/Máquinas)", toggleOptions(zone.blockInteract !== false))
        .toggle("Staff pode quebrar blocos", toggleOptions(zone.allowStaffBuild !== false))
        .toggle("Remover entidades", toggleOptions(zone.removeEntities !== false))
        .textField("Msg Entrada", zone.entryMsg || "§a✔ Você entrou na Safe Zone", textFieldOptions(zone.entryMsg))
        .textField("Msg Saída", zone.exitMsg || "§c✖ Você saiu da Safe Zone", textFieldOptions(zone.exitMsg));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            system.run(() => openCustomSafeZonePanel(player, zone.id));
            return;
        }

        const name = String(result.formValues?.[0] ?? "").trim();
        const radius = Math.max(1, Math.floor(getFormNumber(result.formValues?.[1], zone.radius)));

        if (!SAFEZONE_NAME_PATTERN.test(name)) {
            player.sendMessage(`${COLOR}cUse um nome com 1 a 24 caracteres.`);
            system.run(() => openEditCustomSafeZoneForm(player, zone.id));
            return;
        }

        const zones = getCustomSafeZones().map((entry) => (
            entry.id === zone.id
                ? {
                    ...entry,
                    name,
                    radius,
                    protectPvp: result.formValues?.[2] !== false,
                    protectExplosion: result.formValues?.[3] !== false,
                    blockBuckets: result.formValues?.[4] !== false,
                    blockInteract: result.formValues?.[5] !== false,
                    allowStaffBuild: result.formValues?.[6] !== false,
                    removeEntities: result.formValues?.[7] !== false,
                    entryMsg: result.formValues?.[8],
                    exitMsg: result.formValues?.[9],
                }
                : entry
        ));

        saveCustomSafeZones(zones);
        player.sendMessage(`${COLOR}aSafeZone atualizada.`);
        system.run(() => openCustomSafeZonePanel(player, zone.id));
    }).catch(() => {});
}

function confirmDeleteCustomSafeZone(player, zoneId) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const zone = getCustomSafeZone(zoneId);
    if (!zone) {
        player.sendMessage(`${COLOR}cSafeZone nao encontrada.`);
        system.run(() => openCustomSafeZoneList(player));
        return;
    }

    const form = new ActionFormData()
        .title(panelTitle("EXCLUIR SAFEZONE", `${COLOR}c`))
        .body(panelBody("Confirmar remocao:", [
            `${COLOR}7SafeZone: ${COLOR}f${zone.name}`,
            `${COLOR}7Meio: ${COLOR}f${formatZoneLocation(zone)}`,
        ]))
        .button(buttonText(`${COLOR}c`, "Excluir", "Remover agora"))
        .button(buttonText(`${COLOR}a`, "Cancelar", "Manter SafeZone"));

    showForm(form, player).then((result) => {
        if (result.canceled || result.selection === 1) {
            system.run(() => openCustomSafeZonePanel(player, zone.id));
            return;
        }

        saveCustomSafeZones(getCustomSafeZones().filter((entry) => entry.id !== zone.id));
        player.sendMessage(`${COLOR}aSafeZone ${COLOR}f${zone.name}${COLOR}a removida.`);
        system.run(() => openCustomSafeZoneList(player));
    }).catch(() => {});
}

function openSpawnSafeZonePanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const spawn = getAdminSetting("spawn");
    const zone = {
        name: "Spawn",
        x: getNumber(spawn.x, 213.71),
        y: getNumber(spawn.y, 67.5),
        z: getNumber(spawn.z, 946.33),
        radius: getNumber(spawn.radius, 100),
        dimension: normalizeDimensionId(spawn.dimension),
        protectPvp: spawn.protectPvp,
        protectExplosion: spawn.protectExplosion,
        blockBuckets: spawn.blockBuckets,
        blockInteract: spawn.blockInteract,
        allowStaffBuild: spawn.allowStaffBuild,
        removeEntities: spawn.removeEntities,
        entryMsg: spawn.entryMsg || "§a✔ Você entrou na Safe Zone",
        exitMsg: spawn.exitMsg || "§c✖ Você saiu da Safe Zone",
    };

    const form = new ActionFormData()
        .title(panelTitle("SAFEZONE SPAWN", `${COLOR}e`))
        .body(panelBody("Zona principal:", [
            `${COLOR}7Meio: ${COLOR}f${formatZoneLocation(zone)}`,
            `${COLOR}7Raio: ${COLOR}f${zone.radius}`,
            `${COLOR}7Regras: ${getSafeZoneStatusLine(zone)}`,
        ]))
        .button(buttonText(`${COLOR}a`, "Setar meio aqui", "Usar sua posicao atual"))
        .button(buttonText(`${COLOR}e`, "Editar raio/mensagens", "PvP, build, e mensagens"))
        .button(buttonText(`${COLOR}7`, "Voltar", "SafeZone"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            const loc = player.location;
            setAdminSetting("spawn", {
                x: loc.x,
                y: loc.y,
                z: loc.z,
                dimension: normalizeDimensionId(player.dimension?.id),
            });
            player.sendMessage(`${COLOR}aMeio da SafeZone do spawn atualizado.`);
            system.run(() => openSpawnSafeZonePanel(player));
            return;
        }

        if (result.selection === 1) system.run(() => openSpawnSafeZoneSettingsForm(player));
        if (result.selection === 2) openSafeZonePanel(player);
    }).catch(() => {});
}

function openSpawnSafeZoneSettingsForm(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const spawn = getAdminSetting("spawn");
    const form = new ModalFormData()
        .title(panelTitle("EDITAR SAFEZONE SPAWN", `${COLOR}6`))
        .toggle("Proteger PvP", toggleOptions(spawn.protectPvp !== false))
        .toggle("Proteger contra Crystal/Explosão", toggleOptions(spawn.protectExplosion !== false))
        .toggle("Bloquear Baldes/Fogo", toggleOptions(spawn.blockBuckets !== false))
        .toggle("Bloquear Interação (Baús/Máquinas)", toggleOptions(spawn.blockInteract !== false))
        .toggle("Staff pode quebrar blocos", toggleOptions(spawn.allowStaffBuild !== false))
        .toggle("Remover entidades", toggleOptions(spawn.removeEntities !== false))
        .textField("Raio da safezone", "100", textFieldOptions(getNumber(spawn.radius, 100)))
        .textField("Msg Entrada", spawn.entryMsg || "§a✔ Você entrou na Safe Zone", textFieldOptions(spawn.entryMsg))
        .textField("Msg Saída", spawn.exitMsg || "§c✖ Você saiu da Safe Zone", textFieldOptions(spawn.exitMsg));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            system.run(() => openSpawnSafeZonePanel(player));
            return;
        }

        const radius = Math.max(0, Math.floor(getFormNumber(result.formValues?.[6], getNumber(spawn.radius, 100))));
        setAdminSetting("spawn", {
            protectPvp: result.formValues?.[0] !== false,
            protectExplosion: result.formValues?.[1] !== false,
            blockBuckets: result.formValues?.[2] !== false,
            blockInteract: result.formValues?.[3] !== false,
            allowStaffBuild: result.formValues?.[4] !== false,
            removeEntities: result.formValues?.[5] !== false,
            radius,
            entryMsg: result.formValues?.[7],
            exitMsg: result.formValues?.[8],
        });

        player.sendMessage(`${COLOR}aSafeZone atualizada.`);
        system.run(() => openSpawnSafeZonePanel(player));
    }).catch(() => {});
}

// ... RESTANTE DO ARQUIVO ORIGINAL (BANIMENTOS, RANKS, INVENTÁRIOS, ETC.) ...
// INÍCIO DA PARTE RESTAURADA

function openStaffPlayersPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const players = getOnlinePlayers();
    const form = new ActionFormData()
        .title(panelTitle("PLAYERS", `${COLOR}a`))
        .body(panelBody("Escolha um jogador:", [
            `${COLOR}7Online: ${COLOR}f${players.length}`,
        ]));

    for (const target of players) {
        form.button(buttonText(`${COLOR}f`, target.name, "Ver detalhes e gerenciar"));
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === players.length) {
            openAdminPanel(player);
            return;
        }

        const target = players[result.selection];
        if (target) system.run(() => openPlayerDetailsPanel(player, target.name));
    }).catch(() => {});
}

function openPlayerDetailsPanel(admin, targetName) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const target = findOnlinePlayer(targetName);
    if (!target) {
        admin.sendMessage(`${COLOR}cJogador saiu do servidor.`);
        system.run(() => openStaffPlayersPanel(admin));
        return;
    }

    const rank = getPlayerRank(target);
    const form = new ActionFormData()
        .title(panelTitle(target.name, rank.color))
        .body(panelBody("Informacoes do jogador:", [
            `${COLOR}7Nome: ${COLOR}f${target.name}`,
            `${COLOR}7Rank: ${rank.color}${rank.label}`,
            `${COLOR}7Vida: ${COLOR}f${Math.ceil(target.getComponent("minecraft:health")?.currentValue ?? 0)}/20`,
            `${COLOR}7Posicao: ${COLOR}f${target.location.x.toFixed(1)}, ${target.location.y.toFixed(1)}, ${target.location.z.toFixed(1)}`,
        ]))
        .button(buttonText(`${COLOR}e`, "Homes", "Ver e deletar homes"))
        .button(buttonText(`${COLOR}b`, "Inventario", "Ver itens e ender chest"))
        .button(buttonText(`${COLOR}d`, "Rank", "Alterar cargo"))
        .button(buttonText(`${COLOR}c`, "Banir", "Banir por motivo"))
        .button(buttonText(`${COLOR}e`, "Mute", "Mutar/Desmutar chat"))
        .button(buttonText(`${COLOR}6`, "Teleportar", "Ir ate o jogador"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Lista de players"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) system.run(() => openPlayerHomesPanel(admin, target.name));
        if (result.selection === 1) system.run(() => openPlayerInventoryPanel(admin, target.name));
        if (result.selection === 2) system.run(() => openPlayerRankPanel(admin, target.name));
        if (result.selection === 3) system.run(() => openBanOnlinePlayerForm(admin, target.name));
        if (result.selection === 4) system.run(() => openMutePlayerForm(admin, target));
        if (result.selection === 5) {
            tryRunCommand(admin, `tp @s "${escapeCommandText(target.name)}"`);
            admin.sendMessage(`${COLOR}aTeleportado para ${COLOR}f${target.name}${COLOR}a.`);
        }
        if (result.selection === 6) system.run(() => openStaffPlayersPanel(admin));
    }).catch(() => {});
}

function openPlayerHomesPanel(admin, targetName) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const target = findOnlinePlayer(targetName);
    if (!target) {
        admin.sendMessage(`${COLOR}cJogador saiu do servidor.`);
        system.run(() => openStaffPlayersPanel(admin));
        return;
    }

    const homesRaw = target.getDynamicProperty(HOME_KEY);
    let homesMap = {};
    try {
        if (typeof homesRaw === "string") {
            homesMap = JSON.parse(homesRaw);
        } else if (typeof homesRaw === "object" && homesRaw !== null) {
            homesMap = homesRaw;
        }
    } catch {
        homesMap = {};
    }

    // O sistema de homes usa um objeto { nome: {x,y,z,dimension} }
    const homeNames = Object.keys(homesMap).sort();
    const homesList = homeNames.map(name => ({
        name: name,
        ...homesMap[name]
    }));

    const form = new ActionFormData()
        .title(panelTitle(`HOMES: ${targetName}`, `${COLOR}e`))
        .body(panelBody("Lista de homes do jogador:", [
            `${COLOR}7Total: ${COLOR}f${homeNames.length}`,
            `${COLOR}7Admin: ${COLOR}f${admin.name}`
        ]));

    for (const home of homesList) {
        const dim = String(home.dimension || home.dimensionId || "overworld").replace("minecraft:", "");
        form.button(buttonText(`${COLOR}f`, home.name, `§7${home.x.toFixed(0)}, ${home.y.toFixed(0)}, ${home.z.toFixed(0)} (${dim})`));
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Detalhes do player"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        if (result.selection === homesList.length) {
            system.run(() => openPlayerDetailsPanel(admin, targetName));
            return;
        }

        const home = homesList[result.selection];
        if (home) system.run(() => openPlayerHomeActions(admin, targetName, home));
    }).catch(() => {});
}

function openPlayerHomeActions(admin, targetName, home) {
    const form = new ActionFormData()
        .title(panelTitle(`HOME: ${home.name}`, `${COLOR}e`))
        .body(panelBody("Escolha uma acao:", [
            `${COLOR}7Player: ${COLOR}f${targetName}`,
            `${COLOR}7Local: ${COLOR}f${home.x.toFixed(0)}, ${home.y.toFixed(0)}, ${home.z.toFixed(0)}`
        ]))
        .button(buttonText(`${COLOR}a`, "Teleportar", "Ir ate a home"))
        .button(buttonText(`${COLOR}c`, "Deletar", "Remover home"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Lista de homes"));

    showForm(form, admin).then((result) => {
        if (result.canceled || result.selection === 2) {
            system.run(() => openPlayerHomesPanel(admin, targetName));
            return;
        }

        if (result.selection === 0) {
            const dimId = home.dimensionId || home.dimension || "minecraft:overworld";
            const dimension = world.getDimension(dimId);
            admin.teleport({ x: home.x, y: home.y, z: home.z }, { dimension });
            admin.sendMessage(`${COLOR}aTeleportado para a home ${COLOR}f${home.name} ${COLOR}ade ${COLOR}f${targetName}${COLOR}a.`);
        } else if (result.selection === 1) {
            system.run(() => confirmDeletePlayerHome(admin, targetName, home.name));
        }
    }).catch(() => {});
}

function confirmDeletePlayerHome(admin, targetName, homeName) {
    const form = new ActionFormData()
        .title(panelTitle("DELETAR HOME", `${COLOR}c`))
        .body(panelBody("Confirmar remocao:", [
            `${COLOR}7Player: ${COLOR}f${targetName}`,
            `${COLOR}7Home: ${COLOR}f${homeName}`,
        ]))
        .button(buttonText(`${COLOR}c`, "Deletar", "Remover agora"))
        .button(buttonText(`${COLOR}a`, "Cancelar", "Manter home"));

    showForm(form, admin).then((result) => {
        if (result.canceled || result.selection === 1) {
            system.run(() => openPlayerHomesPanel(admin, targetName));
            return;
        }

        const target = findOnlinePlayer(targetName);
        if (target) {
            const homes = target.getDynamicProperty(HOME_KEY) ? JSON.parse(target.getDynamicProperty(HOME_KEY)) : [];
            const filtered = homes.filter(h => h.name !== homeName);
            target.setDynamicProperty(HOME_KEY, JSON.stringify(filtered));
            admin.sendMessage(`${COLOR}aHome ${COLOR}f${homeName}${COLOR}a de ${COLOR}f${targetName}${COLOR}a deletada.`);
        }
        system.run(() => openPlayerHomesPanel(admin, targetName));
    }).catch(() => {});
}

function openPlayerInventoryPanel(admin, targetName) {
    const target = findOnlinePlayer(targetName);
    if (!target) {
        admin.sendMessage(`${COLOR}cJogador offline.`);
        return;
    }

    const inventory = getInventoryContainer(target);
    const invCount = getContainerItemCount(inventory) ?? 0;
    
    const form = new ActionFormData()
        .title(panelTitle(`INV: ${target.name}`, `${COLOR}b`))
        .body(panelBody("Escolha o que ver:", [
            `${COLOR}7Itens no inv: ${COLOR}f${invCount}/36`,
        ]))
        .button(buttonText(`${COLOR}e`, "Ver Hotbar", "Slots 0-8"))
        .button(buttonText(`${COLOR}b`, "Ver Inventario", "Todos os slots"))
        .button(buttonText(`${COLOR}d`, "Ender Chest", "Ver bau do fim"))
        .button(buttonText(`${COLOR}c`, "Limpar Tudo", "Deletar todos os itens"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Detalhes do player"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        if (result.selection === 0) system.run(() => openContainerView(admin, target, inventory, "HOTBAR", 0, 8));
        if (result.selection === 1) system.run(() => openContainerView(admin, target, inventory, "INVENTARIO", 0, 35));
        if (result.selection === 2) {
            const ender = getEnderChestContainer(target);
            system.run(() => openContainerView(admin, target, ender, "ENDER CHEST", 0, 26));
        }
        if (result.selection === 3) system.run(() => confirmClearInventory(admin, targetName));
        if (result.selection === 4) system.run(() => openPlayerDetailsPanel(admin, targetName));
    }).catch(() => {});
}

function getEnderChestContainer(player) {
    for (const id of ENDER_CHEST_COMPONENT_IDS) {
        try {
            const container = player.getComponent(id)?.container;
            if (container) return container;
        } catch {}
    }
    return null;
}

function openContainerView(admin, target, container, label, start, end) {
    if (!container) {
        admin.sendMessage(`${COLOR}cContainer não encontrado.`);
        system.run(() => openPlayerInventoryPanel(admin, target.name));
        return;
    }

    const items = [];
    const form = new ActionFormData()
        .title(panelTitle(label, `${COLOR}b`))
        .body(panelBody(`${target.name}:`, [`${COLOR}7Clique em um item para removê-lo.`]));

    for (let i = start; i <= Math.min(end, container.size - 1); i++) {
        const item = container.getItem(i);
        if (item) {
            const name = item.nameTag ?? item.typeId.replace("minecraft:", "").replace(/_/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            form.button(buttonText(`${COLOR}f`, name, `Slot: ${i} - Quantidade: ${item.amount}`));
            items.push({ slot: i, name, typeId: item.typeId });
        }
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Menu de inv"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;

        if (result.selection === items.length) {
            system.run(() => openPlayerInventoryPanel(admin, target.name));
            return;
        }

        const selected = items[result.selection];
        const confirm = new MessageFormData()
            .title("§c§lREMOVER ITEM")
            .body(`§7Deseja remover §f${selected.name} §7do slot §f${selected.slot} §7de §f${target.name}§7?`)
            .button1("§aConfirmar")
            .button2("§cCancelar");

        showForm(confirm, admin).then((res) => {
            if (res.canceled || res.selection === 1) {
                openContainerView(admin, target, container, label, start, end);
                return;
            }

            try {
                container.setItem(selected.slot, undefined);
                admin.sendMessage(`${COLOR}aItem ${selected.name} removido com sucesso.`);
            } catch (e) {
                admin.sendMessage(`${COLOR}cErro ao remover item.`);
            }
            openContainerView(admin, target, container, label, start, end);
        });
    }).catch(() => {});
}

function confirmClearInventory(admin, targetName) {
    const form = new ActionFormData()
        .title(panelTitle("LIMPAR INV", `${COLOR}c`))
        .body(panelBody("Confirmar limpeza total:", [`${COLOR}7Player: ${COLOR}f${targetName}`]))
        .button(buttonText(`${COLOR}c`, "Limpar", "Deletar tudo"))
        .button(buttonText(`${COLOR}a`, "Cancelar", "Manter itens"));

    showForm(form, admin).then((result) => {
        if (result.canceled || result.selection === 1) {
            system.run(() => openPlayerInventoryPanel(admin, targetName));
            return;
        }

        const target = findOnlinePlayer(targetName);
        if (target) {
            clearContainerItems(getInventoryContainer(target));
            clearEquipmentItems(target);
            admin.sendMessage(`${COLOR}aInventario de ${COLOR}f${targetName}${COLOR}a limpo.`);
        }
        system.run(() => openPlayerInventoryPanel(admin, targetName));
    }).catch(() => {});
}

function openSpawnPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const spawn = getAdminSetting("spawn");
    const form = new ActionFormData()
        .title(panelTitle("SPAWN", `${COLOR}6`))
        .body(panelBody("Configuracao do spawn:", [
            `${COLOR}7X: ${COLOR}f${Number(spawn.x ?? 0).toFixed(2)}`,
            `${COLOR}7Y: ${COLOR}f${Number(spawn.y ?? 0).toFixed(2)}`,
            `${COLOR}7Z: ${COLOR}f${Number(spawn.z ?? 0).toFixed(2)}`,
            `${COLOR}7Dimensao: ${COLOR}f${String(spawn.dimension ?? "minecraft:overworld").replace("minecraft:", "")}`,
            `${COLOR}7Raio safezone: ${COLOR}f${spawn.radius ?? 100}`,
            `${COLOR}7PvP protegido: ${spawn.protectPvp !== false ? `${COLOR}aSim` : `${COLOR}cNao`}`,
        ]))
        .button(buttonText(`${COLOR}a`, "Setar aqui", "Usar sua posicao atual"))
        .button(buttonText(`${COLOR}e`, "Editar raio", "Safe zone do spawn"))
        .button(buttonText(`${COLOR}6`, "SafeZone", "Protecoes do spawn"))
        .button(buttonText(`${COLOR}c`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            const loc = player.location;
            setAdminSetting("spawn", {
                x: loc.x,
                y: loc.y,
                z: loc.z,
                dimension: player.dimension.id,
            });
            player.sendMessage(`${COLOR}aSpawn atualizado.`);
            openSpawnPanel(player);
            return;
        }

        if (result.selection === 1) {
            system.run(() => openSpawnRadiusForm(player));
            return;
        }

        if (result.selection === 2) {
            system.run(() => openSpawnSafeZonePanel(player));
            return;
        }

        openAdminPanel(player);
    }).catch(() => {});
}

function openSpawnRadiusForm(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const spawn = getAdminSetting("spawn");
    const form = new ModalFormData()
        .title(`${COLOR}eRaio do Spawn`)
        .textField("Raio da safezone:", "100", textFieldOptions(spawn.radius ?? 100));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openSpawnPanel(player);
            return;
        }

        const radius = Math.max(0, Math.floor(getFormNumber(result.formValues?.[0], getNumber(spawn.radius, 100))));
        setAdminSetting("spawn", { radius });
        player.sendMessage(`${COLOR}aRaio do spawn atualizado para ${COLOR}f${radius}${COLOR}a.`);
        openSpawnPanel(player);
    }).catch(() => {});
}

function formatDateTime(timestamp) {
    if (!timestamp) return "Desconhecido";

    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "Desconhecido";

    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const year = date.getFullYear();
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

function openBansPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const bans = getAllBanEntries();
    const form = new ActionFormData()
        .title(panelTitle("BANS", `${COLOR}c`))
        .body(panelBody("Gerenciamento de bans:", [
            `${COLOR}7Total: ${COLOR}f${bans.length}`,
        ]))
        .button(buttonText(`${COLOR}c`, "Banir por Nome", "Ban offline ou nick exato"))
        .button(buttonText(`${COLOR}e`, "Banir Online", "Escolher jogador online"))
        .button(buttonText(`${COLOR}b`, "Lista de Bans", "Ver e desbanir"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) system.run(() => openBanByNameForm(player));
        if (result.selection === 1) system.run(() => openBanOnlineList(player));
        if (result.selection === 2) system.run(() => openBanList(player));
        if (result.selection === 3) openAdminPanel(player);
    }).catch(() => {});
}

function openBanByNameForm(admin) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const form = new ModalFormData()
        .title(panelTitle("BANIR POR NOME", `${COLOR}c`))
        .textField("Nome do jogador", "Steve")
        .textField("Motivo", DEFAULT_BAN_REASON, textFieldOptions(DEFAULT_BAN_REASON));

    showForm(form, admin).then((result) => {
        if (result.canceled) {
            system.run(() => openBansPanel(admin));
            return;
        }

        const playerName = String(result.formValues?.[0] ?? "").trim();
        const reason = cleanReason(result.formValues?.[1]);

        if (!playerName) {
            admin.sendMessage(`${COLOR}cDigite um nome valido.`);
            system.run(() => openBanByNameForm(admin));
            return;
        }

        const onlineTarget = findOnlinePlayer(playerName);
        if (onlineTarget) {
            setPlayerBan({ playerName: onlineTarget.name, playerId: onlineTarget.id }, { reason, bannedBy: admin.name, createdAt: Date.now() });
            sendIfValid(onlineTarget, `${COLOR}cVoce foi banido. Motivo: ${COLOR}f${reason}`);
            runKickCommand(onlineTarget, reason);
        } else {
            setPlayerBan({ playerName }, { playerName, reason, bannedBy: admin.name, createdAt: Date.now() });
        }

        admin.sendMessage(`${COLOR}a${playerName} foi banido. Motivo: ${COLOR}f${reason}`);
        system.run(() => openBansPanel(admin));
    }).catch(() => {});
}

function openBanOnlineList(admin) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const players = getOnlinePlayers().filter((target) => target.id !== admin.id);
    const form = new ActionFormData()
        .title(panelTitle("BANIR ONLINE", `${COLOR}e`))
        .body(panelBody("Escolha um jogador:", [`${COLOR}7Online: ${COLOR}f${players.length}`]));

    for (const target of players) {
        form.button(buttonText(`${COLOR}c`, target.name, "Banir jogador"));
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Bans"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        if (result.selection === players.length) {
            system.run(() => openBansPanel(admin));
            return;
        }
        const target = players[result.selection];
        if (target) system.run(() => openBanOnlinePlayerForm(admin, target.name));
    }).catch(() => {});
}

function openBanList(admin) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const bans = getAllBanEntries();
    const form = new ActionFormData()
        .title(panelTitle("LISTA DE BANS", `${COLOR}c`))
        .body(panelBody("Jogadores banidos:", [`${COLOR}7Total: ${COLOR}f${bans.length}`]));

    for (const ban of bans) {
        form.button(buttonText(`${COLOR}c`, ban.playerName || "Desconhecido", ban.reason || DEFAULT_BAN_REASON));
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Bans"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        if (result.selection === bans.length) {
            system.run(() => openBansPanel(admin));
            return;
        }
        const ban = bans[result.selection];
        if (ban) system.run(() => openBanDetails(admin, ban));
    }).catch(() => {});
}

function openBanDetails(admin, ban) {
    const form = new ActionFormData()
        .title(panelTitle(`BAN: ${ban.playerName || "?"}`, `${COLOR}c`))
        .body(panelBody("Detalhes do ban:", [
            `${COLOR}7Jogador: ${COLOR}f${ban.playerName || "Desconhecido"}`,
            `${COLOR}7ID: ${COLOR}f${ban.playerId || "Sem id"}`,
            `${COLOR}7Motivo: ${COLOR}f${ban.reason || DEFAULT_BAN_REASON}`,
            `${COLOR}7Staff: ${COLOR}f${ban.bannedBy || "Desconhecido"}`,
            `${COLOR}7Data: ${COLOR}f${formatDateTime(ban.createdAt)}`,
        ]))
        .button(buttonText(`${COLOR}a`, "Desbanir", "Remover ban"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Lista de bans"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        if (result.selection === 0) {
            clearPlayerBan({ playerName: ban.playerName, playerId: ban.playerId });
            admin.sendMessage(`${COLOR}aBan removido.`);
            system.run(() => openBanList(admin));
            return;
        }
        system.run(() => openBanList(admin));
    }).catch(() => {});
}

function openClearLagPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const clearLag = getAdminSetting("clearlag");
    const form = new ActionFormData()
        .title(panelTitle("CLEAR LAG", `${COLOR}b`))
        .body(panelBody("Configuracao de limpeza:", [
            `${COLOR}7Intervalo: ${COLOR}f${getNumber(clearLag.intervalSeconds, 180)}s`,
            `${COLOR}7Limpar itens: ${clearLag.removeItems !== false ? `${COLOR}aSim` : `${COLOR}cNao`}`,
            `${COLOR}7Limpar mobs: ${clearLag.removeMobs !== false ? `${COLOR}aSim` : `${COLOR}cNao`}`,
            `${COLOR}7Limpar XP: ${clearLag.removeXpOrbs !== false ? `${COLOR}aSim` : `${COLOR}cNao`}`,
        ]))
        .button(buttonText(`${COLOR}a`, "Limpar Agora", "Executar varredura manual"))
        .button(buttonText(`${COLOR}e`, "Configurar", "Tempo e alvos"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            runClearLag();
            player.sendMessage(`${COLOR}aLimpeza manual executada.`);
            openClearLagPanel(player);
            return;
        }

        if (result.selection === 1) system.run(() => openClearLagSettingsForm(player));
        if (result.selection === 2) openAdminPanel(player);
    }).catch(() => {});
}

function openClearLagSettingsForm(player) {
    const clearLag = getAdminSetting("clearlag");
    const form = new ModalFormData()
        .title(panelTitle("EDITAR CLEAR LAG", `${COLOR}b`))
        .textField("Intervalo (segundos)", "180", textFieldOptions(getNumber(clearLag.intervalSeconds, 180)))
        .toggle("Remover Itens", toggleOptions(clearLag.removeItems !== false))
        .toggle("Remover Monstros", toggleOptions(clearLag.removeMobs !== false))
        .toggle("Remover XP Orbs", toggleOptions(clearLag.removeXpOrbs !== false))
        .toggle("Anunciar no chat", toggleOptions(clearLag.announceStart !== false));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openClearLagPanel(player);
            return;
        }

        const intervalSeconds = Math.max(10, Math.floor(getFormNumber(result.formValues?.[0], 180)));
        setAdminSetting("clearlag", {
            intervalSeconds,
            removeItems: result.formValues?.[1] !== false,
            removeMobs: result.formValues?.[2] !== false,
            removeXpOrbs: result.formValues?.[3] !== false,
            announceStart: result.formValues?.[4] !== false,
        });

        player.sendMessage(`${COLOR}aConfiguracoes de ClearLag atualizadas.`);
        openClearLagPanel(player);
    }).catch(() => {});
}

function openRanksPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const players = getOnlinePlayers();
    const form = new ActionFormData()
        .title(panelTitle("RANKS", `${COLOR}d`))
        .body(panelBody("Escolha um jogador online:", [
            `${COLOR}7Sistema: ${isModuleEnabled("ranks") ? `${COLOR}aLigado` : `${COLOR}cDesligado`}`,
            `${COLOR}7Online: ${COLOR}f${players.length}`,
        ]));

    form.button(buttonText(`${COLOR}a`, "Criar Rank", "Adicionar rank personalizado"));
    form.button(buttonText(`${COLOR}6`, "Gerenciar Top", "Definir Top 1, 2 e 3"));
    form.button(buttonText(`${COLOR}c`, "Excluir Rank", "Remover rank personalizado"));

    for (const target of players) {
        const rank = getPlayerRank(target);
        const mode = getManualRankId(target) ? "Manual" : "Auto";
        form.button(buttonText(rank.color, target.name, `${rank.label} - ${mode}`));
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Admin panel"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            system.run(() => openCreateRankForm(player));
            return;
        }

        if (result.selection === 1) {
            system.run(() => openTopManagerPanel(player));
            return;
        }

        if (result.selection === 2) {
            system.run(() => openDeleteRankPanel(player));
            return;
        }

        const playerIndex = result.selection - 3;

        if (playerIndex === players.length) {
            openAdminPanel(player);
            return;
        }

        const target = players[playerIndex];
        if (!target) return;

        system.run(() => openPlayerRankPanel(player, target.name));
    }).catch(() => {});
}

function openDeleteRankPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    // Carregar todos os ranks e filtrar apenas os customizados
    const allRanks = getAllRanks();
    // Ranks padrão não podem ser excluídos; customRanks são os que foram criados via createCustomRank
    // Identificamos custom ranks como aqueles sem a propriedade 'default' ou com createdBy definido
    const customRanks = allRanks.filter((rank) => rank.createdBy !== undefined || rank.custom === true);

    const form = new ActionFormData()
        .title(panelTitle("EXCLUIR RANK", `${COLOR}c`))
        .body(panelBody("Selecione o rank para excluir:", [
            `${COLOR}7Apenas ranks personalizados podem ser excluídos.`,
            `${COLOR}7Total: ${COLOR}f${customRanks.length}`,
        ]));

    if (customRanks.length === 0) {
        form.button(buttonText(`${COLOR}8`, "Nenhum rank personalizado", "Crie um rank primeiro"));
    } else {
        for (const rank of customRanks) {
            form.button(buttonText(rank.color, formatRankBadge(rank), `ID: ${rank.id}`));
        }
    }

    form.button(buttonText(`${COLOR}7`, "Voltar", "Menu de Ranks"));

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const backIndex = customRanks.length === 0 ? 1 : customRanks.length;
        if (result.selection === backIndex || (customRanks.length === 0 && result.selection === 0)) {
            system.run(() => openRanksPanel(player));
            return;
        }

        const rank = customRanks[result.selection];
        if (!rank) {
            system.run(() => openRanksPanel(player));
            return;
        }

        const deleted = deleteCustomRank(rank.id);
        if (deleted.success) {
            player.sendMessage(`${COLOR}aRank ${formatRankBadge(rank)}${COLOR}a excluído com sucesso.`);
            for (const target of getOnlinePlayers()) {
                refreshPlayerDisplay(target);
            }
        } else {
            player.sendMessage(`${COLOR}c${deleted.message}`);
        }
        system.run(() => openRanksPanel(player));
    }).catch(() => {});
}

function openCreateRankForm(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const form = new ModalFormData()
        .title(panelTitle("CRIAR RANK", `${COLOR}a`))
        .textField("Nome do rank", "TRIAL")
        .textField("Cor/Formatação (Ex: §l§3 ou &l&3)", "§l§7", textFieldOptions("§l§7"))
        .textField("Prioridade 0-99", "30", textFieldOptions("30"))
        .textField("Aliases/tags separados por virgula", "trial,rank_trial", textFieldOptions(""))
        .toggle("Rank de staff", toggleOptions(false));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openRanksPanel(player);
            return;
        }

        const label = String(result.formValues?.[0] ?? "");
        const colorInput = String(result.formValues?.[1] ?? "§7").trim();
        const color = colorInput.replace(/&/g, "§");
        const priorityText = String(result.formValues?.[2] ?? "").trim();
        const priority = priorityText ? Number(priorityText) : 30;
        const aliases = String(result.formValues?.[3] ?? "")
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
        const staff = result.formValues?.[4] === true;
        const created = createCustomRank({ label, color, priority, aliases, staff }, player.name);

        if (!created.success) {
            player.sendMessage(`${COLOR}c${created.message}`);
            system.run(() => openCreateRankForm(player));
            return;
        }

        player.sendMessage(`${COLOR}aRank criado: ${formatRankBadge(created.rank)}${COLOR}a.`);
        for (const target of getOnlinePlayers()) {
            refreshPlayerDisplay(target);
        }
        openRanksPanel(player);
    }).catch(() => {});
}

function openPlayerRankPanel(admin, targetName) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const target = findOnlinePlayer(targetName);
    if (!target) {
        admin.sendMessage(`${COLOR}cJogador saiu do servidor.`);
        system.run(() => openRanksPanel(admin));
        return;
    }

    const currentRank = getPlayerRank(target);
    const manualRankId = getManualRankId(target);
    const ranks = getAllRanks();
    const form = new ActionFormData()
        .title(panelTitle(`RANK: ${target.name}`, currentRank.color))
        .body(panelBody("Cargo atual:", [
            `${COLOR}7Jogador: ${COLOR}f${target.name}`,
            `${COLOR}7Rank: ${formatRankTag(target) || `${currentRank.color}${currentRank.label}`}`,
            `${COLOR}7Modo: ${manualRankId ? `${COLOR}eManual` : `${COLOR}aAuto por tag`}`,
            "",
            `${COLOR}7Escolha o cargo novo:`,
        ]))
        .button(buttonText(`${COLOR}7`, "Auto por tags", "Limpar rank manual"));

    for (const rank of ranks) {
        const selected = currentRank.id === rank.id ? "Atual" : "Setar";
        form.button(buttonText(rank.color, formatRankBadge(rank), selected));
    }

    form.button(buttonText(`${COLOR}c`, "Voltar", "Lista de players"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;

        const currentTarget = findOnlinePlayer(target.name);
        if (!currentTarget) {
            admin.sendMessage(`${COLOR}cJogador saiu do servidor.`);
            system.run(() => openRanksPanel(admin));
            return;
        }

        if (result.selection === 0) {
            clearPlayerRank(currentTarget);
            refreshPlayerDisplay(currentTarget);
            admin.sendMessage(`${COLOR}aRank manual limpo de ${COLOR}f${currentTarget.name}${COLOR}a.`);
            system.run(() => openPlayerRankPanel(admin, currentTarget.name));
            return;
        }

        if (result.selection === ranks.length + 1) {
            system.run(() => openRanksPanel(admin));
            return;
        }

        const rank = ranks[result.selection - 1];
        if (!rank) return;

        const appliedRank = setPlayerRank(currentTarget, rank.id, admin.name);
        refreshPlayerDisplay(currentTarget);
        admin.sendMessage(`${COLOR}aRank de ${COLOR}f${currentTarget.name} ${COLOR}aatualizado para ${appliedRank.color}${appliedRank.label}${COLOR}a.`);
        sendIfValid(currentTarget, `${COLOR}aSeu rank agora e ${appliedRank.color}${appliedRank.label}${COLOR}a.`);
        system.run(() => openPlayerRankPanel(admin, currentTarget.name));
    }).catch(() => {});
}

function openMobStackerPanel(player) {
    if (!isAdmin(player)) {
        deny(player);
        return;
    }

    const mobStacker = getAdminSetting("mobstacker");
    const form = new ModalFormData()
        .title(panelTitle("MOB STACKER", `${COLOR}a`))
        .toggle("Ativar Mob Stacker", toggleOptions(isModuleEnabled("mobstacker")))
        .textField("Raio de busca", "8", textFieldOptions(getNumber(mobStacker.radius, 8)))
        .textField("Limite de stack", "64", textFieldOptions(getNumber(mobStacker.maxStack, 64)))
        .toggle("Mostrar nome do mob", toggleOptions(mobStacker.showName !== false));

    showForm(form, player).then((result) => {
        if (result.canceled) {
            openSettingsPanel(player);
            return;
        }

        setModuleEnabled("mobstacker", result.formValues?.[0] !== false);
        setAdminSetting("mobstacker", {
            radius: Math.max(1, Math.floor(getFormNumber(result.formValues?.[1], 8))),
            maxStack: Math.max(1, Math.floor(getFormNumber(result.formValues?.[2], 64))),
            showName: result.formValues?.[3] !== false,
        });

        player.sendMessage(`${COLOR}aMobStacker atualizado.`);
        openSettingsPanel(player);
    }).catch(() => {});
}

function registerAdminCommand(registry, name) {
    try {
        registry.registerCommand(
            { name, description: "Abrir admin panel", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
            (origin) => {
                const player = getCommandPlayer(origin);
                if (!player || !isAdmin(player)) return { status: CustomCommandStatus.Failure, message: "Sem permissao." };
                openAdminPanel(player);
                return { status: CustomCommandStatus.Success };
            }
        );
    } catch {}
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    // Registra os comandos de admin na CommandBridge para o prefixo '!'
    for (const name of ["adminpanel", "admin", "adm"]) {
        CommandBridge.register(name, (player, args) => {
            if (!isAdmin(player)) {
                player.sendMessage("§cSem permissao.");
                return;
            }
            // Chamada direta, o bridge.js já fornece o delay necessário
            openAdminPanel(player);
        });
    }
    if (!customCommandRegistry) return;
    for (const name of ["labsdev:adminpanel", "labsdev:admin", "labsdev:adm"]) {
        registerAdminCommand(customCommandRegistry, name);
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    
    // Atualiza o display do jogador em cada spawn para garantir persistência visual da TAG
    system.run(() => {
        const teamSystem = getTeamSystem();
        if (teamSystem) {
            teamSystem.updatePlayerDisplay(player);
        }
        
        if (initialSpawn) {
            system.runTimeout(() => {
                enforcePlayerBan(player);
                if (isPlayerMuted(player)) {
                    player.sendMessage("§c[AVISO] Você está mutado pela staff e não pode enviar mensagens no chat.");
                }
            }, 5);
        }
    });
});

// Re-exportar funções necessárias para outros módulos

function openTopManagerPanel(admin) {
    if (!isAdmin(admin)) {
        deny(admin);
        return;
    }

    const topState = TopPlayers.state;
    const form = new ActionFormData()
        .title(panelTitle("GERENCIAR TOP", `${COLOR}6`))
        .body(panelBody("Defina os jogadores para cada posição:", [
            `${COLOR}6Top 1: ${COLOR}f${topState["top:1"]?.holder ?? "Ninguém"}`,
            `${COLOR}7Top 2: ${COLOR}f${topState["top:2"]?.holder ?? "Ninguém"}`,
            `${COLOR}cTop 3: ${COLOR}f${topState["top:3"]?.holder ?? "Ninguém"}`,
        ]))
        .button(buttonText(`${COLOR}6`, "Top 1", "Alterar primeiro lugar"))
        .button(buttonText(`${COLOR}7`, "Top 2", "Alterar segundo lugar"))
        .button(buttonText(`${COLOR}c`, "Top 3", "Alterar terceiro lugar"))
        .button(buttonText(`${COLOR}e`, "Cores", "Mudar cores das tags"))
        .button(buttonText(`${COLOR}7`, "Voltar", "Menu de Ranks"));

    showForm(form, admin).then((result) => {
        if (result.canceled) return;
        
        if (result.selection === 4) {
            openRanksPanel(admin);
            return;
        }

        if (result.selection === 3) {
            system.run(() => openTopColorsPanel(admin));
            return;
        }

        const position = result.selection + 1;
        system.run(() => openSetTopPlayerForm(admin, position));
    }).catch(() => {});
}

function openTopColorsPanel(admin) {
    const topState = TopPlayers.state;
    
    const form = new ModalFormData()
        .title(panelTitle("CUSTOMIZAR TAGS", `${COLOR}e`))
        .textField("Tag Top 1 (Ex: §l§6TOP 1 ou &l&bREI)", "TOP 1", textFieldOptions(topState["top:1"]?.color ?? "§6TOP 1"))
        .textField("Tag Top 2 (Ex: §l§7TOP 2)", "TOP 2", textFieldOptions(topState["top:2"]?.color ?? "§7TOP 2"))
        .textField("Tag Top 3 (Ex: §l§cTOP 3)", "TOP 3", textFieldOptions(topState["top:3"]?.color ?? "§cTOP 3"));

    showForm(form, admin).then((result) => {
        if (result.canceled) {
            openTopManagerPanel(admin);
            return;
        }

        topState["top:1"].color = String(result.formValues[0] ?? "§6TOP 1").replace(/&/g, "§");
        topState["top:2"].color = String(result.formValues[1] ?? "§7TOP 2").replace(/&/g, "§");
        topState["top:3"].color = String(result.formValues[2] ?? "§cTOP 3").replace(/&/g, "§");

        TopPlayers.saveState();
        TopPlayers.refreshAllDisplays();
        admin.sendMessage(`${COLOR}aTags do Top atualizadas com sucesso!`);
        openTopManagerPanel(admin);
    }).catch(() => {});
}

function openSetTopPlayerForm(admin, position) {
    const players = getOnlinePlayers();
    const playerNames = players.map(p => p.name);
    
    const form = new ModalFormData()
        .title(panelTitle(`DEFINIR TOP ${position}`, `${COLOR}6`))
        .dropdown("Selecione o jogador", ["Limpar Posição", ...playerNames], dropdownOptions(0))
        .toggle("Confirmar alteração", toggleOptions(true));

    showForm(form, admin).then((result) => {
        if (result.canceled) {
            openTopManagerPanel(admin);
            return;
        }

        const selection = result.formValues?.[0];
        const confirmed = result.formValues?.[1];

        if (!confirmed) {
            openTopManagerPanel(admin);
            return;
        }

        const tag = `top:${position}`;
        const currentColor = TopPlayers.state[tag]?.color ?? (position === 1 ? "§6TOP 1" : position === 2 ? "§7TOP 2" : "§cTOP 3");
        
        if (selection === 0) {
            // Limpar
            TopPlayers.state[tag] = { holder: null, previous: null, lastKill: 0, color: currentColor };
            admin.sendMessage(`${COLOR}aPosição ${COLOR}6Top ${position} ${COLOR}alimpada.`);
        } else {
            // Setar
            const targetName = playerNames[selection - 1];
            TopPlayers.state[tag] = { holder: targetName, previous: TopPlayers.state[tag].holder, lastKill: Date.now(), color: currentColor };
            admin.sendMessage(`${COLOR}aJogador ${COLOR}f${targetName} ${COLOR}adefinido como ${COLOR}6Top ${position}${COLOR}a.`);
        }

        TopPlayers.saveState();
        TopPlayers.syncTags();
        openTopManagerPanel(admin);
    }).catch(() => {});
}

// ── Sistema de Mute ────────────────────────────────────────────────────────
export function getMutedPlayers() {
    try {
        const raw = world.getDynamicProperty(MUTE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function saveMutedPlayers(muted) {
    world.setDynamicProperty(MUTE_KEY, JSON.stringify(muted));
}

export function isPlayerMuted(player) {
    const muted = getMutedPlayers();
    return !!(muted[player.id] || muted[player.name.toLowerCase()]);
}

export function setPlayerMute(target, reason = "Bullying/Flood", staff = "Admin") {
    const muted = getMutedPlayers();
    const id = typeof target === "string" ? target.toLowerCase() : target.id;
    const name = typeof target === "string" ? target : target.name;
    
    muted[id] = {
        name: name,
        reason: reason,
        staff: staff,
        date: Date.now()
    };
    saveMutedPlayers(muted);
}

export function removePlayerMute(target) {
    const muted = getMutedPlayers();
    const id = typeof target === "string" ? target.toLowerCase() : target.id;
    
    delete muted[id];
    // Tenta remover pelo nome também caso tenha sido mutado por nome
    if (typeof target !== "string") {
        delete muted[target.name.toLowerCase()];
    }
    
    saveMutedPlayers(muted);
}

function openMutePlayerForm(admin, target) {
    const muted = isPlayerMuted(target);
    
    if (muted) {
        const confirmForm = new MessageFormData()
            .title(panelTitle("DESMUTAR JOGADOR", `${COLOR}a`))
            .body(`O jogador ${COLOR}f${target.name} ${COLOR}7está mutado.\nDeseja remover o mute?`)
            .button1("§aSim, Desmutar")
            .button2("§cCancelar");
            
        showForm(confirmForm, admin).then((result) => {
            if (result.selection === 0) {
                removePlayerMute(target);
                admin.sendMessage(`${COLOR}aJogador ${COLOR}f${target.name} ${COLOR}adesmutado.`);
            }
            system.run(() => openPlayerDetailsPanel(admin, target.name));
        });
    } else {
        const form = new ModalFormData()
            .title(panelTitle("MUTAR JOGADOR", `${COLOR}c`))
            .textField("Motivo do Mute", "Ex: Bullying, Flood, Toxicidade", { defaultValue: "Bullying/Flood" })
            .toggle("Confirmar Mute", { defaultValue: true });
            
        showForm(form, admin).then((result) => {
            if (result.canceled || !result.formValues[1]) {
                system.run(() => openPlayerDetailsPanel(admin, target.name));
                return;
            }
            
            const reason = String(result.formValues[0] || "Bullying/Flood");
            setPlayerMute(target, reason, admin.name);
            admin.sendMessage(`${COLOR}aJogador ${COLOR}f${target.name} ${COLOR}amutado por: ${COLOR}7${reason}`);
            target.sendMessage(`${COLOR}cVocê foi mutado pela staff.\nMotivo: ${COLOR}7${reason}`);
            system.run(() => openPlayerDetailsPanel(admin, target.name));
        });
    }
}
