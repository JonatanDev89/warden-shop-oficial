import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
    system,
    world,
} from "@minecraft/server";
import { CommandBridge } from "./bridge.js";
import { isAdmin, isModuleEnabled } from "./moduleState.js";
import { getCommandSourceEntity, getOnlinePlayers, isValidEntity } from "./scriptCompat.js";

const COLOR = "\u00a7";
const RANK_STATE_KEY = "labsdev:rank_state";
const CUSTOM_RANKS_KEY = "labsdev:custom_ranks";
const RANK_TAG_PREFIX = "rank_";
const STAFF_ACCESS_TAG = `${RANK_TAG_PREFIX}staff_access`;
const DEFAULT_RANK_ID = "player";

export const RANK_COLOR_OPTIONS = Object.freeze([
    { id: "blue", label: "Azul", code: `${COLOR}9` },
    { id: "red", label: "Vermelho", code: `${COLOR}c` },
    { id: "green", label: "Verde", code: `${COLOR}a` },
    { id: "dark_green", label: "Verde escuro", code: `${COLOR}2` },
    { id: "yellow", label: "Amarelo", code: `${COLOR}e` },
    { id: "gold", label: "Dourado", code: `${COLOR}6` },
    { id: "purple", label: "Roxo", code: `${COLOR}5` },
    { id: "pink", label: "Rosa", code: `${COLOR}d` },
    { id: "aqua", label: "Aqua", code: `${COLOR}b` },
    { id: "gray", label: "Cinza", code: `${COLOR}7` },
    { id: "dark_gray", label: "Cinza escuro", code: `${COLOR}8` },
    { id: "white", label: "Branco", code: `${COLOR}f` },
]);

export const RANKS = Object.freeze([
    { id: "player", label: "PLAYER", color: `${COLOR}9`, icon: "\uE104", aliases: ["membro", "default"], tags: ["player", "membro", "rank_player"], priority: 0, staff: false },
    { id: "admin", label: "ADMIN", color: `${COLOR}c`, icon: "\uE102", aliases: ["adm"], tags: ["admin", "adm", "rank_admin"], priority: 90, staff: true },
    { id: "mod", label: "MOD", color: `${COLOR}2`, icon: "\uE106", aliases: ["moderador"], tags: ["mod", "moderador", "rank_mod"], priority: 80, staff: true },
    { id: "helper", label: "HELPER", color: `${COLOR}a`, icon: "\uE106", aliases: ["ajudante"], tags: ["helper", "ajudante", "rank_helper"], priority: 70, staff: true },
    { id: "tiktok", label: "TIKTOK", color: `${COLOR}b`, icon: "\uE1B3", aliases: ["tik_tok", "ttk"], tags: ["tiktok", "tik_tok", "ttk", "rank_tiktok"], priority: 50, staff: false },
    { id: "owner", label: "OWNER", color: `${COLOR}6`, icon: "\uE107", aliases: ["dono", "owner"], tags: ["dono", "owner", "rank_owner"], priority: 100, staff: true },
    { id: "ytb", label: "YTB", color: `${COLOR}c`, icon: "\uE1B1", aliases: ["youtube", "youtuber"], tags: ["ytb", "youtube", "youtuber", "rank_ytb"], priority: 48, staff: false },
    { id: "builder", label: "BUILDER", color: `${COLOR}6`, icon: "\uE108", aliases: ["build", "construtor"], tags: ["builder", "build", "construtor", "rank_builder"], priority: 60, staff: true },
    { id: "mvpplusplus", label: "MVP++", color: `${COLOR}d`, icon: "\uE107", aliases: ["mvp++", "mvp_plus_plus"], tags: ["mvpplusplus", "mvp_plus_plus", "rank_mvpplusplus"], priority: 44, staff: false },
    { id: "mvpplus", label: "MVP+", color: `${COLOR}d`, icon: "\uE107", aliases: ["mvp+", "mvp_plus"], tags: ["mvpplus", "mvp_plus", "rank_mvpplus"], priority: 42, staff: false },
    { id: "mvp", label: "MVP", color: `${COLOR}e`, icon: "\uE107", aliases: [], tags: ["mvp", "rank_mvp"], priority: 40, staff: false },
    { id: "staff", label: "STAFF", color: `${COLOR}e`, icon: "\uE107", aliases: ["equipe"], tags: ["staff", "equipe", "rank_staff"], priority: 65, staff: true },
    { id: "graph", label: "GRAPH", color: `${COLOR}e`, icon: "\uE108", aliases: ["designer", "design"], tags: ["graph", "designer", "design", "rank_graph"], priority: 55, staff: false },
    { id: "dev", label: "DEV", color: `${COLOR}6`, icon: "\uE108", aliases: ["developer", "desenvolvedor"], tags: ["dev", "developer", "rank_dev"], priority: 95, staff: true },
    { id: "twitch", label: "TWITCH", color: `${COLOR}5`, icon: "\uE1B4", aliases: ["streamer"], tags: ["twitch", "streamer", "rank_twitch"], priority: 46, staff: false },
    { id: "vip", label: "VIP", color: `${COLOR}d`, icon: "\uE107", aliases: [], tags: ["vip", "rank_vip"], priority: 30, staff: false },
    { id: "vipplus", label: "VIP+", color: `${COLOR}d`, icon: "\uE107", aliases: ["vip+", "vip_plus"], tags: ["vipplus", "vip_plus", "rank_vipplus"], priority: 32, staff: false },
    { id: "support", label: "SUPORTE", color: `${COLOR}a`, icon: "\uE106", aliases: ["suporte", "suport"], tags: ["support", "suporte", "suport", "rank_support"], priority: 72, staff: true },
]);

