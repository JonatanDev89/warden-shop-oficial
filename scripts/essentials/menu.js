import {
    world,
    system,
    CustomCommandStatus,
    CommandPermissionLevel
} from "@minecraft/server";
import { CommandBridge } from "../core/bridge.js";

import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { tryRunCommand } from "../core/commandUtils.js";
import { isModuleEnabled, showForm } from "../core/moduleState.js";
import { getCommandSourceEntity, getOnlinePlayers, isValidEntity } from "../core/scriptCompat.js";

import { sendTPA, sendTPAHere, isTpaMenuMode, setTpaMenuMode, acceptRequest, denyRequest } from "./tpa.js";
import { getRequestsForPlayer } from "./tpa_requests.js";
import {
    getHomes,
    listHomesForPlayer,
    openDeleteHomeUI,
    openHomesUI,
    setHomeForPlayer,
} from "./homes.js";

const ICONS = {
    warp: "textures/icons/warps",
    homes: "textures/icons/home.png",
    player: "textures/icons/players",
    clan: "textures/icons/clan",
    back: "textures/icons/left_arrow",
    settings: "textures/ui/settings_glyph_color_2x",
    requests: "textures/ui/icon_book_writable"
};

function panelTitle(title, color = "§b") {
    return `${color}§l${title}`;
}

function panelBody(subtitle, lines = []) {
    return [
        "§7| §b§lWardenCraft §7|",
        "",
        `§f${subtitle}`,
        "",
        ...lines,
    ].join("\n");
}

function menuButton(color, title, description) {
    return `${color}§l${title}\n§f${description}`;
}

function moduleDisabled(player, name) {
    player.sendMessage(`§cO sistema ${name} esta desativado.`);
}

function getHomesCount(player) {
    return Object.keys(getHomes(player)).length;
}

function runMenuCommand(player, command, label) {
    system.run(() => {
        if (!tryRunCommand(player, command)) {
            player.sendMessage(`§cNao foi possivel abrir ${label}.`);
        }
    });
}

function buildMenuButtons(player) {
    const isMenuMode = isTpaMenuMode(player);
    const requests = getRequestsForPlayer(player);
    const reqCount = requests.length;

    const buttons = [
        {
            id: "warp",
            label: menuButton("§e", "Warps", "Locais publicos"),
            icon: ICONS.warp,
            action: () => {
                if (!isModuleEnabled("warps")) {
                    moduleDisabled(player, "Warps");
                    return;
                }
                runMenuCommand(player, "labsdev:warps", "Warps");
            },
        },
        {
            id: "homes",
            label: menuButton("§a", "Homes", "Pontos salvos"),
            icon: ICONS.homes,
            action: () => {
                if (!isModuleEnabled("homes")) {
                    moduleDisabled(player, "Homes");
                    return;
                }
                homesMenu(player);
            },
        },
        {
            id: "player",
            label: menuButton("§b", "Players", "TPA online"),
            icon: ICONS.player,
            action: () => {
                if (!isModuleEnabled("tpa")) {
                    moduleDisabled(player, "Player");
                    return;
                }
                playersMenu(player);
            },
        }
    ];

    // SÓ ADICIONA O BOTÃO DE SOLICITAÇÕES SE O MODO MENU ESTIVER ATIVO
    if (isMenuMode) {
        buttons.push({
            id: "requests",
            label: menuButton(reqCount > 0 ? "§6" : "§7", "Solicitacoes", reqCount > 0 ? `§f${reqCount} pendentes` : "Nenhum pedido"),
            icon: ICONS.requests,
            action: () => {
                if (!isModuleEnabled("tpa")) {
                    moduleDisabled(player, "TPA");
                    return;
                }
                requestsMenu(player);
            },
        });
    }

    buttons.push(
        {
            id: "clan",
            label: menuButton("§d", "Clan", "Criar e gerenciar"),
            icon: ICONS.clan,
            action: () => {
                if (!isModuleEnabled("clan")) {
                    moduleDisabled(player, "Clan");
                    return;
                }
                runMenuCommand(player, "labsdev:clan", "Clan");
            },
        },
        {
            id: "settings",
            label: menuButton("§3", "Configuracoes", "Ajustar preferencias"),
            icon: ICONS.settings,
            action: () => {
                settingsMenu(player);
            },
        }
    );
    
    return buttons;
}

function getValidMenuButtons(buttons, menuName) {
    return buttons.filter(b => b.label && b.icon && b.action);
}

