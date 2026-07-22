import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const ADMIN_STATE_KEY = "labsdev:admin_state";
const ADMIN_TAGS = [
    "admin", "adm", "owner", "dono", "staff", "mod", "moderador", "op", "dev", "developer", "helper", "suporte", "support", "builder",
    "rank_owner", "rank_dev", "rank_admin", "rank_mod", "rank_staff_access", "rank_support", "rank_helper", "rank_staff", "rank_builder"
];
const BAN_NAME_PREFIX = "name:";
const BAN_PLAYER_PREFIX = "player:";

export const MODULES = [
    { id: "clearlag", label: "ClearLag" }, { id: "combatlog", label: "CombatLog" }, { id: "safezone", label: "SafeZone" },
    { id: "antitrouxa", label: "AntiTrouxa" }, { id: "cpslimiter", label: "CPS Limiter" }, { id: "ranks", label: "Ranks" },
    { id: "mobstacker", label: "Mob Stacker" }, { id: "spawn", label: "Spawn" }, { id: "homes", label: "Homes" },
    { id: "rtp", label: "RTP" }, { id: "tpa", label: "TPA" }, { id: "back", label: "Back" },
    { id: "warps", label: "Warps" }, { id: "help", label: "Help" }, { id: "menu", label: "Menu" },
    { id: "clan", label: "Clan" }, { id: "cps_config", label: "CPS CONFIG" }, { id: "top_players", label: "Top Players" },
    { id: "warden", label: "Warden Shop" }, { id: "telagem", label: "Telagem" },
];

const MODULE_IDS = new Set(MODULES.map((m) => m.id));

export const DEFAULT_SETTINGS = Object.freeze({
    combatlog: { seconds: 20, punishOnLogout: true, dropItems: true, killOnJoin: true, ignoreCreative: true, disableInSpawn: true },
    clearlag: { intervalSeconds: 180, removeItems: true, removeMobs: true, removeXpOrbs: true, announceStart: true },
    cps_config: { strange: 14, suspect: 17, max: 20, avgSuspect: 15, weaknessSeconds: 10, weaknessLevel: 1 },
    mobstacker: { radius: 6, maxStack: 64, scanIntervalSeconds: 5, showNameTags: true, stackBabiesSeparately: true },
    spawn: { x: 213.71, y: 67.5, z: 946.33, radius: 100, dimension: "minecraft:overworld", allowStaffBuild: true, protectPvp: true, removeEntities: true },
    safezones: { zones: [] },
});

function cloneDefaultSettings() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }

function normalizeSettings(settings = {}) {
    const defaults = cloneDefaultSettings();
    const next = {};
    for (const [section, defaultValues] of Object.entries(defaults)) {
        next[section] = { ...defaultValues, ...(typeof settings[section] === "object" && settings[section] ? settings[section] : {}) };
    }
    return next;
}

function createDefaultState() { return { modules: Object.fromEntries(MODULES.map((m) => [m.id, true])), settings: cloneDefaultSettings(), bans: {} }; }

function normalizeBanValue(v) { return String(v ?? "").trim().toLowerCase(); }

function getBanTargetParts(target) {
    const name = typeof target === "string" ? target : (target?.playerName ?? target?.name ?? "");
    const id = typeof target === "string" ? "" : (target?.playerId ?? target?.id ?? "");
    return { playerName: String(name).trim(), playerId: String(id).trim(), nameKey: normalizeBanValue(name), playerIdKey: normalizeBanValue(id) };
}

function getEntryPlayerName(e, k) { return String(e?.playerName ?? (k.startsWith(BAN_NAME_PREFIX) ? k.slice(BAN_NAME_PREFIX.length) : k)).trim(); }

function getEntryPlayerId(e) { return String(e?.playerId ?? "").trim(); }

function getEntryAliases(e) { return Array.isArray(e?.aliases) ? e.aliases.map(a => String(a).trim()).filter(a => a) : []; }

function entryMatchesTarget(entry, target, fallbackKey = "") {
    const t = getBanTargetParts(target);
    const eName = normalizeBanValue(getEntryPlayerName(entry, fallbackKey));
    const eId = normalizeBanValue(entry?.playerId ?? "");
    const aliases = getEntryAliases(entry).map(normalizeBanValue);
    if (t.playerIdKey && eId === t.playerIdKey) return true;
    if (!t.nameKey) return false;
    return eName === t.nameKey || aliases.includes(t.nameKey);
}