const RANK_BY_ID = new Map(RANKS.map((rank) => [rank.id, rank]));
const RANK_BY_ALIAS = new Map();
for (const rank of RANKS) {
    for (const value of [rank.id, rank.label, ...(rank.aliases ?? []), ...(rank.tags ?? [])]) {
        RANK_BY_ALIAS.set(normalizeRankKey(value), rank.id);
    }
}

function normalizeRankKey(value) {
    return stripColorCodes(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^rank[_:-]/, "").replace(/\s+/g, "").replace(/[^a-z0-9+_]/g, "");
}

function stripColorCodes(value) {
    return String(value ?? "").replace(/[\u00a7&][0-9a-fk-or]/gi, "");
}

function normalizeCustomRankId(value) {
    return stripColorCodes(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^rank[_:-]/, "").replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "").slice(0, 24);
}

function normalizeRankLabel(value) {
    return stripColorCodes(value).replace(/\s+/g, " ").trim().toUpperCase().slice(0, 18);
}

function normalizeRankColor(value, fallback = `${COLOR}7`) {
    const raw = String(value ?? "").trim();
    const key = normalizeRankKey(raw);
    const option = RANK_COLOR_OPTIONS.find((entry) => (entry.id === key || normalizeRankKey(entry.label) === key || entry.code === raw));
    if (option) return option.code;
    const codeMatch = raw.match(/^[\u00a7&]([0-9a-f])$/i) ?? raw.match(/^([0-9a-f])$/i);
    if (!codeMatch) return fallback;
    const code = `${COLOR}${codeMatch[1].toLowerCase()}`;
    return RANK_COLOR_OPTIONS.some((entry) => entry.code === code) ? code : fallback;
}

function normalizeRankPriority(value, fallback = 20) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.max(0, Math.min(99, number)) : fallback;
}

function normalizeRankAliases(value) {
    const source = Array.isArray(value) ? value : String(value ?? "").split(",");
    return Array.from(new Set(source.map((entry) => normalizeRankKey(entry)).filter((entry) => entry.length > 0)));
}

function normalizeCustomRankEntry(entry = {}) {
    const label = normalizeRankLabel(entry.label ?? entry.name ?? entry.id);
    const id = normalizeCustomRankId(entry.id ?? label);
    if (!id || !label || RANK_BY_ID.has(id)) return null;
    const aliases = normalizeRankAliases([...normalizeRankAliases(entry.aliases), ...normalizeRankAliases(entry.tags)]).filter((alias) => alias !== id && alias !== `${RANK_TAG_PREFIX}${id}`);
    const createdAt = Number(entry.createdAt);
    return { id, label, color: normalizeRankColor(entry.color), aliases, tags: Array.from(new Set([id, `${RANK_TAG_PREFIX}${id}`, ...aliases])), priority: normalizeRankPriority(entry.priority), staff: entry.staff === true, custom: true, createdBy: String(entry.createdBy ?? ""), createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() };
}

