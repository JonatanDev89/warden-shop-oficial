import { world, system } from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { getTeamSystem } from "./teamManager.js";
import { SlashCommandManager } from "./command.js";
import { isModuleEnabled } from "../core/moduleState.js";
import { isPlayerMuted } from "../core/adminpanel.js";
import { formatRankTag } from "../core/ranks.js";
import { getCommandSourceEntity, getOnlinePlayers } from "../core/scriptCompat.js";
import { tryUseTeleportCooldown } from "../core/teleportCooldown.js";

const convites = new Map();

const TEMPO_CONVITE = 30 * 1000;
const INVITES_PROPERTY_KEY = "clan:invites";
const LEGACY_INVITES_PROPERTY_KEY = "team:invites";

const CLAN_ICONS = {
    create: "textures/icons/clan_create",
    join: "textures/icons/clan_join",
    members: "textures/icons/clan_members",
    invite: "textures/icons/clan_invite",
    settings: "textures/icons/clan_settings",
    manage: "textures/icons/clan_manage",
    logs: "textures/icons/clan_logs",
    base: "textures/icons/clan_base",
    home: "textures/icons/clan_home",
    leave: "textures/icons/clan_leave",
    refresh: "textures/icons/clan_refresh",
    kick: "textures/icons/clan_kick",
    rank: "textures/icons/clan_rank",
    transfer: "textures/icons/clan_transfer",
    delete: "textures/icons/clan_delete",
    accept: "textures/icons/clan_accept",
    decline: "textures/icons/clan_decline",
    fix: "textures/icons/clan_fix",
    back: "textures/icons/clan_back",
};

const CLAN_COLOR_PALETTE = [
    { name: "Branco", code: "§f" },
    { name: "Cinza", code: "§7" },
    { name: "Cinza escuro", code: "§8" },
    { name: "Dourado", code: "§6" },
    { name: "Amarelo", code: "§e" },
    { name: "Verde", code: "§a" },
    { name: "Verde escuro", code: "§2" },
    { name: "Azul claro", code: "§b" },
    { name: "Azul", code: "§9" },
    { name: "Aqua escuro", code: "§3" },
    { name: "Roxo", code: "§5" },
    { name: "Rosa", code: "§d" },
    { name: "Vermelho", code: "§c" },
    { name: "Vermelho escuro", code: "§4" },
];

function clanTitle(title, color = "§6") {
    return `§8[ ${color}§l${title}§r§8 ]`;
}

function clanButton(color, title, description) {
    return `${color}§l${title}\n§7${description}`;
}

function clanPanelBody(lines = []) {
    return [
        "§8+----------------------------+",
        "§8| §3§lLABS CLAN §r§8                  |",
        "§8+----------------------------+",
        "",
        ...lines,
    ].join("\n");
}

async function showForm(form, player, timeoutTicks = 100) {
    const startTick = system.currentTick;
    
    while ((system.currentTick - startTick) < timeoutTicks) {
        const isValid = player && (typeof player.isValid === "function" ? player.isValid() : player.isValid !== false);
        if (!isValid) break;

        try {
            const response = await form.show(player);
            if (!response.canceled || response.cancelationReason !== "UserBusy") {
                return response;
            }
        } catch (e) {}
        
        await new Promise(resolve => system.run(resolve));
    }
    
    return { canceled: true, cancelationReason: "UserBusy" };
}

function getCommandPlayer(origin) {
    return getCommandSourceEntity(origin);
}

function getColorCode(index, fallback = "§f") {
    return CLAN_COLOR_PALETTE[Number(index)]?.code ?? fallback;
}

function getColorIndex(code, fallbackIndex = 0) {
    const normalized = String(code ?? "").trim().toLowerCase();
    const index = CLAN_COLOR_PALETTE.findIndex((entry) => entry.code === normalized);
    return index >= 0 ? index : fallbackIndex;
}

function getColorName(code) {
    const normalized = String(code ?? "").trim().toLowerCase();
    return CLAN_COLOR_PALETTE.find((entry) => entry.code === normalized)?.name ?? "Padrao";
}

function getPlatformTag(_player) {
    // Tags de plataforma removidas a pedido do usuário
    return "";
}

function getTeamColors(team) {
    return {
        name: team?.colors?.name ?? "§f",
        tag: team?.colors?.tag ?? team?.colors?.tagColor ?? "§7",
    };
}

function getClanTagText(team) {
    return String(team?.tag ?? team?.name ?? "")
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase();
}

function formatClanName(team) {
    if (!team) return "";

    const colors = getTeamColors(team);
    const name = team.name ?? "CLAN";
    
    // Se o nome já contém códigos de cor próprios, usamos ele puro
    const hasInternalColors = name.includes("§") || name.includes("&");
    const displayName = hasInternalColors ? name.replace(/&/g, "§") : `${colors.name}${name}`;
    
    return `${displayName}§r`;
}

function formatClanTag(team) {
    if (!team) return "";

    const colors = getTeamColors(team);
    const tag = team.tag ?? "CLAN";
    
    // Se a tag já contém códigos de cor próprios (cor por letra), usamos ela pura
    const hasInternalColors = tag.includes("§") || tag.includes("&");
    const displayTag = hasInternalColors ? tag.replace(/&/g, "§") : `${colors.tag}${tag.toUpperCase()}`;
    
    return `§r§8[${displayTag}§r§8]§r`;
}

function colorPaletteLabels() {
    return CLAN_COLOR_PALETTE.map((entry) => `${entry.code}${entry.name}`);
}

world.afterEvents.worldLoad.subscribe(() => {});

system.beforeEvents.startup.subscribe(() => {
    CommandBridge.register("clan", (player, args) => {
        if (!isModuleEnabled("clan")) {
            player.sendMessage("§cSistema de clan desativado.");
            return;
        }
        abrirMenuClan(player);
    });
});

world.afterEvents.worldLoad.subscribe(() => {
    if (!isModuleEnabled("clan")) return;
    system.run(() => {
        getTeamSystem()?.runConsistencyCheck?.();
        loadInvites();
        cleanupInvites();
    });
});