function dedupeBanEntries(entries) {
    const seen = new Set();
    const unique = [];
    for (const [k, e] of entries) {
        const name = getEntryPlayerName(e, k);
        const id = getEntryPlayerId(e);
        const key = `${normalizeBanValue(id)}|${normalizeBanValue(name)}|${e?.createdAt || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push({ ...e, playerName: name, playerId: id, aliases: getEntryAliases(e), key: k });
    }
    return unique;
}

export async function showForm(form, player, timeoutTicks = 100) {
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeoutTicks) {
        const isValid = player && (typeof player.isValid === "function" ? player.isValid() : player.isValid !== false);
        if (!isValid) break;
        try {
            const response = await form.show(player);
            if (!response.canceled || response.cancelationReason !== "UserBusy") return response;
        } catch (e) {}
        await new Promise(resolve => system.run(resolve));
    }
    return { canceled: true, cancelationReason: "UserBusy" };
}

export function isAdmin(player) { try { return !!player && ADMIN_TAGS.some((tag) => player.hasTag(tag)); } catch { return false; } }

export function loadAdminState() {
    try {
        const raw = world.getDynamicProperty(ADMIN_STATE_KEY);
        if (!raw) return createDefaultState();
        const p = JSON.parse(raw);
        const pMod = p.modules || {};
        return { modules: Object.fromEntries(MODULES.map(m => [m.id, pMod[m.id] !== false])), settings: normalizeSettings(p.settings), bans: p.bans || {} };
    } catch { return createDefaultState(); }
}

export function saveAdminState(state) {
    world.setDynamicProperty(ADMIN_STATE_KEY, JSON.stringify({ ...state, settings: normalizeSettings(state?.settings) }));
}

export function isModuleEnabled(moduleId) { return MODULE_IDS.has(moduleId) && loadAdminState().modules[moduleId] !== false; }

export function setModuleEnabled(moduleId, enabled) {
    const state = loadAdminState();
    state.modules[moduleId] = !!enabled;
    saveAdminState(state);
}

export function getAdminSetting(section) { return loadAdminState().settings[section] ?? cloneDefaultSettings()[section] ?? {}; }

export function setAdminSetting(section, values) {
    const state = loadAdminState();
    state.settings[section] = { ...(state.settings[section] ?? {}), ...(typeof values === "object" && values ? values : {}) };
    saveAdminState(state);
}

export function getAllBanEntries() {
    const state = loadAdminState();
    return dedupeBanEntries(Object.entries(state.bans)).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export function getBanEntry(target) {
    const state = loadAdminState();
    const t = getBanTargetParts(target);
    const keys = [t.playerIdKey ? `${BAN_PLAYER_PREFIX}${t.playerIdKey}` : "", t.nameKey ? `${BAN_NAME_PREFIX}${t.nameKey}` : "", t.nameKey].filter(k => k);
    for (const k of keys) { if (state.bans[k]) return { ...state.bans[k], playerName: getEntryPlayerName(state.bans[k], k), playerId: getEntryPlayerId(state.bans[k]), aliases: getEntryAliases(state.bans[k]), key: k }; }
    for (const [k, e] of Object.entries(state.bans)) { if (entryMatchesTarget(e, target, k)) return { ...e, playerName: getEntryPlayerName(e, k), playerId: getEntryPlayerId(e), aliases: getEntryAliases(e), key: k }; }
    return null;
}

export function clearPlayerBan(target) {
    const state = loadAdminState();
    state.bans = Object.fromEntries(Object.entries(state.bans).filter(([k, e]) => !entryMatchesTarget(e, target, k)));
    saveAdminState(state);
}

export function setPlayerBan(target, entry) {
    if (!entry) return clearPlayerBan(target);
    const state = loadAdminState();
    const existing = getBanEntry(target);
    const t = getBanTargetParts(target);
    const name = t.playerName || entry.playerName || existing?.playerName || "Desconhecido";
    const id = t.playerId || entry.playerId || existing?.playerId || "";
    const aliases = new Set([...getEntryAliases(existing), ...getEntryAliases(entry), name]);
    state.bans = Object.fromEntries(Object.entries(state.bans).filter(([k, e]) => !entryMatchesTarget(e, target, k)));
    const key = id ? `${BAN_PLAYER_PREFIX}${normalizeBanValue(id)}` : `${BAN_NAME_PREFIX}${normalizeBanValue(name)}`;
    state.bans[key] = { ...existing, ...entry, playerName: name, playerId: id || undefined, aliases: Array.from(aliases), createdAt: Date.now() };
    saveAdminState(state);
}

export function getInventoryLines(player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return ["Inventário indisponível."];
    const lines = [];
    for (let i = 0; i < inv.size; i++) { const item = inv.getItem(i); if (item) lines.push(`Slot ${i}: ${item.typeId} x${item.amount}`); }
    return lines.length > 0 ? lines : ["Inventário vazio."];
}

export async function openInventoryViewer(admin, target) {
    const form = new ActionFormData().title(`§bInventário: ${target.name}`).body(`§b${getInventoryLines(target).join("\n")}`).button("§bFechar");
    await showForm(form, admin);
}