export function loadCustomRanks() {
    try {
        const raw = world.getDynamicProperty(CUSTOM_RANKS_KEY);
        if (!raw || typeof raw !== "string") return [];
        const parsed = JSON.parse(raw);
        const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.ranks) ? parsed.ranks : Object.values(parsed?.ranks ?? {});
        const seen = new Set(RANKS.map((rank) => rank.id));
        const ranks = [];
        for (const entry of source) {
            const rank = normalizeCustomRankEntry(entry);
            if (!rank || seen.has(rank.id)) continue;
            seen.add(rank.id);
            ranks.push(rank);
        }
        return ranks.sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label));
    } catch { return []; }
}

export function saveCustomRanks(ranks) {
    const seen = new Set(RANKS.map((rank) => rank.id));
    const normalizedRanks = {};
    for (const entry of Array.isArray(ranks) ? ranks : []) {
        const rank = normalizeCustomRankEntry(entry);
        if (!rank || seen.has(rank.id)) continue;
        seen.add(rank.id);
        normalizedRanks[rank.id] = rank;
    }
    world.setDynamicProperty(CUSTOM_RANKS_KEY, JSON.stringify({ ranks: normalizedRanks }));
}

export function getAllRanks() { return [...RANKS, ...loadCustomRanks()]; }

export function deleteCustomRank(rankId) {
    const id = String(rankId ?? "").trim().toLowerCase();
    if (!id) return { success: false, message: "ID inválido." };
    if (RANK_BY_ID.has(id)) return { success: false, message: "Não é possível excluir ranks padrão." };
    const ranks = loadCustomRanks();
    const index = ranks.findIndex((rank) => rank.id === id);
    if (index === -1) return { success: false, message: "Rank não encontrado." };
    const removed = ranks.splice(index, 1)[0];
    saveCustomRanks(ranks);
    return { success: true, rank: removed };
}

export function createCustomRank(data = {}, createdBy = "") {
    const label = normalizeRankLabel(data.label ?? data.name);
    if (!label) return { success: false, message: "Digite um nome valido para o rank." };
    const id = normalizeCustomRankId(data.id ?? label);
    if (!id) return { success: false, message: "Nao foi possivel gerar o id do rank." };
    if (RANK_BY_ID.has(id)) return { success: false, message: "Ja existe um rank padrao com esse nome." };
    const ranks = loadCustomRanks();
    if (ranks.some((rank) => rank.id === id)) return { success: false, message: "Ja existe um rank criado com esse nome." };
    const rank = normalizeCustomRankEntry({ ...data, id, label, createdBy, createdAt: Date.now() });
    if (!rank) return { success: false, message: "Nao foi possivel criar esse rank." };
    saveCustomRanks([...ranks, rank]);
    return { success: true, rank };
}

function normalizePlayerName(value) { return String(value ?? "").trim().toLowerCase(); }

function normalizeRankState(state = {}) { return { players: typeof state.players === "object" && state.players ? state.players : {}, names: typeof state.names === "object" && state.names ? state.names : {} }; }

export function resolveRankId(value) {
    const key = normalizeRankKey(value);
    if (!key) return null;
    const defaultRankId = RANK_BY_ALIAS.get(key) ?? (RANK_BY_ID.has(key) ? key : null);
    if (defaultRankId) return defaultRankId;
    for (const rank of loadCustomRanks()) {
        for (const rankValue of [rank.id, rank.label, ...(rank.aliases ?? []), ...(rank.tags ?? [])]) {
            if (normalizeRankKey(rankValue) === key) return rank.id;
        }
    }
    return null;
}

export function getRankById(rankId) {
    const resolvedRankId = resolveRankId(rankId) ?? DEFAULT_RANK_ID;
    return getAllRanks().find((rank) => rank.id === resolvedRankId) ?? RANK_BY_ID.get(DEFAULT_RANK_ID);
}

export function loadRankState() {
    try {
        const raw = world.getDynamicProperty(RANK_STATE_KEY);
        return raw ? normalizeRankState(JSON.parse(raw)) : { players: {}, names: {} };
    } catch { return { players: {}, names: {} }; }
}

export function saveRankState(state) { world.setDynamicProperty(RANK_STATE_KEY, JSON.stringify(normalizeRankState(state))); }

export function getManualRankId(player) {
    if (!player) return null;
    const state = loadRankState();
    const idEntry = player.id ? state.players[player.id] : null;
    const nameEntry = state.names[normalizePlayerName(player.name)];
    const entry = idEntry ?? nameEntry;
    if (!entry) return null;
    return resolveRankId(typeof entry === "string" ? entry : entry.rankId);
}

