import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { isAdmin, isModuleEnabled, getAdminSetting, setAdminSetting, showForm, setModuleEnabled } from "./moduleState.js";

const playerCache = new Map();
const records = new Map();
const lastAlertTime = new Map();
const inspectionMap = new Map();

let needsSave = false;
let cachedSettings = null;
let currentMinute = "00:00";
let lastResetDate = null;

const STORAGE_KEYS = {
    RECORDS: "cps_config_records_v4",
    SETTINGS: "cps_config",
    RESET_DATE: "cps_config_last_reset"
};

function getSettings() {
    if (!cachedSettings) {
        try {
            const s = getAdminSetting(STORAGE_KEYS.SETTINGS);
            cachedSettings = {
                strange: Number(s.strange ?? 14),
                suspect: Number(s.suspect ?? 17),
                max: Number(s.max ?? 20),
                avgSuspect: Number(s.avgSuspect ?? 15),
                weaknessSeconds: Number(s.weaknessSeconds ?? 10),
                weaknessLevel: Number(s.weaknessLevel ?? 1)
            };
        } catch {
            cachedSettings = { strange: 14, suspect: 17, max: 20, avgSuspect: 15, weaknessSeconds: 10, weaknessLevel: 1 };
        }
    }
    return cachedSettings;
}

function save() {
    try {
        world.setDynamicProperty(STORAGE_KEYS.RECORDS, JSON.stringify([...records.values()]));
        if (lastResetDate) world.setDynamicProperty(STORAGE_KEYS.RESET_DATE, lastResetDate);
    } catch {}
}

system.runInterval(() => {
    if (needsSave) { save(); needsSave = false; }
}, 1200);

system.runInterval(() => {
    const d = new Date();
    currentMinute = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (lastResetDate && lastResetDate !== dateKey) {
        records.clear();
        lastResetDate = dateKey;
        needsSave = true;
    }
}, 1200);

function load() {
    try {
        const raw = world.getDynamicProperty(STORAGE_KEYS.RECORDS);
        if (raw) {
            const parsed = JSON.parse(raw);
            records.clear();
            parsed.forEach(r => { if (r?.id) records.set(r.id, r); });
        }
        lastResetDate = world.getDynamicProperty(STORAGE_KEYS.RESET_DATE) ?? null;
        if (!lastResetDate) {
            const d = new Date();
            lastResetDate = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }
    } catch {}
}

function getRecord(player) {
    if (!records.has(player.id)) {
        records.set(player.id, { id: player.id, name: player.name, maxCps: 0, maxAvg: 0, maxTime: "--:--", logs: [] });
        needsSave = true;
    }
    return records.get(player.id);
}

function alertStaff(message, playerId) {
    const now = Date.now();
    if (now - (lastAlertTime.get(playerId) || 0) < 10000) return;
    const msg = `§l§uCPS CONFIG §f» ${message}`;
    for (const p of world.getPlayers()) { if (isAdmin(p)) p.sendMessage(msg); }
    lastAlertTime.set(playerId, now);
}