world.beforeEvents.chatSend.subscribe((data) => {
    const player = data.sender;
    
    if (isPlayerMuted(player)) {
        data.cancel = true;
        player.sendMessage("§cVocê está mutado e não pode enviar mensagens no chat.");
        return;
    }

    if (!isModuleEnabled("clan")) return;
    const message = String(data.message ?? "");
    const teamSystem = getTeamSystem();
    const team = teamSystem?.getPlayerTeam(player);

    if (message.startsWith("!c ") || message.startsWith("/c ")) {
        data.cancel = true;

        system.run(() => {
            if (!team) {
                player.sendMessage("§cVocê não está em um clan");
                return;
            }

            const role = getRoleLabel(team, player.id);
            const clanMessage = message.slice(3).trim();

            if (!clanMessage) {
                player.sendMessage("§cUse: !c <mensagem> §7ou §c/c <mensagem>");
                return;
            }

            const rankTag = formatRankTag(player, { includeDefault: true });
            const platformTag = getPlatformTag(player);
            const prefix = [
                rankTag,
                team ? formatClanTag(team) : "",
                platformTag,
                // role removido a pedido do usuário para não mostrar [L], [S], [M]
            ].filter((part) => part.length > 0).join(" ");
            const fullMsg = `§5[ClanChat] ${prefix ? `${prefix} ` : ""}§f${player.name}§7: §d${clanMessage}`;

            for (const target of world.getPlayers()) {
                if (teamSystem?.isTeam(player, target)) {
                    target.sendMessage(fullMsg);
                }
            }
        });

        return;
    }

    // Só cancela e formata se NÃO for um comando de outro sistema (não começa com !)
    if (!message.startsWith("!") && !message.startsWith("/")) {
        data.cancel = true;

        system.run(() => {
            const rankTag = formatRankTag(player, { includeDefault: true });
            const prefix = [
                rankTag,
                team ? formatClanTag(team) : "",
                getPlatformTag(player),
                // getRoleLabel removido a pedido do usuário para não mostrar [L], [S], [M]
            ].filter((part) => part.length > 0).join(" ");

            const finalMsg = `${prefix ? `${prefix} ` : ""}§f${player.name} §7: ${message}`;
            for (const target of world.getAllPlayers()) {
                target.sendMessage(finalMsg);
            }
        });
    }
});

world.beforeEvents.playerLeave.subscribe((data) => {
    if (!isModuleEnabled("clan")) return;
    const teamSystem = getTeamSystem();
    teamSystem?.onLeavePlayer?.(data.player);
});

world.afterEvents.playerSpawn.subscribe((data) => {
    if (!isModuleEnabled("clan")) return;
    if (!data.initialSpawn) return;
    encontrarPlayer(data.player.name);
});

const teamActions = [
    "create",
    "accept",
    "kick",
    "invite",
    "leave",
    "transfer",
    "subleader",
    "delete",
    "config",
    "colors",
    "logs",
    "home",
    "setbase",
    "fix",
    "clear",
];

const clanActions = ["base", ...teamActions];

SlashCommandManager.create("labsdev:clan")
    .description("Sistema principal do clan")
    .enum("labsdev:clan_action", clanActions, false)
    .onExecute((sender, action) => {
        if (!isModuleEnabled("clan")) {
            getCommandPlayer(sender)?.sendMessage?.("Sistema de clan desativado.");
            return;
        }

        const player = getCommandPlayer(sender);

        if (!player) {
            return;
        }

        if (!action) {
            abrirMenuClan(player);
            return;
        }

        const { teamSystem } = getClanContext(player);
        if (!teamSystem) {
            player.sendMessage("§cSistema não iniciado");
            return;
        }

        switch (action) {
            case "base":
                abrirBaseClan(player);
                return;

            case "create":
                if (canCreateClan(player, teamSystem)) {
                    criarClanForm(player);
                }
                return;

            case "accept":
                abrirListaConvites(player);
                return;

            case "kick":
                if (!canManageMembers(player, teamSystem)) {
                    player.sendMessage("§cVocê não tem permissão para expulsar");
                    return;
                }

                kickPlayerForm(player);
                return;

            case "invite":
                if (!canInvite(player, teamSystem)) {
                    player.sendMessage("§cVocê não tem permissão para convidar");
                    return;
                }

                invitePlayersForm(player);
                return;

            case "leave":
                player.sendMessage(teamSystem.leaveTeam(player).msg);
                return;

            case "transfer":
                if (!isLeader(player, teamSystem)) {
                    player.sendMessage("§cSó o líder pode transferir a liderança");
                    return;
                }

                transferLeadershipForm(player);
                return;

            case "subleader":
                if (!isLeader(player, teamSystem)) {
                    player.sendMessage("§cSó o líder pode gerenciar sublíderes");
                    return;
                }

                gerenciarSubLiderMenu(player);
                return;

            case "delete":
                if (!isLeader(player, teamSystem)) {
                    player.sendMessage("§cSó o líder pode deletar o clan");
                    return;
                }

                confirmarDeleteClan(player);
                return;

            case "config":
                abrirConfigClanMenu(player);
                return;

            case "colors":
                abrirCoresClanForm(player);
                return;

            case "logs":
                abrirLogsClan(player);
                return;

            case "home":
                teleportarParaHomeClan(player);
                return;

            case "setbase":
                definirHomeClan(player);
                return;

            case "fix":
                rodarAntiBug(player);
                return;

            case "clear":
                if (!player.hasTag("admin")) {
                    player.sendMessage("§cSem permissão");
                    return;
                }

                teamSystem.clearAll();
                convites.clear();
                saveInvites();
                player.sendMessage("§aTodos os clans e convites foram limpos");
                return;

            default:
                player.sendMessage("§cAção inválida");
        }
    });

export function abrirMenuClan(player) {
    const { team, isLeader: playerIsLeader, isSubLeader: playerIsSubLeader } = getClanContext(player);

    if (!team) {
        abrirMenuSemClan(player);
        return;
    }

    if (playerIsLeader) {
        abrirMenuLider(player, team);
        return;
    }

    if (playerIsSubLeader) {
        abrirMenuSubLider(player, team);
        return;
    }

    abrirMenuMembro(player, team);
}