function getTagRank(player) {
    let bestRank = null;
    try {
        for (const tag of player.getTags()) {
            const rankId = resolveRankId(tag);
            if (!rankId || rankId === DEFAULT_RANK_ID) continue;
            const rank = getRankById(rankId);
            if (!bestRank || rank.priority > bestRank.priority) bestRank = rank;
        }
    } catch {}
    return bestRank;
}

export function getPlayerRank(player) {
    if (!isValidEntity(player)) return getRankById(DEFAULT_RANK_ID);
    const manualRankId = getManualRankId(player);
    if (manualRankId) return getRankById(manualRankId);
    return getTagRank(player) ?? getRankById(DEFAULT_RANK_ID);
}

function clearRankTags(player) {
    try {
        for (const tag of player.getTags()) {
            if (tag.startsWith(RANK_TAG_PREFIX)) player.removeTag(tag);
        }
    } catch {}
}

export function applyRankTags(player) {
    if (!isValidEntity(player)) return getRankById(DEFAULT_RANK_ID);
    const rank = getPlayerRank(player);
    if (!isModuleEnabled("ranks")) return rank;
    
    const tag = `${RANK_TAG_PREFIX}${rank.id}`;
    clearRankTags(player);
    
    try {
        if (!player.hasTag(tag)) player.addTag(tag);
        if (rank.staff) {
            if (!player.hasTag(STAFF_ACCESS_TAG)) player.addTag(STAFF_ACCESS_TAG);
        }
        // Auto-remover tag 'player' se o rank atual não for o padrão
        // Isso garante que quando o player recebe uma tag de clã, top ou outro rank,
        // a tag 'player' seja removida automaticamente
        // Auto-remover tag 'player' se o rank atual não for o padrão OU se o jogador estiver em um clã OU tiver tag de Top
        const tags = player.getTags();
        const hasClan = tags.some(t => t.startsWith("clan_"));
        const hasTop = tags.some(t => t.startsWith("top:"));
        
        if (rank.id !== DEFAULT_RANK_ID || hasClan || hasTop) {
            if (player.hasTag("player")) player.removeTag("player");
            if (player.hasTag("rank_player")) player.removeTag("rank_player");
        } else {
            // Se o rank é o padrão, não tem clã e não é top, garante que a tag 'player' esteja presente
            // Mas só se o módulo ranks estiver ativo e não houver conflito
            if (!player.hasTag("player")) player.addTag("player");
        }
    } catch {}
    return rank;
}

export function setPlayerRank(player, rankId, updatedBy = "") {
    if (!player) return getRankById(DEFAULT_RANK_ID);
    const rank = getRankById(rankId);
    const state = loadRankState();
    const entry = { rankId: rank.id, playerName: player.name, updatedBy: String(updatedBy ?? ""), updatedAt: Date.now() };
    if (player.id) state.players[player.id] = entry;
    state.names[normalizePlayerName(player.name)] = entry;
    saveRankState(state);
    applyRankTags(player);
    return rank;
}

export function clearPlayerRank(player) {
    if (!player) return;
    const state = loadRankState();
    if (player.id) delete state.players[player.id];
    delete state.names[normalizePlayerName(player.name)];
    saveRankState(state);
    
    // LIMPEZA TOTAL DE TAGS (O que você pediu)
    try {
        const allPossibleTags = ["admin", "adm", "owner", "dono", "staff", "mod", "moderador", "dev", "developer", "helper", "suporte", "support", "builder", "rank_player", "rank_admin", "rank_owner", "rank_mod", "rank_staff_access", "rank_helper", "rank_staff", "rank_dev", "rank_builder"];
        for (const tag of player.getTags()) {
            if (tag.startsWith(RANK_TAG_PREFIX) || allPossibleTags.includes(tag.toLowerCase())) {
                player.removeTag(tag);
            }
        }
    } catch {}

    applyRankTags(player);
}

export function formatRankBadge(rankValue) {
    const rank = typeof rankValue === "object" && rankValue?.id ? rankValue : getRankById(rankValue);
    return `${rank.color}${COLOR}l${rank.label}${COLOR}r`;
}