world.afterEvents.entityHitEntity.subscribe((ev) => {
    if (!isModuleEnabled(STORAGE_KEYS.SETTINGS)) return;
    const player = ev.damagingEntity;
    if (!player || player.typeId !== "minecraft:player") return;
    const tick = system.currentTick;
    if (!playerCache.has(player.id)) playerCache.set(player.id, { hits: [], samples: [], lastAvg: 0, lastCPS: 0, consistency: 0 });
    const cache = playerCache.get(player.id);
    if (cache.hits.length > 0 && cache.hits[cache.hits.length - 1] === tick) return;
    cache.hits.push(tick);
    while (cache.hits.length > 0 && cache.hits[0] <= tick - 20) cache.hits.shift();
    const cps = cache.hits.length;
    cache.lastCPS = cps;
    const record = getRecord(player);
    if (cps > record.maxCps) { record.maxCps = cps; record.maxTime = currentMinute; needsSave = true; }
    if (isAdmin(player)) return;
    const settings = getSettings();
    if (cps >= settings.strange) {
        const minute = currentMinute;
        const lastLog = record.logs[record.logs.length - 1];
        let type = cps > settings.max ? "anormal" : (cps >= settings.suspect ? "suspect" : "strange");
        if (type !== "strange") {
            if (!lastLog || lastLog.minute !== minute || (type === "anormal" && lastLog.type !== "anormal")) {
                record.logs.push({ minute, type, cps });
                if (record.logs.length > 10) record.logs.shift();
                if (type === "anormal") {
                    alertStaff(`§c${player.name} §fatingiu §e${cps} CPS §7(Anormal)`, player.id);
                    player.addEffect("weakness", settings.weaknessSeconds * 20, { amplifier: settings.weaknessLevel, showParticles: true });
                }
                needsSave = true;
            }
        }
    }
});

const onlinePlayersCache = new Map();
system.runInterval(() => {
    onlinePlayersCache.clear();
    for (const p of world.getPlayers()) onlinePlayersCache.set(p.id, p);

    if (!isModuleEnabled(STORAGE_KEYS.SETTINGS)) return;
    const settings = getSettings();
    const currentTick = system.currentTick;

    for (const p of onlinePlayersCache.values()) {
        const cache = playerCache.get(p.id);
        if (!cache) continue;
        
        cache.samples.push(cache.lastCPS);
        if (cache.samples.length > 5) cache.samples.shift();
        
        const avg = parseFloat((cache.samples.reduce((a, b) => a + b, 0) / cache.samples.length).toFixed(1));
        if (cache.samples.length === 5) cache.consistency = Math.max(...cache.samples) - Math.min(...cache.samples);
        cache.lastAvg = avg;

        if (records.has(p.id)) {
            const r = records.get(p.id);
            if (avg > (r.maxAvg || 0)) { r.maxAvg = avg; needsSave = true; }
        }

        if (!isAdmin(p) && avg >= settings.avgSuspect && currentTick % 100 === 0) {
            alertStaff(`§6${p.name} §festá mantendo média de §e${avg} CPS §7(Autoclick?)`, p.id);
        }

        if (cache.hits.length > 0 && cache.hits[cache.hits.length - 1] < currentTick - 40) {
            cache.hits = [];
            cache.lastCPS = 0;
        }
    }

    if (inspectionMap.size > 0) {
        for (const [staffId, targetId] of inspectionMap.entries()) {
            const staff = onlinePlayersCache.get(staffId);
            const target = onlinePlayersCache.get(targetId);
            if (!staff || !target) { inspectionMap.delete(staffId); continue; }
            
            const cache = playerCache.get(targetId);
            const cons = cache?.consistency ?? 5;
            const consText = cons < 1 ? "§c§lPERFEITA" : (cons < 2 ? "§6Alta" : "§aNormal");
            staff.onScreenDisplay.setActionBar(`§uInspecionando: §f${target.name}\n§uCPS: §a${cache?.lastCPS ?? 0} §8| §uAVG: §f${cache?.lastAvg ?? 0} §8| §uConsistência: ${consText}`);
        }
    }
}, 20);

world.afterEvents.playerLeave.subscribe((ev) => { playerCache.delete(ev.playerId); lastAlertTime.delete(ev.playerId); inspectionMap.delete(ev.playerId); });

export function openAuroraMainPanel(player) {
    const form = new ActionFormData().title("§l§uCPS CONFIG").button("§uRanking Diário\n§8Melhores do dia").button("§uConfigurações\n§8Limites e efeitos");
    const players = world.getAllPlayers();
    const ids = [];
    for (const p of players) {
        const cache = playerCache.get(p.id);
        form.button(`§u${p.name}\n§fCPS: §a${cache?.lastCPS ?? 0} §8| §fAVG: §u${cache?.lastAvg ?? 0}`);
        ids.push(p.id);
    }
    showForm(form, player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) return openRanking(player);
        if (res.selection === 1) return openConfig(player);
        const id = ids[res.selection - 2];
        if (id) openDetails(player, id);
    });
}