function abrirMenuSemClan(player) {
    const invites = getValidInvites(player);

    const form = new ActionFormData()
        .title(clanTitle("CLAN", "§6"))
        .body(clanPanelBody([
            "§8Status",
            "§7Clan: §cNenhum",
            `§7Criacao: ${player.hasTag("lider") ? "§aLiberada" : "§cRequer tag lider"}`,
            `§7Convites: §f${invites.length}`,
            "",
            "§8Comece criando um clan ou aceitando um convite.",
        ]))
        .button(clanButton("§a", "Criar Clan", "Registrar um novo clan"), CLAN_ICONS.create)
        .button(
            invites.length > 0
                ? clanButton("§b", `Entrar em Clan (${invites.length})`, "Aceitar convite pendente")
                : clanButton("§8", "Entrar em Clan", "Sem convites pendentes"),
            CLAN_ICONS.join
        )
        .button(clanButton("§7", "Atualizar", "Recarregar painel"), CLAN_ICONS.refresh);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                if (canCreateClan(player, getClanContext(player).teamSystem)) {
                    criarClanForm(player);
                }
                return;
            case 1:
                if (invites.length === 0) {
                    player.sendMessage("§cVocê não possui convites pendentes");
                    return;
                }

                abrirListaConvites(player);
                return;
            case 2:
                abrirMenuClan(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu sem clan:", error);
    });
}

function abrirMenuLider(player, team) {
    const form = new ActionFormData()
        .title(clanTitle("CLAN - LIDER", "§6"))
        .body(buildClanSummary(team, "§6[L] Lider"))
        .button(clanButton("§b", "Base do Clan", "Resumo e coordenadas"), CLAN_ICONS.base)
        .button(clanButton("§e", "Ver Membros", "Lista de integrantes"), CLAN_ICONS.members)
        .button(clanButton("§a", "Convidar Jogador", "Enviar convite"), CLAN_ICONS.invite)
        .button(clanButton("§3", "Configuracoes", "Base e reparos"), CLAN_ICONS.settings)
        .button(clanButton("§d", "Gestao Avancada", "Cargos, expulsao e lideranca"), CLAN_ICONS.manage)
        .button(clanButton("§5", "Logs", "Historico recente"), CLAN_ICONS.logs)
        .button(
            team.home
                ? clanButton("§2", "Ir para Base", "Teleportar para a base")
                : clanButton("§8", "Base nao definida", "Configure a base primeiro"),
            CLAN_ICONS.home
        )
        .button(clanButton("§c", "Sair do Clan", "Deixar seu clan"), CLAN_ICONS.leave);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                abrirBaseClan(player);
                return;
            case 1:
                abrirListaMembros(player);
                return;
            case 2:
                if (canInvite(player, getClanContext(player).teamSystem)) {
                    invitePlayersForm(player);
                }
                return;
            case 3:
                abrirConfigClanMenu(player);
                return;
            case 4:
                abrirGestaoLiderMenu(player);
                return;
            case 5:
                abrirLogsClan(player);
                return;
            case 6:
                teleportarParaHomeClan(player);
                return;
            case 7:
                player.sendMessage(getClanContext(player).teamSystem.leaveTeam(player).msg);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu do líder:", error);
    });
}

function abrirMenuSubLider(player, team) {
    const form = new ActionFormData()
        .title(clanTitle("CLAN - SUBLIDER", "§5"))
        .body(buildClanSummary(team, "§5[S] Sublider"))
        .button(clanButton("§b", "Base do Clan", "Resumo e coordenadas"), CLAN_ICONS.base)
        .button(clanButton("§e", "Ver Membros", "Lista de integrantes"), CLAN_ICONS.members)
        .button(clanButton("§a", "Convidar Jogador", "Enviar convite"), CLAN_ICONS.invite)
        .button(clanButton("§d", "Gestao", "Expulsar membros comuns"), CLAN_ICONS.manage)
        .button(clanButton("§5", "Logs", "Historico recente"), CLAN_ICONS.logs)
        .button(
            team.home
                ? clanButton("§2", "Ir para Base", "Teleportar para a base")
                : clanButton("§8", "Base nao definida", "Aguarde o lider configurar"),
            CLAN_ICONS.home
        )
        .button(clanButton("§c", "Sair do Clan", "Deixar seu clan"), CLAN_ICONS.leave);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                abrirBaseClan(player);
                return;
            case 1:
                abrirListaMembros(player);
                return;
            case 2:
                if (canInvite(player, getClanContext(player).teamSystem)) {
                    invitePlayersForm(player);
                }
                return;
            case 3:
                abrirGestaoSubLiderMenu(player);
                return;
            case 4:
                abrirLogsClan(player);
                return;
            case 5:
                teleportarParaHomeClan(player);
                return;
            case 6:
                player.sendMessage(getClanContext(player).teamSystem.leaveTeam(player).msg);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu do sublíder:", error);
    });
}

function abrirMenuMembro(player, team) {
    const form = new ActionFormData()
        .title(clanTitle("CLAN - MEMBRO", "§b"))
        .body(buildClanSummary(team, "§b[M] Membro"))
        .button(clanButton("§b", "Base do Clan", "Resumo e coordenadas"), CLAN_ICONS.base)
        .button(clanButton("§e", "Ver Membros", "Lista de integrantes"), CLAN_ICONS.members)
        .button(clanButton("§5", "Logs", "Historico recente"), CLAN_ICONS.logs)
        .button(
            team.home
                ? clanButton("§2", "Ir para Base", "Teleportar para a base")
                : clanButton("§8", "Base nao definida", "Aguarde o lider configurar"),
            CLAN_ICONS.home
        )
        .button(clanButton("§c", "Sair do Clan", "Deixar seu clan"), CLAN_ICONS.leave);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                abrirBaseClan(player);
                return;
            case 1:
                abrirListaMembros(player);
                return;
            case 2:
                abrirLogsClan(player);
                return;
            case 3:
                teleportarParaHomeClan(player);
                return;
            case 4:
                player.sendMessage(getClanContext(player).teamSystem.leaveTeam(player).msg);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu do membro:", error);
    });
}