export function formatRankTag(player, options = {}) {
    if (!isModuleEnabled("ranks")) return "";
    const rank = getPlayerRank(player);
    
    // Ajuste: Sempre incluir o rank no nametag para evitar que o player fique sem tag
    const topState = isModuleEnabled("top_players") ? (world.getDynamicProperty("labsdev:top_players_state") ? JSON.parse(world.getDynamicProperty("labsdev:top_players_state")) : null) : null;
    
    let topPrefix = "";
    if (topState) {
        if (player.hasTag("top:1")) topPrefix = `${topState["top:1"]?.color ?? "§6TOP 1"} §r`;
        else if (player.hasTag("top:2")) topPrefix = `${topState["top:2"]?.color ?? "§7TOP 2"} §r`;
        else if (player.hasTag("top:3")) topPrefix = `${topState["top:3"]?.color ?? "§cTOP 3"} §r`;
    }

    if (rank.id === DEFAULT_RANK_ID && options.includeDefault === false) {
        return topPrefix;
    }
    
    return topPrefix + formatRankBadge(rank);
}

export function formatRankedName(player, beforeRankPrefix = "", afterRankPrefix = "") {
    const rankTag = formatRankTag(player);
    const prefix = [
        String(beforeRankPrefix ?? "").trim(),
        rankTag,
        String(afterRankPrefix ?? "").trim(),
    ].filter((part) => part.length > 0).join(" ");

    const nameLine = `${COLOR}f${player.name}${COLOR}r`;
    return prefix ? `${prefix}\n${nameLine}` : nameLine;
}

export function updateRankDisplay(player) {
    if (!isValidEntity(player)) return;
    try {
        applyRankTags(player);
        player.nameTag = formatRankedName(player);
    } catch {}
}

function refreshRanks() {
    for (const player of getOnlinePlayers()) {
        applyRankTags(player);
        if (!isModuleEnabled("clan")) updateRankDisplay(player);
    }
}

function getCommandArg(value, index = 0) {
    if (Array.isArray(value)) return getCommandArg(value[index], 0);
    return (value && typeof value === "object" && "value" in value) ? value.value : (index === 0 ? value : undefined);
}

function findOnlinePlayer(name) {
    const target = String(name ?? "").trim().toLowerCase();
    return target ? (getOnlinePlayers().find((p) => p.name.toLowerCase() === target) ?? null) : null;
}

function sendRankList(player) {
    const ranks = getAllRanks().sort((l, r) => r.priority - l.priority || l.label.localeCompare(r.label));
    const lines = ranks.map((r) => `${COLOR}8- ${formatRankBadge(r)} ${COLOR}7id: ${COLOR}f${r.id} ${COLOR}7prio: ${COLOR}f${r.priority} ${r.custom ? `${COLOR}dcustom` : `${COLOR}8padrao`}`);
    player.sendMessage(`${COLOR}d${COLOR}lRanks disponiveis${COLOR}r ${COLOR}8(${ranks.length})`);
    for (let i = 0; i < lines.length; i += 8) player.sendMessage(lines.slice(i, i + 8).join("\n"));
}

function createRankFromCommand(player, args) {
    const label = String(getCommandArg(args, 0) ?? "").trim();
    const color = String(getCommandArg(args, 1) ?? "").trim();
    const priority = Number(getCommandArg(args, 2) ?? 30);
    const result = createCustomRank({ label, color, priority }, player.name);
    if (result.success) {
        player.sendMessage(`§aRank ${result.rank.label} criado com sucesso!`);
        refreshRanks();
    } else {
        player.sendMessage(`§cErro ao criar rank: ${result.message}`);
    }
    return result.success;
}

function setRankFromCommand(player, args) {
    const targetName = getCommandArg(args, 0);
    const rankValue = getCommandArg(args, 1);
    const rankId = resolveRankId(rankValue);
    if (!rankId) {
        player.sendMessage("§cRank nao encontrado.");
        return false;
    }
    const target = findOnlinePlayer(targetName);
    if (!target) {
        player.sendMessage("§cJogador offline.");
        return false;
    }
    setPlayerRank(target, rankId, player.name);
    player.sendMessage(`§aRank de ${target.name} atualizado.`);
    return true;
}

function clearRankFromCommand(player, args) {
    const target = findOnlinePlayer(getCommandArg(args, 0));
    if (!target) { player.sendMessage(`${COLOR}cJogador offline.`); return false; }
    clearPlayerRank(target);
    updateRankDisplay(target);
    player.sendMessage(`${COLOR}aRank de ${COLOR}f${target.name}${COLOR}a limpo.`);
    return true;
}

