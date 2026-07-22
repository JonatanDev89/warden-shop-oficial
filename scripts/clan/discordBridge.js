import { system, world } from "@minecraft/server";
import { getTeamSystem } from "./teamManager.js";
import { getOnlinePlayers } from "../core/scriptCompat.js";
import { setPlayerBan, clearPlayerBan, getAllBanEntries } from "../core/moduleState.js";
import { setPlayerMute, removePlayerMute, getMutedPlayers } from "../core/adminpanel.js";

const SECRET_TOKEN = "AJSNFJSKSNASNSJ"; 
const BRIDGE_URL = "https://warden3000.discloud.app"; 

async function syncToBot(endpoint, data) {
    try {
        const { http, HttpRequest, HttpRequestMethod, HttpHeader } = await import("@minecraft/server-net");
        const req = new HttpRequest(`${BRIDGE_URL}/${endpoint}?token=${SECRET_TOKEN}`);
        req.method = HttpRequestMethod.Post;
        req.body = JSON.stringify(data);
        req.headers = [
            new HttpHeader("Content-Type", "application/json"),
            new HttpHeader("ngrok-skip-browser-warning", "true")
        ];
        return await http.request(req);
    } catch (e) { throw e; }
}

async function fetchCommands() {
    try {
        const { http, HttpRequest, HttpRequestMethod, HttpHeader } = await import("@minecraft/server-net");
        const req = new HttpRequest(`${BRIDGE_URL}/get-commands?token=${SECRET_TOKEN}`);
        req.method = HttpRequestMethod.Get;
        req.headers = [new HttpHeader("ngrok-skip-browser-warning", "true")];
        const response = await http.request(req);
        if (response.status === 200) {
            const data = JSON.parse(response.body);
            if (data.commands && data.commands.length > 0) {
                for (const cmdObj of data.commands) {
                    executeRemoteCommand(cmdObj);
                }
            }
        }
    } catch (e) {}
}