function abrirGestaoLiderMenu(player) {
    const form = new ActionFormData()
        .title(clanTitle("GESTAO DO CLAN", "§a"))
        .body(clanPanelBody([
            "§8Centro administrativo",
            "§7Gerencie jogadores, cargos e posse do clan.",
            "§8Use as opcoes criticas com cuidado.",
        ]))
        .button(clanButton("§a", "Convidar Jogador", "Enviar convite"), CLAN_ICONS.invite)
        .button(clanButton("§c", "Expulsar Membro", "Remover integrante"), CLAN_ICONS.kick)
        .button(clanButton("§5", "Gerenciar Sublider", "Adicionar ou remover cargo"), CLAN_ICONS.rank)
        .button(clanButton("§d", "Transferir Lideranca", "Passar o clan adiante"), CLAN_ICONS.transfer)
        .button(clanButton("§4", "Deletar Clan", "Acao permanente"), CLAN_ICONS.delete)
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                invitePlayersForm(player);
                return;
            case 1:
                kickPlayerForm(player);
                return;
            case 2:
                gerenciarSubLiderMenu(player);
                return;
            case 3:
                transferLeadershipForm(player);
                return;
            case 4:
                confirmarDeleteClan(player);
                return;
            case 5:
                abrirMenuClan(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu de gestão do líder:", error);
    });
}

function abrirGestaoSubLiderMenu(player) {
    const form = new ActionFormData()
        .title(clanTitle("GESTAO DO SUBLIDER", "§5"))
        .body(clanPanelBody([
            "§8Permissoes de sublider",
            "§7Convide jogadores e remova membros comuns.",
        ]))
        .button(clanButton("§a", "Convidar Jogador", "Enviar convite"), CLAN_ICONS.invite)
        .button(clanButton("§c", "Expulsar Membro", "Remover integrante"), CLAN_ICONS.kick)
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                invitePlayersForm(player);
                return;
            case 1:
                kickPlayerForm(player);
                return;
            case 2:
                abrirMenuClan(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro no menu de gestão do sublíder:", error);
    });
}

function abrirConfigClanMenu(player) {
    const { team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    if (!playerIsLeader) {
        player.sendMessage("§cSó o líder pode abrir a config do clan");
        return;
    }

    const form = new ActionFormData()
        .title(clanTitle("CONFIG DO CLAN", "§3"))
        .body(clanPanelBody([
            "§8Configuracoes",
            `§7Clan: ${formatClanName(team)}`,
            `§7Tag: ${formatClanTag(team)}`,
            `§7Limite de membros: §f${team.settings?.maxMembers ?? 15}`,
            `§7Base definida: ${team.home ? "§aSim" : "§cNao"}`,
            `§7Cor do nome: §f${getColorName(team.colors?.name)}`,
            `§7Cor da tag: §f${getColorName(getTeamColors(team).tag)}`,
            "",
            "§8Ajuste visual, base e reparos do clan.",
        ]))
        .button(clanButton("§2", "Definir Base", "Salvar sua posicao atual"), CLAN_ICONS.base)
        .button(clanButton("§c", "Remover Base", "Apagar base salva"), CLAN_ICONS.delete)
        .button(clanButton("§d", "Cores do Clan", "Nome e tag do chat"), CLAN_ICONS.settings)
        .button(clanButton("§6", "Rodar Anti-Bug", "Reparar dados do clan"), CLAN_ICONS.fix)
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);
    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                definirHomeClan(player);
                return;
            case 1:
                removerHomeClan(player);
                return;
            case 2:
                abrirCoresClanForm(player);
                return;
            case 3:
                rodarAntiBug(player);
                return;
            case 4:
                abrirMenuClan(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir config do clan:", error);
    });
}

function abrirCoresClanForm(player) {
    const { teamSystem, team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode alterar as cores do clan");
        return;
    }

    const form = new ModalFormData()
        .title(clanTitle("CORES DO CLAN", "§d"))
        .textField("Nome do clan (§ e & permitidos)", "Ex: §eL§fa§cb§es", { defaultValue: team.name })
        .textField("Tag do clan (§ e & permitidos, max 7 letras)", "Ex: §eA§fS§cG", { defaultValue: team.tag });

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const newName = String(result.formValues?.[0] ?? "").trim();
        const newTag = String(result.formValues?.[1] ?? "").trim();
        const { teamKey } = getClanContext(player);

        const updateResult = teamSystem.renameTeam(teamKey || team.name, player.id, newName, newTag);

        player.sendMessage(updateResult.msg);
        abrirConfigClanMenu(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao alterar cores do clan:", error);
    });
}

function abrirBaseClan(player) {
    const { team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        abrirMenuSemClan(player);
        return;
    }

    const leaderName = team.members.get(team.leader) ?? "Desconhecido";
    const createdAt = formatDate(team.date);
    const members = Array.from(team.members.entries());
    const logsCount = team.logs?.length ?? 0;

    const membersText = members
        .map(([id, memberName], index) => {
            const roleLabel = getRoleLabel(team, id);
            return `§8${index + 1}. ${roleLabel} §f${memberName}`;
        })
        .join("\n");

    const homeText = team.home
        ? `§a${Math.floor(team.home.x)}, ${Math.floor(team.home.y)}, ${Math.floor(team.home.z)}`
        : "§cNão definida";

    const form = new ActionFormData()
        .title(clanTitle("BASE DO CLAN", "§3"))
        .body(clanPanelBody([
            "§8Informacoes principais",
            `§7Nome: ${formatClanName(team)}`,
            `§7Tag: ${formatClanTag(team)}`,
            `§7Lider: §f${leaderName}`,
            `§7Membros: §f${members.length}/${team.settings?.maxMembers ?? 15}`,
            `§7Sublideres: §f${team.subLeaders?.size ?? 0}`,
            `§7Criado em: §f${createdAt}`,
            `§7Base: ${homeText}`,
            `§7Logs: §f${logsCount}`,
            "",
            "§8Integrantes",
            membersText || "§8Nenhum",
        ]))
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);

    showForm(form, player).then(() => {
        abrirMenuClan(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir base do clan:", error);
    });
}