function registerRankCommand(registry, config, handler) {
    try {
        registry.registerCommand(config, (origin, args = []) => {
            if (!isModuleEnabled("ranks")) return { status: CustomCommandStatus.Failure, message: "Ranks desativado." };
            const player = getCommandSourceEntity(origin);
            if (!player || !isAdmin(player)) return { status: CustomCommandStatus.Failure, message: "Sem permissao." };
            system.run(() => { try { handler(player, args); } catch {} });
            return { status: CustomCommandStatus.Success };
        });
    } catch {}
}

world.afterEvents.worldLoad.subscribe(() => { system.runTimeout(refreshRanks, 20); });
world.afterEvents.playerSpawn.subscribe((data) => {
    if (!data.initialSpawn) return;
    system.runTimeout(() => { applyRankTags(data.player); if (!isModuleEnabled("clan")) updateRankDisplay(data.player); }, 5);
});

world.beforeEvents.chatSend.subscribe((data) => {
    if (!isModuleEnabled("ranks") || isModuleEnabled("clan")) return;

    const message = String(data.message ?? "");

    // Nunca intercepta comandos. O antigo listener liberava apenas "!",
    // mas cancelava comandos vanilla iniciados por "/" quando o módulo ranks
    // estava ativo sem o módulo clan, bloqueando comandos como /fill e /structure.
    if (message.startsWith("!") || message.startsWith("/")) return;

    data.cancel = true;
    system.run(() => {
        const prefix = formatRankTag(data.sender, { includeDefault: true });
        world.sendMessage(`${prefix ? `${prefix} ` : ""}${COLOR}f${data.sender.name} ${COLOR}7: ${message}`);
    });
});

system.runInterval(refreshRanks, 200);

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    if (!customCommandRegistry) return;
    const commandConfig = { permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false };

    registerRankCommand(customCommandRegistry, { ...commandConfig, name: "labsdev:rank", description: "Gerenciar ranks", mandatoryParameters: [{ name: "acao", type: CustomCommandParamType.String }], optionalParameters: [{ name: "v1", type: CustomCommandParamType.String }, { name: "v2", type: CustomCommandParamType.String }, { name: "v3", type: CustomCommandParamType.String }] }, (player, args) => {
        const action = String(getCommandArg(args, 0) ?? "").trim().toLowerCase();
        const rest = [getCommandArg(args, 1), getCommandArg(args, 2), getCommandArg(args, 3)];
        if (action === "create" || action === "criar") return createRankFromCommand(player, rest);
        if (action === "set" || action === "setar") return setRankFromCommand(player, rest);
        if (action === "clear" || action === "limpar") return clearRankFromCommand(player, rest);
        if (action === "list" || action === "lista") return sendRankList(player);
        player.sendMessage(`${COLOR}cUse: /labsdev:rank <create|set|clear|list>`);
    });

    for (const name of ["labsdev:rankcreate", "labsdev:createrank"]) {
        registerRankCommand(customCommandRegistry, { ...commandConfig, name, description: "Criar rank personalizado", mandatoryParameters: [{ name: "nome", type: CustomCommandParamType.String }], optionalParameters: [{ name: "cor", type: CustomCommandParamType.String }, { name: "prioridade", type: CustomCommandParamType.Integer }] }, createRankFromCommand);
    }
    for (const name of ["labsdev:rankset", "labsdev:setrank"]) {
        registerRankCommand(customCommandRegistry, { ...commandConfig, name, description: "Setar rank de jogador online", mandatoryParameters: [{ name: "player", type: CustomCommandParamType.String }, { name: "rank", type: CustomCommandParamType.String }] }, setRankFromCommand);
    }
    for (const name of ["labsdev:rankclear", "labsdev:clearrank"]) {
        registerRankCommand(customCommandRegistry, { ...commandConfig, name, description: "Limpar rank manual", mandatoryParameters: [{ name: "player", type: CustomCommandParamType.String }] }, clearRankFromCommand);
    }
    for (const name of ["labsdev:ranklist", "labsdev:ranks"]) {
        registerRankCommand(customCommandRegistry, { ...commandConfig, name, description: "Listar ranks disponiveis" }, (player) => { sendRankList(player); return true; });
    }
});