export function essentialsMenu(player) {
    if (!isModuleEnabled("menu")) return;
    const buttons = getValidMenuButtons(buildMenuButtons(player), "menu principal");
    
    const form = new ActionFormData()
        .title(panelTitle("MENU DO SERVIDOR", "§b"))
        .body(panelBody("Escolha um Comando:", []));

    buttons.forEach((button) => {
        form.button(button.label, button.icon);
    });

    showForm(form, player).then(r => {
        if (r.canceled) return;
        const selectedButton = buttons[r.selection];
        if (selectedButton) selectedButton.action();
    });
}

function settingsMenu(player) {
    const isMenuMode = isTpaMenuMode(player);
    
    const form = new ActionFormData()
        .title(panelTitle("CONFIGURACOES", "§3"))
        .body(panelBody("Ajuste suas preferencias de jogo:", [
            `§7Modo de Recebimento TPA: ${isMenuMode ? "§aMENU" : "§eTELA"}`,
            "",
            "§7No modo §aMENU§7, o botao §6Solicitacoes§7",
            "§7aparecera no seu menu principal."
        ]))
        .button(menuButton(isMenuMode ? "§e" : "§a", "Alternar Modo TPA", isMenuMode ? "Mudar para modo TELA" : "Mudar para modo MENU"), ICONS.settings)
        .button(menuButton("§c", "Voltar", "Menu principal"), ICONS.back);

    showForm(form, player).then(r => {
        if (r.canceled) return;
        if (r.selection === 0) {
            setTpaMenuMode(player, !isMenuMode);
            settingsMenu(player);
        } else {
            essentialsMenu(player);
        }
    });
}

function requestsMenu(player) {
    const requests = getRequestsForPlayer(player);
    
    if (requests.length === 0) {
        const emptyForm = new ActionFormData()
            .title(panelTitle("SOLICITACOES", "§6"))
            .body(panelBody("Nenhuma solicitacao pendente.", []))
            .button(menuButton("§c", "Voltar", "Menu principal"), ICONS.back);
        
        showForm(emptyForm, player).then(() => essentialsMenu(player));
        return;
    }

    const form = new ActionFormData()
        .title(panelTitle("SOLICITACOES", "§6"))
        .body(panelBody(`Voce tem §f${requests.length} §7pedidos:`, []));

    requests.forEach(req => {
        const typeStr = req.type === "tpa" ? "TPA" : "TPAHere";
        form.button(menuButton("§f", req.sender.name, `Tipo: ${typeStr}`), ICONS.player);
    });
    
    form.button(menuButton("§c", "Voltar", "Menu principal"), ICONS.back);

    showForm(form, player).then(r => {
        if (r.canceled) return;
        if (r.selection === requests.length) {
            essentialsMenu(player);
            return;
        }

        const selectedReq = requests[r.selection];
        requestActionMenu(player, selectedReq);
    });
}

function requestActionMenu(player, request) {
    const typeStr = request.type === "tpa" ? "ir ate voce" : "te puxar";
    
    const form = new ActionFormData()
        .title(panelTitle(request.sender.name, "§e"))
        .body(panelBody(`O jogador quer ${typeStr}.`, []))
        .button("§aACEITAR")
        .button("§cRECUSAR")
        .button("§7VOLTAR");

    showForm(form, player).then(r => {
        if (r.canceled || r.selection === 2) {
            requestsMenu(player);
            return;
        }

        if (r.selection === 0) {
            acceptRequest(player, request.sender.id);
        } else {
            denyRequest(player, request.sender.id);
            requestsMenu(player);
        }
    });
}

function playersMenu(player) {
    if (!isModuleEnabled("menu")) return;

    const players = getOnlinePlayers().filter(p => p.name !== player.name);

    if (players.length === 0) {
        player.sendMessage("§cNenhum jogador online.");
        return;
    }

    const form = new ActionFormData()
        .title(panelTitle("PLAYER", "§b"))
        .body(panelBody("Jogadores online:", [
            "§7Selecione um jogador para abrir as acoes.",
        ]));

    players.forEach(p => {
        form.button(menuButton("§a", p.name, "Abrir acoes de player"), ICONS.player);
    });

    form.button(menuButton("§c", "Voltar", "Menu principal"), ICONS.back);

    showForm(form, player).then(r => {
        if (r.canceled) return;

        if (r.selection === players.length) {
            essentialsMenu(player);
            return;
        }

        const target = players[r.selection];
        if (!target || !isValidEntity(target)) return; // Adicionado isValidEntity para evitar erro de entidade inválida

        playerActionMenu(player, target);
    });
}