function abrirListaMembros(player) {
    const { team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    const onlinePlayersIds = new Set(getOnlinePlayers().map(p => p.id));

    const membersText = Array.from(team.members.entries())
        .map(([id, name], index) => {
            const isOnline = onlinePlayersIds.has(id);
            const statusIcon = isOnline ? "§a●" : "§7○";
            return `§8${index + 1}. ${statusIcon} ${getRoleLabel(team, id)} §f${name}`;
        })
        .join("\n");

    const form = new ActionFormData()
        .title(clanTitle("MEMBROS DO CLAN", "§e"))
        .body(clanPanelBody([
            "§8Lista de integrantes",
            `§7Clan: ${formatClanName(team)}`,
            "",
            membersText || "§8Nenhum membro encontrado.",
        ]))
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);

    showForm(form, player).then(() => {
        abrirMenuClan(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir lista de membros:", error);
    });
}

function abrirLogsClan(player) {
    const { team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    const logs = Array.isArray(team.logs) ? team.logs.slice(-15).reverse() : [];
    const body = logs.length > 0
        ? logs.map((log) => `§8- §7${formatDateTime(log.time)} §f${log.text}`).join("\n")
        : "§8Nenhum log ainda.";
    const form = new ActionFormData()
        .title(clanTitle("LOGS DO CLAN", "§d"))
        .body(clanPanelBody([
            "§8Historico recente",
            body,
        ]))
        .button(clanButton("§7", "Voltar", "Painel do clan"), CLAN_ICONS.back);

    showForm(form, player).then(() => {
        abrirMenuClan(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir logs do clan:", error);
    });
}

function abrirListaConvites(player) {
    const invites = getValidInvites(player);

    if (invites.length === 0) {
        player.sendMessage("§cVocê não possui convites válidos");
        return;
    }

    const form = new ActionFormData()
        .title(clanTitle("ENTRAR EM CLAN", "§d"))
        .body(clanPanelBody([
            "§8Convites pendentes",
            `§7Disponiveis: §f${invites.length}`,
            "",
            "§8Selecione um clan para responder.",
        ]));

    for (const invite of invites) {
        form.button(clanButton("§b", invite.team, `Convite de ${invite.senderName}`), CLAN_ICONS.join);
    }

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const invite = invites[result.selection];
        if (!invite) {
            player.sendMessage("§cConvite inválido");
            return;
        }

        abrirMenuConvite(player, invite.team);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir lista de convites:", error);
    });
}

function abrirMenuConvite(player, teamName = null) {
    const invites = getValidInvites(player);
    const invite = teamName
        ? invites.find((entry) => entry.team === teamName)
        : invites[0];

    if (!invite) {
        player.sendMessage("§cConvite não encontrado");
        return;
    }

    const segundosRestantes = Math.max(
        0,
        Math.ceil((TEMPO_CONVITE - (Date.now() - invite.time)) / 1000)
    );

    const form = new ActionFormData()
        .title(clanTitle("CONVITE DE CLAN", "§d"))
        .body(clanPanelBody([
            "§8Analise do convite",
            `§7Clan: §f${invite.team}`,
            `§7Enviado por: §f${invite.senderName}`,
            `§7Expira em: §f${segundosRestantes}s`,
            "",
            "§8Deseja entrar neste clan?",
        ]))
        .button(clanButton("§a", "Aceitar", "Entrar neste clan"), CLAN_ICONS.accept)
        .button(clanButton("§c", "Recusar", "Remover convite"), CLAN_ICONS.decline)
        .button(clanButton("§7", "Voltar", "Lista de convites"), CLAN_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                aceitarConvite(player, invite.team);
                return;
            case 1:
                removeInviteByTeam(player, invite.team);
                player.sendMessage(`§cConvite de ${invite.team} recusado`);
                return;
            case 2:
                abrirListaConvites(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir convite:", error);
    });
}

function criarClanForm(player) {
    const form = new ModalFormData()
        .title(clanTitle("CRIAR CLAN", "§a"))
        .textField("Nome do clan (§ e & permitidos)", "Ate 16 letras/numeros")
        .textField("Tag do clan (§ e & permitidos, max 7 letras)", "Ex: §eA§fS§cG");

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const { teamSystem } = getClanContext(player);
        if (!teamSystem) {
            player.sendMessage("§cSistema não iniciado");
            return;
        }

        if (!canCreateClan(player, teamSystem)) {
            return;
        }

        const name = String(result.formValues?.[0] ?? "").trim();
        const tag = String(result.formValues?.[1] ?? "").trim();

        // O createTeam agora aceita a tag com cores
        const createResult = teamSystem.createTeam(name, tag);

        if (!createResult.retorna) {
            player.sendMessage(createResult.msg);
            return;
        }

        const createdTeamName = createResult.teamName ?? name;
        const joinResult = teamSystem.joinTeam(player, createdTeamName);
        // Cores padrão removidas - o usuário usa § diretamente no nome/tag

        player.sendMessage(joinResult.msg);
        abrirMenuClan(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao criar clan:", error);
    });
}

function invitePlayersForm(player) {
    const { teamSystem, team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    if (!canInvite(player, teamSystem)) {
        player.sendMessage("§cVocê não tem permissão para convidar");
        return;
    }

    const players = getOnlinePlayers()
        .filter((target) => target.id !== player.id && !teamSystem.getPlayerTeam(target));

    if (players.length === 0) {
        player.sendMessage("§cNenhum player disponível para convite");
        return;
    }

    const playerNames = players.map((target) => target.name);

    const form = new ModalFormData()
        .title(clanTitle("CONVIDAR JOGADOR", "§a"))
        .dropdown("Selecione o jogador", playerNames);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const index = result.formValues?.[0];
        const alvo = players[index];

        if (!alvo) {
            player.sendMessage("§cPlayer inválido");
            return;
        }

        const { teamKey } = getClanContext(player);
        addInvite(alvo, {
            team: teamKey || team.name,
            senderName: player.name,
            time: Date.now(),
        });

        player.sendMessage(`§aConvite enviado para ${alvo.name}`);
        conviteUI(alvo, player.name, team.name);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao convidar jogador:", error);
    });
}