function openConfig(player) {
    const s = getSettings();
    const form = new ModalFormData().title("§uAjustes do Sistema").toggle("Módulo Ativo", isModuleEnabled(STORAGE_KEYS.SETTINGS)).textField("Limite Estranho", "14", String(s.strange)).textField("Limite Suspeito", "17", String(s.suspect)).textField("Limite Máximo", "20", String(s.max)).textField("Média Suspeita", "15", String(s.avgSuspect)).textField("Segundos Fraqueza", "10", String(s.weaknessSeconds));
    showForm(form, player).then(res => {
        if (res.canceled) return openAuroraMainPanel(player);
        const [enabled, strange, suspect, max, avg, weakness] = res.formValues;
        setAdminSetting(STORAGE_KEYS.SETTINGS, { strange: Number(strange), suspect: Number(suspect), max: Number(max), avgSuspect: Number(avg), weaknessSeconds: Number(weakness) });
        setModuleEnabled(STORAGE_KEYS.SETTINGS, enabled === true);
        cachedSettings = null;
        player.sendMessage("§a[CPS CONFIG] Configurações salvas!");
        openAuroraMainPanel(player);
    });
}

function openRanking(player) {
    const rank = [...records.values()].sort((a,b) => b.maxCps - a.maxCps).slice(0,10);
    let b = "§u§lRANKING HOJE\n\n";
    if (rank.length === 0) b += "§7Nenhum registro encontrado hoje.";
    rank.forEach((r,i) => b += `§u${i+1}. §f${r.name} §8» §e${r.maxCps} CPS §7(${r.maxTime})\n`);
    const form = new MessageFormData().title("§uRanking").body(b).button1("§l§uVOLTAR").button2("§l§uFECHAR");
    showForm(form, player).then(r => { if (r.selection === 1) openAuroraMainPanel(player); });
}

function openDetails(viewer, id) {
    const data = records.get(id);
    if (!data) return;
    const cache = playerCache.get(id);
    const cons = cache?.consistency ?? 5;
    const consText = cons < 1 ? "§c§lPERFEITA (Suspeita)" : (cons < 2 ? "§6Alta" : "§aNormal");
    let b = `§u§lPLAYER: §f${data.name}\n\n§u• §fCPS MÁX: §e${data.maxCps} §7(${data.maxTime})\n§u• §fMÉDIA MÁX: §e${data.maxAvg || 0}\n§u• §fCONSISTÊNCIA: ${consText}\n\n§u§lLOGS RECENTES:\n`;
    data.logs.slice(-5).reverse().forEach(l => b += `§7[${l.minute}] §f${l.cps} CPS (${l.type})\n`);
    const isInspecting = inspectionMap.get(viewer.id) === id;
    const form = new ActionFormData().title("§uDetalhes do Player").body(b).button(isInspecting ? "§c§lPARAR INSPEÇÃO" : "§u§lINSPECIONAR (Actionbar)").button("§l§uRESETAR DADOS").button("§l§uVOLTAR");
    showForm(form, viewer).then(res => {
        if (res.canceled || res.selection === 2) return openAuroraMainPanel(viewer);
        if (res.selection === 0) {
            if (isInspecting) inspectionMap.delete(viewer.id);
            else inspectionMap.set(viewer.id, id);
            openDetails(viewer, id);
        } else if (res.selection === 1) {
            records.delete(id); save();
            viewer.sendMessage(`§aDados de ${data.name} resetados.`);
            openAuroraMainPanel(viewer);
        }
    });
}

system.runTimeout(() => { load(); }, 40);