function executeRemoteCommand(cmdObj) {
    const { command, args } = cmdObj;
    system.run(() => {
        try {
            // BANIMENTO
            if (command === "banir" || command === "ban") {
                const parts = (args || "").split("|");
                const playerName = parts[0].trim();
                const banReason = (parts[1] || "Banido pelo Discord").trim();
                if (!playerName) return;
                setPlayerBan({ playerName }, { playerName, reason: banReason, bannedBy: "Discord", createdAt: Date.now() });
                const onlineTarget = getOnlinePlayers().find(p => p.name.toLowerCase() === playerName.toLowerCase());
                if (onlineTarget) system.runTimeout(() => { try { onlineTarget.kick(banReason); } catch { world.getDimension("overworld").runCommand(`kick "${onlineTarget.name}" ${banReason}`); } }, 5);
                return;
            }

            if (command === "desbanir" || command === "unban") {
                const playerName = (args || "").split("|")[0].trim();
                if (playerName) clearPlayerBan({ playerName });
                return;
            }

            let finalCmd = "";
            const cmdMap = {
                "broadcast": (a) => `tellraw @a {"rawtext":[{"text":"§b§l[ANÚNCIO]§r §f${a}"}]}`,
                "discord_chat": (a) => {
                    const [u, t] = (a || "").split("|");
                    return `tellraw @a {"rawtext":[{"text":"§9[Discord] §7${u}: §f${t}"}]}`;
                },
                "clearinv": (a) => `clear "${(a || "").split("|")[0].trim()}"`,
                "expulsar": (a) => {
                    const [p, r] = (a || "").split("|");
                    return `kick "${p.trim()}" ${r || "Expulso pelo Discord"}`;
                },
                "silenciar": (a) => {
                    const [p, r] = (a || "").split("|");
                    const playerName = p.trim();
                    const reason = r || "Silenciado pelo Discord";
                    if (playerName) {
                        setPlayerMute(playerName, reason, "Discord");
                        world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"§b[Discord] §7O jogador §f${playerName} §7foi silenciado por: §f${reason}"}]}`);
                    }
                    return "";
                },
                "dessilenciar": (a) => {
                    const playerName = (a || "").split("|")[0].trim();
                    if (playerName) {
                        removePlayerMute(playerName);
                        world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"§b[Discord] §7O jogador §f${playerName} §7foi dessilenciado."}]}`);
                    }
                    return "";
                },
                "congelar": (a) => freezeAction(a, true),
                "descongelar": (a) => freezeAction(a, false),
                "freeze": (a) => {
                    const parts = (a || "").split("|");
                    const stateArg = (parts[1] || "true").toLowerCase().trim();
                    const shouldFreeze = stateArg === "true";
                    return freezeAction(a, shouldFreeze);
                },
                "unfreeze": (a) => freezeAction(a, false)
            };

            function freezeAction(argsStr, shouldFreeze) {
                const p = (argsStr || "").split("|")[0].trim();
                if (!p) return "";
                const state = shouldFreeze ? "disabled" : "enabled";
                const permissions = ["camera", "dismount", "jump", "lateral_movement", "mount", "move_backward", "move_forward", "move_left", "move_right", "movement", "sneak"];
                
                permissions.forEach(perm => {
                    try {
                        world.getDimension("overworld").runCommand(`inputpermission set "${p}" ${perm} ${state}`);
                    } catch (e) {}
                });

                const msg = shouldFreeze ? `§cJogador ${p} foi congelado.` : `§aJogador ${p} foi descongelado.`;
                world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"§b[Discord] ${msg}"}]}`);
                
                return "";
            }

            if (cmdMap[command]) {
                const result = cmdMap[command](args);
                if (result) {
                    if (result.startsWith("/")) finalCmd = result.substring(1);
                    else finalCmd = result;
                    world.getDimension("overworld").runCommand(finalCmd);
                }
            } else if (command.startsWith("clan:") || command.startsWith("warden:")) {
                handleClanCommand(command, args);
                return;
            } else if (command === "warden:telagem" || command === "warden:telagem_end") {
                // Encaminha para o sistema de telagem via scriptEvent
                system.sendScriptEvent(command, (args || "").trim());
                return;
            } else {
                const cleanArgs = (args || "").replace(/\|/g, " ");
                finalCmd = cleanArgs ? `${command} ${cleanArgs}` : command;
                if (finalCmd.startsWith("/")) finalCmd = finalCmd.substring(1);
                world.getDimension("overworld").runCommand(finalCmd);
            }
        } catch (e) {}
    });
}

function respond(payload) {
    syncToBot("clan-response", payload).catch(() => {});
}

export function setupDiscordBridge() {
    system.runInterval(() => { fetchCommands(); }, 40);
    system.runInterval(() => {
        const players = getOnlinePlayers();
        const bans = getAllBanEntries();
        syncToBot("update-status", {
            players: players.length,
            playerList: players.map(p => p.name),
            banList: bans.map(b => b.playerName),
            tps: 20,
            latency: 0
        }).catch(() => {});

        const teamSystem = getTeamSystem();
        if (teamSystem) {
            const clans = [];
            for (const [name, team] of teamSystem.teams) {
                clans.push({ 
                    id: name, name: team.name, tag: team.tag, 
                    owner: team.leader || "Ninguém", members: team.members.size, 
                    memberLimit: team.settings?.maxMembers ?? 15 
                });
            }
            syncToBot("update-clans", { clans }).catch(() => {});
        }
    }, 400);
}

function handleClanCommand(id, message) {
    const teamSystem = getTeamSystem();
    if (!teamSystem) return respond({ error: "Offline." });
    const onlinePlayers = getOnlinePlayers();

    if (id === "clan:list") {
        const clans = [];
        for (const [name, team] of teamSystem.teams) {
            clans.push({
                id: name, name: team.name, tag: team.tag, owner: team.leader || "Ninguém",
                members: team.members.size, memberLimit: team.settings?.maxMembers ?? 15,
                friendlyFire: team.friendlyFire ?? false
            });
        }
        respond({ action: "list", clans });
    }

    if (id === "clan:info") {
        const team = teamSystem.teams.get(message);
        if (!team) return respond({ action: "info", error: "Não encontrado." });
        const members = [];
        for (const [pid, pName] of team.members) {
            members.push({ name: pName, online: onlinePlayers.some(p => p.id === pid), role: pid === team.leader ? "Líder" : "Membro" });
        }
        respond({
            action: "info", id: team.name, name: team.name, tag: team.tag,
            owner: team.leader || "Ninguém", members: members,
            memberLimit: team.settings?.maxMembers ?? 15, friendlyFire: team.friendlyFire ?? false
        });
    }

    if (id === "clan:delete") {
        world.getDimension("overworld").runCommand(`labsdev:clan delete "${message}"`);
    }

    if (id === "clan:permissao") {
        const [acao, jogador] = message.split("|");
        const sub = acao === "grant" ? "add" : "remove";
        // Executa o comando de tag diretamente no mundo
        try {
            world.getDimension("overworld").runCommand(`tag "${jogador}" ${sub} lider`);
        } catch (e) {
            console.warn(`[DiscordBridge] Erro ao alterar tag lider de ${jogador}: ${e}`);
        }
    }

    if (id === "warden:banlist") {
        const bans = getAllBanEntries();
        console.warn(`[DiscordBridge] Enviando banlist com ${bans.length} bans.`);
        respond({ action: "banlist", bans: bans.map(b => ({ name: b.playerName, reason: b.reason || "Sem motivo", staff: b.bannedBy || "Admin", date: b.createdAt })) });
    }

    if (id === "warden:mutelist") {
        const mutedObj = getMutedPlayers();
        const mutedList = Object.values(mutedObj).map(m => ({ name: m.name, reason: m.reason || "Sem motivo", staff: m.staff || "Admin", date: m.date }));
        console.warn(`[DiscordBridge] Enviando mutelist.`);
        respond({ action: "mutelist", muted: mutedList });
    }
}