function transferLeadershipForm(player) {
    const { teamSystem, team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode transferir a liderança");
        return;
    }

    const candidates = Array.from(team.members.entries()).filter(([id]) => id !== player.id);

    if (candidates.length === 0) {
        player.sendMessage("§cNão há membros para receber a liderança");
        return;
    }

    const names = candidates.map(([id, name]) => `${name} ${getRoleSuffix(team, id)}`);

    const form = new ModalFormData()
        .title(clanTitle("TRANSFERIR LIDERANCA", "§d"))
        .dropdown("Escolha o novo líder", names);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const candidate = candidates[result.formValues?.[0]];
        if (!candidate) {
            player.sendMessage("§cMembro inválido");
            return;
        }

        const [newLeaderId, newLeaderName] = candidate;
        const { teamKey } = getClanContext(player);
        const transferResult = teamSystem.transferLeadership(teamKey || team.name, player.id, newLeaderId);

        player.sendMessage(transferResult.msg);

        if (transferResult.retorna) {
            const newLeaderPlayer = getOnlinePlayers().find((target) => target.id === newLeaderId);
            if (newLeaderPlayer) {
                newLeaderPlayer.sendMessage(`§aVocê agora é o líder do clan ${team.name}`);
            }
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao transferir liderança:", error);
    });
}

function gerenciarSubLiderMenu(player) {
    const { team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode gerenciar sublíderes");
        return;
    }

    const form = new ActionFormData()
        .title(clanTitle("GERENCIAR SUBLIDER", "§5"))
        .body(clanPanelBody([
            "§8Cargos do clan",
            `§7Clan: ${formatClanName(team)}`,
            `§7Sublideres atuais: §f${team.subLeaders?.size ?? 0}`,
            "",
            "§8Promova ou remova sublideres.",
        ]))
        .button(clanButton("§a", "Adicionar Sublider", "Promover membro"), CLAN_ICONS.rank)
        .button(clanButton("§c", "Remover Sublider", "Remover cargo"), CLAN_ICONS.kick)
        .button(clanButton("§7", "Voltar", "Gestao do clan"), CLAN_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                definirSubLiderForm(player, true);
                return;
            case 1:
                definirSubLiderForm(player, false);
                return;
            case 2:
                abrirGestaoLiderMenu(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao abrir gerenciamento de sublíder:", error);
    });
}

function definirSubLiderForm(player, enabled) {
    const { teamSystem, team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cApenas o líder pode fazer isso");
        return;
    }

    const candidates = Array.from(team.members.entries()).filter(([id]) => {
        if (id === team.leader) return false;

        const isSubLeaderMember = team.subLeaders?.has(id) ?? false;
        return enabled ? !isSubLeaderMember : isSubLeaderMember;
    });

    if (candidates.length === 0) {
        player.sendMessage(
            enabled
                ? "§cNenhum membro disponível para virar sublíder"
                : "§cNão há sublíderes para remover"
        );
        return;
    }

    const names = candidates.map(([, name]) => name);

    const form = new ModalFormData()
        .title(enabled ? clanTitle("ADICIONAR SUBLIDER", "§a") : clanTitle("REMOVER SUBLIDER", "§c"))
        .dropdown("Selecione o jogador", names);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const candidate = candidates[result.formValues?.[0]];
        if (!candidate) {
            player.sendMessage("§cJogador inválido");
            return;
        }

        const [memberId, memberName] = candidate;
        const { teamKey } = getClanContext(player);
        const setResult = teamSystem.setSubLeader(teamKey || team.name, player.id, memberId, enabled);

        player.sendMessage(setResult.msg);

        if (setResult.retorna) {
            const onlinePlayer = getOnlinePlayers().find((target) => target.id === memberId);
            if (onlinePlayer) {
                onlinePlayer.sendMessage(
                    enabled
                        ? `§aVocê agora é sublíder do clan ${team.name}`
                        : `§cVocê não é mais sublíder do clan ${team.name}`
                );
            }

            player.sendMessage(
                enabled
                    ? `§7Novo sublíder: §f${memberName}`
                    : `§7Sublíder removido: §f${memberName}`
            );
        }

        gerenciarSubLiderMenu(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao definir sublíder:", error);
    });
}

function definirLimiteMembrosForm(player) {
    const { teamSystem, team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode mudar o limite");
        return;
    }

    const form = new ModalFormData()
        .title(clanTitle("LIMITE DE MEMBROS", "§a"))
        .textField(
            `Limite atual: ${team.settings?.maxMembers ?? 15}`,
            "Digite o novo limite (ex: 20)"
        );

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const value = Number(String(result.formValues?.[0] ?? "").trim());

        if (!Number.isInteger(value) || value < 2) {
            player.sendMessage("§cO limite deve ser um número inteiro maior ou igual a 2");
            return;
        }
        const { teamKey } = getClanContext(player);
        const setResult = teamSystem.setTeamLimit(teamKey || team.name, player.id, value);
        player.sendMessage(setResult.msg);
        abrirConfigClanMenu(player);
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao definir limite:", error);
    });
}
function definirHomeClan(player) {
    const { teamSystem, team, teamKey, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode definir a home");
        return;
    }

    const location = player.location;
    const result = teamSystem.setTeamHome(
        teamKey || team.name,
        player.id,
        { x: location.x, y: location.y, z: location.z },
        player.dimension.id
    );

    player.sendMessage(result.msg);
    abrirConfigClanMenu(player);
}

function removerHomeClan(player) {
    const { teamSystem, team, teamKey, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode remover a home");
        return;
    }

    const result = teamSystem.clearTeamHome(teamKey || team.name, player.id);
    player.sendMessage(result.msg);
    abrirConfigClanMenu(player);
}

