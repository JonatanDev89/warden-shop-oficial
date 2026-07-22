import {
    system,
    CommandPermissionLevel,
    CustomCommandStatus,
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";
import { isAdmin, isModuleEnabled } from "../core/moduleState.js";
import { getCommandSourceEntity } from "../core/scriptCompat.js";

const COLOR = "\u00a7";

const HELP_ICONS = Object.freeze({
    teleports: "textures/icons/right_arrow",
    homes: "textures/icons/home",
    warps: "textures/icons/warps",
    utilities: "textures/icons/right_arrow",
    clan: "textures/icons/clan",
    admin: "textures/icons/clan_settings",
    back: "textures/icons/left_arrow",
    players: "textures/icons/players",
});

const HELP_SECTIONS = [
    {
        id: "teleports",
        title: "TELEPORTES",
        color: `${COLOR}e`,
        icon: HELP_ICONS.teleports,
        description: "Spawn, RTP, back e pedidos de teleporte.",
        commands: [
            { moduleId: "spawn", text: "/labsdev:spawn", description: "Ir para o spawn", icon: HELP_ICONS.teleports },
            { moduleId: "rtp", text: "/labsdev:rtp", description: "Teleporte aleatorio", icon: HELP_ICONS.teleports },
            { moduleId: "back", text: "/labsdev:back", description: "Voltar ao local da ultima morte", icon: HELP_ICONS.back },
            { moduleId: "tpa", text: "/labsdev:tpa <player>", description: "Pedir teleporte", icon: HELP_ICONS.players },
            { moduleId: "tpa", text: "/labsdev:tpahere <player>", description: "Puxar jogador", icon: HELP_ICONS.players },
            { moduleId: "tpa", text: "/labsdev:tpaccept", description: "Aceitar pedido", icon: HELP_ICONS.players },
            { moduleId: "tpa", text: "/labsdev:tpdeny", description: "Recusar pedido", icon: HELP_ICONS.players },
        ],
    },
    {
        id: "homes",
        title: "HOMES",
        color: `${COLOR}a`,
        icon: HELP_ICONS.homes,
        description: "Gerencie homes e pontos salvos.",
        commands: [
            { moduleId: "homes", text: "/labsdev:sethome <nome>", description: "Salvar uma home", icon: HELP_ICONS.homes },
            { moduleId: "homes", text: "/labsdev:home <nome>", description: "Ir para uma home", icon: HELP_ICONS.homes },
            { moduleId: "homes", text: "/labsdev:listhome", description: "Listar suas homes", icon: HELP_ICONS.homes },
            { moduleId: "homes", text: "/labsdev:homesui", description: "Abrir menu de homes", icon: HELP_ICONS.homes },
            { moduleId: "homes", text: "/labsdev:delhome <nome>", description: "Remover uma home", icon: HELP_ICONS.homes },
            { moduleId: "homes", text: "/labsdev:delhomeui", description: "Menu para deletar home", icon: HELP_ICONS.homes },
        ],
    },
    {
        id: "warps",
        title: "WARPS",
        color: `${COLOR}6`,
        icon: HELP_ICONS.warps,
        description: "Locais publicos e atalhos do servidor.",
        commands: [
            { moduleId: "warps", text: "/labsdev:warp <nome>", description: "Teleportar para uma warp", icon: HELP_ICONS.warps },
            { moduleId: "warps", text: "/labsdev:warps", description: "Abrir lista de warps", icon: HELP_ICONS.warps },
        ],
    },
    {
        id: "utilities",
        title: "UTILIDADES",
        color: `${COLOR}b`,
        icon: HELP_ICONS.utilities,
        description: "Atalhos gerais e navegacao do servidor.",
        commands: [
            { moduleId: "menu", text: "/labsdev:menu", description: "Abrir menu principal", icon: HELP_ICONS.utilities },
            { moduleId: "help", text: "/labsdev:ajuda", description: "Mostrar ajuda no chat", icon: HELP_ICONS.utilities },
            { moduleId: "warden", text: "/labsdev:resgatar", description: "Resgatar itens da loja (ou !resgatar)", icon: HELP_ICONS.utilities },
        ],
    },
    {
        id: "clan",
        title: "CLAN",
        color: `${COLOR}d`,
        icon: HELP_ICONS.clan,
        description: "Criacao, base, membros e gestao do clan.",
        commands: [
            { moduleId: "clan", text: "/labsdev:clan", description: "Abrir painel do clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan create", description: "Criar clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan accept", description: "Ver e aceitar convites", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan invite", description: "Convidar jogador", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan kick", description: "Expulsar membro", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan leave", description: "Sair do clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan home", description: "Ir para base do clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan setbase", description: "Definir base do clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "/labsdev:clan logs", description: "Ver logs do clan", icon: HELP_ICONS.clan },
            { moduleId: "clan", text: "!c ou /c <mensagem>", description: "Chat privado do clan", icon: HELP_ICONS.clan },
        ],
    },
];

const ADMIN_SECTION = {
    id: "admin",
    title: "ADMIN",
    color: `${COLOR}c`,
    icon: HELP_ICONS.admin,
    description: "Ferramentas administrativas e controle do servidor.",
    commands: [
        { text: "/labsdev:admin", description: "Abrir painel administrativo", icon: HELP_ICONS.admin, adminOnly: true },
        { moduleId: "ranks", text: "/labsdev:rank create <nome> [cor] [prio]", description: "Criar rank personalizado", icon: HELP_ICONS.admin, adminOnly: true },
        { moduleId: "ranks", text: "/labsdev:rank set <player> <rank>", description: "Setar rank de jogador online", icon: HELP_ICONS.admin, adminOnly: true },
        { moduleId: "ranks", text: "/labsdev:rank clear <player>", description: "Limpar rank manual", icon: HELP_ICONS.admin, adminOnly: true },
        { moduleId: "ranks", text: "/labsdev:rank list", description: "Listar ranks disponiveis", icon: HELP_ICONS.admin, adminOnly: true },
        { moduleId: "warps", text: "/labsdev:setwarp <nome>", description: "Criar warp publica", icon: HELP_ICONS.warps, adminOnly: true },
        { moduleId: "warps", text: "/labsdev:delwarp <nome>", description: "Remover warp publica", icon: HELP_ICONS.warps, adminOnly: true },
    ],
};

function getVisibleCommands(player, commands) {
    return commands.filter((command) => {
        if (command.moduleId && !isModuleEnabled(command.moduleId)) return false;
        if (command.adminOnly && !isAdmin(player)) return false;
        return true;
    });
}

function getVisibleSections(player) {
    const sections = HELP_SECTIONS
        .map((section) => ({ ...section, commands: getVisibleCommands(player, section.commands) }))
        .filter((section) => section.commands.length > 0);

    if (isAdmin(player)) {
        const adminCommands = getVisibleCommands(player, ADMIN_SECTION.commands);
        if (adminCommands.length > 0) sections.push({ ...ADMIN_SECTION, commands: adminCommands });
    }
    return sections;
}

function getHelpStats(sections) { return sections.reduce((total, section) => total + section.commands.length, 0); }

function sendChat(player, message) {
    try { player.sendMessage(message); return true; } catch { return false; }
}

function formatCommandLine(command) {
    const suffix = command.adminOnly ? ` ${COLOR}c[staff]` : "";
    return `${COLOR}8- ${COLOR}f${command.text}${suffix} ${COLOR}7- ${command.description}`;
}

function sendHelp(player) {
    if (!isModuleEnabled("help")) return false;
    const sections = getVisibleSections(player);
    if (sections.length === 0) {
        sendChat(player, `${COLOR}cNenhuma categoria de ajuda esta disponivel no momento.`);
        return false;
    }
    sendChat(player, [
        `${COLOR}7+--------------------+`,
        `${COLOR}b${COLOR}lLabs Essentials ${COLOR}7- Ajuda`,
        `${COLOR}7+--------------------+`,
    ].join("\n"));

    for (const section of sections) {
        sendChat(player, [
            `${section.color}${COLOR}l${section.title}${COLOR}r`,
            ...section.commands.map(formatCommandLine),
        ].join("\n"));
    }
    return true;
}

function registerHelpCommand(registry, name) {
    try {
        registry.registerCommand(
            { name, description: "Ajuda", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: true },
            (origin) => {
                const player = getCommandSourceEntity(origin);
                if (player) system.run(() => sendHelp(player));
                return { status: CustomCommandStatus.Success };
            }
        );
    } catch (error) {}
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    CommandBridge.register("ajuda", (player, args) => {
        if (!isModuleEnabled("help")) {
            player.sendMessage("§cSistema de ajuda desativado.");
            return;
        }
        sendHelp(player);
    });
    if (customCommandRegistry) registerHelpCommand(customCommandRegistry, "labsdev:ajuda");
});