function playerActionMenu(player, target) {
    if (!isModuleEnabled("menu")) return;

    const form = new ActionFormData()
        .title(panelTitle(target.name, "§b"))
        .body(panelBody("Escolha uma acao:", [
            `§7Jogador: §f${target.name}`,
        ]))
        .button(menuButton("§a", "TPA", "Pedir teleporte ate o jogador"), ICONS.player)
        .button(menuButton("§e", "TPAHere", "Chamar o jogador ate voce"), ICONS.player)
        .button(menuButton("§c", "Voltar", "Lista de jogadores"), ICONS.back);

    showForm(form, player).then(r => {
        if (r.canceled) return;

        if (r.selection === 0) {
            sendTPA(player, target);
        }

        if (r.selection === 1) {
            sendTPAHere(player, target);
        }

        if (r.selection === 2) {
            playersMenu(player);
        }
    });
}

function homesMenu(player) {
    if (!isModuleEnabled("menu")) return;
    if (!isModuleEnabled("homes")) {
        moduleDisabled(player, "Homes");
        return;
    }

    const homesCount = getHomesCount(player);

    const form = new ActionFormData()
        .title(panelTitle("HOMES", "§a"))
        .body(panelBody("Gerencie suas homes:", [
            `\u00a77Homes salvas: \u00a7f${homesCount}`,
            "§7Teleporte, crie, liste ou delete pontos salvos.",
        ]))
        .button(menuButton("§a", "Ir para Home", "Teleportar para home"), ICONS.homes)
        .button(menuButton("§e", "Definir Home", "Definir Homes"), ICONS.warp)
        .button(menuButton("§b", "Listar Homes", "Mostrar Nomes"), ICONS.homes)
        .button(menuButton("§c", "Deletar Home", "Remover uma Home"), ICONS.homes)
        .button(menuButton("§c", "Voltar", "Menu principal"), ICONS.back);

    showForm(form, player).then(r => {
        if (r.canceled) return;

        switch (r.selection) {
            case 0:
                openHomesUI(player, () => homesMenu(player));
                break;

            case 1:
                homeSetUI(player);
                break;

            case 2:
                listHomesForPlayer(player);
                system.runTimeout(() => homesMenu(player), 1);
                break;

            case 3:
                openDeleteHomeUI(player, () => homesMenu(player));
                break;

            case 4:
                essentialsMenu(player);
                break;
        }
    });
}

function homeSetUI(player) {
    if (!isModuleEnabled("menu")) return;
    if (!isModuleEnabled("homes")) {
        moduleDisabled(player, "Homes");
        return;
    }

    new ModalFormData()
        .title(panelTitle("DEFINIR HOME", "§e"))
        .textField("Nome da home:", "casa")
        .show(player)
        .then(r => {
            if (r.canceled) {
                homesMenu(player);
                return;
            }

            const name = r.formValues[0];

            if (!name || name.trim() === "") {
                homeSetUI(player);
                player.sendMessage("§cDigite um nome valido!");
                return;
            }

            if (setHomeForPlayer(player, name)) {
                homesMenu(player);
            } else {
                homeSetUI(player);
            }
        }).catch(() => {
            player.sendMessage("\u00a7cNao foi possivel abrir o menu de homes.");
            homesMenu(player);
        });
}

system.runInterval(() => {
    if (!isModuleEnabled("menu")) return;

    for (const player of getOnlinePlayers()) {
        if (player.hasTag("openmenu:essentials")) {
            system.run(() => {
                essentialsMenu(player);
                tryRunCommand(player, "tag @s remove openmenu:essentials");
            });
        }
    }
}, 20);

system.beforeEvents.startup.subscribe((event) => {
    CommandBridge.register("menu", (player, args) => {
        if (!isModuleEnabled("menu")) {
            player.sendMessage("§cMenu desativado.");
            return;
        }
        essentialsMenu(player);
    });
    
    const registry = event.customCommandRegistry;
    if (!registry) return;

    registry.registerCommand(
        {
            name: "labsdev:menu",
            description: "Abrir menu Labs Essentials",
            permissionLevel: CommandPermissionLevel.Any
        },
        (origin) => {
            if (!isModuleEnabled("menu")) return { status: CustomCommandStatus.Failure };
            const player = getCommandSourceEntity(origin);
            if (!player) return { status: CustomCommandStatus.Failure };
            system.run(() => essentialsMenu(player));
            return { status: CustomCommandStatus.Success };
        }
    );
});

world.afterEvents.itemUse.subscribe((event) => {
    if (!isModuleEnabled("menu")) return;
    const player = event.source;
    const item = event.itemStack;
    if (item?.typeId === "minecraft:recovery_compass") {
        essentialsMenu(player);
    }
});