function teleportarParaHomeClan(player) {
    const { team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    if (!team.home) {
        player.sendMessage("§cO clan ainda não tem uma home definida");
        return;
    }

    if (!tryUseTeleportCooldown(player, "home do clan")) return;

    try {
        const dimension = world.getDimension(team.home.dimensionId);

        player.teleport(
            {
                x: team.home.x + 0.5,
                y: team.home.y + 1,
                z: team.home.z + 0.5,
            },
            { dimension }
        );

        player.sendMessage(`§aTeleportado para a home do clan ${team.name}`);
    } catch (error) {
        console.warn("§c[Clan] Erro ao teleportar para a home:", error);
        player.sendMessage("§cNão foi possível teleportar para a home");
    }
}

function kickPlayerForm(player) {
    const { teamSystem, team } = getClanContext(player);

    if (!team) {
        player.sendMessage("§cVocê não está em um clan");
        return;
    }

    if (!canManageMembers(player, teamSystem)) {
        player.sendMessage("§cVocê não tem permissão para expulsar");
        return;
    }

    const members = Array.from(team.members.entries()).filter(([id]) => {
        if (id === player.id) return false;
        if (id === team.leader) return false;

        const targetIsSubLeader = team.subLeaders?.has(id) ?? false;
        const actorIsLeader = isLeader(player, teamSystem);
        const actorIsSubLeader = isSubLeader(player, teamSystem);

        if (actorIsLeader) {
            return true;
        }

        if (actorIsSubLeader) {
            return !targetIsSubLeader;
        }

        return false;
    });

    if (members.length === 0) {
        player.sendMessage("§cNão há membros disponíveis para expulsar");
        return;
    }

    const names = members.map(([id, memberName]) => `${memberName} ${getRoleSuffix(team, id)}`);

    const form = new ModalFormData()
        .title(clanTitle("EXPULSAR MEMBRO", "§c"))
        .dropdown("Selecione o membro", names);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        const member = members[result.formValues?.[0]];
        if (!member) {
            player.sendMessage("§cMembro inválido");
            return;
        }

        const [id, nome] = member;
        const { teamKey } = getClanContext(player);
        const kickResult = teamSystem.kickFromTeam(id, teamKey || team.name);

        player.sendMessage(
            kickResult.retorna ? `§a${nome} foi removido do clan` : kickResult.msg
        );

        const kickedPlayer = getOnlinePlayers().find((target) => target.id === id);
        if (kickedPlayer) {
            kickedPlayer.sendMessage(`§cVocê foi removido do clan ${team.name}`);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao expulsar membro:", error);
    });
}

function confirmarDeleteClan(player) {
    const { teamSystem, team, isLeader: playerIsLeader } = getClanContext(player);

    if (!team || !playerIsLeader) {
        player.sendMessage("§cSó o líder pode deletar o clan");
        return;
    }

    const form = new ActionFormData()
        .title(clanTitle("DELETAR CLAN", "§4"))
        .body(clanPanelBody([
            "§8Confirmacao critica",
            `§cVoce esta prestes a deletar o clan ${formatClanName(team)}`,
            "§cEssa acao e permanente.",
            "",
            "§8Deseja continuar?",
        ]))
        .button(clanButton("§4", "Sim, deletar", "Acao permanente"), CLAN_ICONS.delete)
        .button(clanButton("§a", "Cancelar", "Voltar para gestao"), CLAN_ICONS.back);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            const { teamKey } = getClanContext(player);
            const deleteResult = teamSystem.deleteTeam(teamKey || team.name);
            removeInvitesForTeam(teamKey || team.name);
            player.sendMessage(deleteResult.msg);
            return;
        }

        if (result.selection === 1) {
            abrirGestaoLiderMenu(player);
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao confirmar delete do clan:", error);
    });
}

function conviteUI(player, sender, teamName) {
    const form = new ActionFormData()
        .title(clanTitle("NOVO CONVITE", "§d"))
        .body(clanPanelBody([
            "§8Convite recebido",
            `§f${sender} §7te convidou para o clan §f${teamName}`,
            "",
            "§8Escolha uma opcao:",
        ]))
        .button(clanButton("§a", "Aceitar", "Entrar neste clan"), CLAN_ICONS.accept)
        .button(clanButton("§c", "Recusar", "Remover convite"), CLAN_ICONS.decline);

    showForm(form, player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            aceitarConvite(player, teamName);
            return;
        }

        if (result.selection === 1) {
            removeInviteByTeam(player, teamName);
            player.sendMessage("§cConvite recusado");
        }
    }).catch((error) => {
        console.warn("§c[Clan] Erro ao mostrar convite:", error);
    });
}

function aceitarConvite(player, teamName = null) {
    const { teamSystem } = getClanContext(player);
    const invites = getValidInvites(player);
    const invite = teamName
        ? invites.find((entry) => entry.team === teamName)
        : invites[0];

    if (!teamSystem) {
        player.sendMessage("§cSistema não iniciado");
        return { retorna: false, msg: "Sistema não iniciado" };
    }

    if (!invite) {
        player.sendMessage("§cSem convite válido");
        return { retorna: false, msg: "Sem convite válido" };
    }

    const result = teamSystem.joinTeam(player, invite.team);

    if (result.retorna || teamSystem.getPlayerTeam(player)) {
        removeInviteByTeam(player, invite.team);
        // Garante que o display do player seja atualizado imediatamente
        teamSystem.updatePlayerDisplay(player);
    }

    player.sendMessage(result.msg);
    return result;
}

function rodarAntiBug(player) {
    const { teamSystem } = getClanContext(player);

    if (!teamSystem) {
        player.sendMessage("§cSistema não iniciado");
        return;
    }

    const result = teamSystem.runConsistencyCheck();
    cleanupInvites();

    player.sendMessage(`§aAnti-bug executado. Ajustes aplicados: ${result.fixes}`);
}

function loadInvites() {
    convites.clear();

    try {
        const raw = world.getDynamicProperty(INVITES_PROPERTY_KEY) ?? world.getDynamicProperty(LEGACY_INVITES_PROPERTY_KEY);

        if (typeof raw !== "string" || raw.length === 0) {
            return;
        }

        const invitesArray = JSON.parse(raw);

        for (const entry of invitesArray) {
            const [playerId, invites] = entry;
            if (!playerId || !Array.isArray(invites)) continue;

            convites.set(playerId, invites);
        }

        cleanupInvites(false);
    } catch (error) {
        console.warn("§c[Clan] Erro ao carregar convites:", error);
    }
}

function saveInvites() {
    try {
        const invitesArray = Array.from(convites.entries());
        const json = JSON.stringify(invitesArray);
        
        // Se os convites forem muitos, a propriedade falha. 
        // Vamos limitar o salvamento de convites a apenas os ativos.
        if (json.length > 8000) {
            cleanupInvites(false);
            const reduced = Array.from(convites.entries());
            world.setDynamicProperty(INVITES_PROPERTY_KEY, JSON.stringify(reduced));
        } else {
            world.setDynamicProperty(INVITES_PROPERTY_KEY, json);
        }
        
        world.setDynamicProperty(LEGACY_INVITES_PROPERTY_KEY, undefined);
    } catch (error) {
        console.warn("§c[Clan] Erro ao salvar convites:", error);
    }
}

function addInvite(player, inviteData) {
    const key = getInviteKey(player);
    if (!key) return;

    const currentInvites = getInvitesFromMap(key).filter((invite) => invite.team !== inviteData.team);
    currentInvites.push(inviteData);

    convites.set(key, currentInvites);
    saveInvites();
}

function getInvitesFromMap(key) {
    const invites = convites.get(key);
    return Array.isArray(invites) ? invites : [];
}

function getValidInvites(player) {
    cleanupInvites();

    const key = getInviteKey(player);
    if (!key) return [];

    return getInvitesFromMap(key);
}

function removeInviteByTeam(player, teamName) {
    const key = getInviteKey(player);
    if (!key) return;

    const filtered = getInvitesFromMap(key).filter((invite) => invite.team !== teamName);

    if (filtered.length > 0) {
        convites.set(key, filtered);
    } else {
        convites.delete(key);
    }

    saveInvites();
}

function removeInvitesForTeam(teamName) {
    let changed = false;

    for (const [playerId, invites] of convites.entries()) {
        const filtered = getInvitesFromMap(playerId).filter((invite) => invite.team !== teamName);

        if (filtered.length !== invites.length) {
            changed = true;

            if (filtered.length > 0) {
                convites.set(playerId, filtered);
            } else {
                convites.delete(playerId);
            }
        }
    }

    if (changed) {
        saveInvites();
    }
}

function cleanupInvites(shouldSave = true) {
    const teamSystem = getTeamSystem();
    if (!teamSystem) return;

    let changed = false;

    for (const [playerId, invites] of convites.entries()) {
        const validInvites = getInvitesFromMap(playerId).filter((invite) => {
            if (!invite?.team || !invite?.time) {
                return false;
            }

            if (Date.now() - invite.time > TEMPO_CONVITE) {
                return false;
            }

            return Boolean(teamSystem?.teams?.has(invite.team));
        });

        if (validInvites.length !== invites.length) {
            changed = true;
        }

        if (validInvites.length > 0) {
            convites.set(playerId, validInvites);
        } else {
            convites.delete(playerId);
        }
    }

    if (changed && shouldSave) {
        saveInvites();
    }
}

function getClanContext(player) {
    const teamSystem = getTeamSystem();
    const team = teamSystem?.getPlayerTeam(player) ?? null;
    const teamKey = teamSystem?.getPlayerTeamKey(player) ?? null;
    const playerIsLeader = Boolean(team && team.leader === player.id);
    const playerIsSubLeader = Boolean(teamSystem?.isSubLeader(player));

    return {
        teamSystem,
        team,
        teamKey,
        isLeader: playerIsLeader,
        isSubLeader: playerIsSubLeader,
    };
}

function getInviteKey(player) {
    return player?.id ?? null;
}

function canCreateClan(player, teamSystem) {
    if (!player.hasTag("lider")) {
        player.sendMessage("§cVocê precisa da tag §elider §cpara criar um clan");
        return false;
    }

    if (teamSystem?.getPlayerTeam(player)) {
        player.sendMessage("§cVocê já está em um clan");
        return false;
    }

    return true;
}

function canInvite(player, teamSystem) {
    const team = teamSystem?.getPlayerTeam(player);
    if (!team) return false;

    if (team.members.size >= (team.settings?.maxMembers ?? 15)) {
        player.sendMessage("§cO clan já atingiu o limite de membros");
        return false;
    }

    return isLeader(player, teamSystem) || isSubLeader(player, teamSystem);
}

function canManageMembers(player, teamSystem) {
    return isLeader(player, teamSystem) || isSubLeader(player, teamSystem);
}

function isLeader(player, teamSystem) {
    const team = teamSystem?.getPlayerTeam(player);
    return Boolean(team && team.leader === player.id);
}

function isSubLeader(player, teamSystem) {
    return Boolean(teamSystem?.isSubLeader(player));
}

function getRoleLabel(team, playerId) {
    // Tags [L], [S], [M] removidas a pedido do usuário
    return "";
}

function getRoleSuffix(team, playerId) {
    // Tags (L), (S), (M) removidas a pedido do usuário
    return "";
}

function buildClanSummary(team, roleName) {
    return clanPanelBody([
        `§7Clan: ${formatClanName(team)}`,
        `§7Tag: ${formatClanTag(team)}`,
        `§7Membros: §f${team.members.size}/${team.settings?.maxMembers ?? 15}`,
        `§7Sublíderes: §f${team.subLeaders?.size ?? 0}`,
        `§7Home: ${team.home ? "§aDefinida" : "§cNão definida"}`,
        `§7Cargo: ${roleName}`,
        `§7Chat privado: §f!c §7ou §f/c <mensagem>`,
        "",
        "§8Escolha uma opção abaixo.",
    ]);
}

function encontrarPlayer(name, tentativas = 0, max = 20) {
    const player = world.getPlayers().find((target) => target.name === name);
    if (player) {
        const teamSystem = getTeamSystem();
        teamSystem?.onJoinPlayer(player);

        // Notificação de entrada para o clan (OTIMIZADA)
        system.run(() => {
            const team = teamSystem?.getPlayerTeam(player);
            if (team) {
                const members = teamSystem.getMembersTeam(team.name);
                if (members.size <= 1) return;
                
                const onlineMap = new Map();
                for (const p of world.getPlayers()) onlineMap.set(p.id, p);

                const msg = `§8[§6Clan§8] §7O membro §f${player.name} §7entrou no servidor!`;
                for (const memberId of members) {
                    if (memberId === player.id) continue;
                    onlineMap.get(memberId)?.sendMessage(msg);
                }
            }
        });
        return;
    }

    if (tentativas < max) {
        system.runTimeout(() => {
            encontrarPlayer(name, tentativas + 1, max);
        }, 10);
    }
}

function formatDate(timestamp) {
    if (!timestamp) {
        return "Desconhecida";
    }

    const date = new Date(timestamp);
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

function formatDateTime(timestamp) {
    if (!timestamp) {
        return "Desconhecido";
    }

    const date = new Date(timestamp);
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const year = date.getFullYear();
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");

    return `${day}/${month}/${year} ${hour}:${minute}`;
}





