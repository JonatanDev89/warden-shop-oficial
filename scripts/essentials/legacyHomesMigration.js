import {
    system,
    world,
} from "@minecraft/server";
import { getOnlinePlayers, isValidEntity } from "../core/scriptCompat.js";


/**
 * MIGRATION HOMES AUTOMÁTICO - ESSENTIALS LABS
 * Este script automatiza a migração do sistema antigo (homeDB) para o novo.
 * Não altera o arquivo principal de homes do Labs.
 */

const LEGACY_HOME_OBJECTIVE = "homeDB";
const LEGACY_DB_SPLIT = "\n_`Split`_\n";
const LABS_HOME_KEY = "player_homes";
const MIGRATION_KEY = "labsdev:legacy_homes_migrated";
const HOME_NAME_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

function color(code) {
    return `\u00a7${code}`;
}

// 1. Registro da propriedade de controle (para saber quem já migrou)
system.beforeEvents.startup.subscribe(({ propertyRegistry }) => {
    if (propertyRegistry) {
        try {
            propertyRegistry.registerEntityTypeDynamicProperties({
                identifier: "minecraft:player",
                properties: [{ id: MIGRATION_KEY, type: "string" }],
            });
        } catch (error) {
            console.warn("[MigrationAuto] Erro ao registrar prop:", error);
        }
    }
});

// 2. Gatilho Automático: Ativado quando o jogador entra no servidor
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    // Só roda na primeira vez que o player nasce (ao entrar)
    if (!initialSpawn || !isValidEntity(player)) return;

    // Aguarda 2 segundos (40 ticks) para garantir que o player carregou totalmente
    system.runTimeout(() => {
        autoMigratePlayer(player);
    }, 40);
});

function autoMigratePlayer(player) {
    // Se já foi migrado antes, para por aqui
    if (!isValidEntity(player) || player.getDynamicProperty(MIGRATION_KEY)) return; // Adicionado isValidEntity para evitar erro de entidade inválida

    const legacyEntries = getLegacyHomeEntries();
    const legacyHomes = getLegacyHomesForPlayer(player.name, legacyEntries);
    
    // Se o player não tem homes no sistema antigo, marca como migrado e encerra
    if (legacyHomes.length === 0) {
        markPlayerMigrated(player, 0);
        return;
    }

    const currentHomes = getLabsHomes(player);
    let importedCount = 0;

    for (const legacyHome of legacyHomes) {
        const normalizedHome = normalizeHomeData(legacyHome.data);
        if (!normalizedHome) continue;

        // Verifica se a home já existe no sistema novo (evita duplicatas)
        if (findMatchingHome(currentHomes, normalizedHome)) continue;

        const targetName = getAvailableHomeName(currentHomes, legacyHome.name);
        currentHomes[targetName] = normalizedHome;
        importedCount++;
    }

    // Se houver homes para importar, salva no Essentials Labs
    if (importedCount > 0) {
        player.setDynamicProperty(LABS_HOME_KEY, JSON.stringify(currentHomes));
        player.sendMessage(`${color("a")}Suas homes antigas foram importadas automaticamente para o novo sistema!`);
        player.sendMessage(`${color("a")}Total: ${color("f")}${importedCount} homes.`);
    }

    // Marca o player como migrado permanentemente
    markPlayerMigrated(player, importedCount);
}

// --- FUNÇÕES DE SUPORTE (Extraídas do seu script original) ---

function getLegacyHomeEntries() {
    let objective;
    try { objective = world.scoreboard.getObjective(LEGACY_HOME_OBJECTIVE); } catch { return []; }
    if (!objective) return [];

    const entries = [];
    for (const participant of objective.getParticipants()) {
        const displayName = String(participant?.displayName ?? "");
        const splitIndex = displayName.indexOf(LEGACY_DB_SPLIT);
        if (splitIndex <= 0) continue;
        const key = displayName.slice(0, splitIndex);
        const rawData = displayName.slice(splitIndex + LEGACY_DB_SPLIT.length);
        try { entries.push({ key, data: JSON.parse(rawData) }); } catch { entries.push({ key, data: null }); }
    }
    return entries;
}

function getLegacyHomesForPlayer(playerName, legacyEntries) {
    const prefix = `${playerName}-`;
    const homes = [];
    for (const entry of legacyEntries) {
        if (entry.key.startsWith(prefix)) {
            const name = entry.key.slice(prefix.length).trim();
            if (name) homes.push({ name, data: entry.data });
        }
    }
    return homes;
}

function getLabsHomes(player) {
    const data = player.getDynamicProperty(LABS_HOME_KEY);
    if (!data || typeof data !== "string") return {};
    try {
        const homes = JSON.parse(data);
        return homes && typeof homes === "object" && !Array.isArray(homes) ? homes : {};
    } catch { return {}; }
}

function normalizeHomeData(home) {
    const x = Number(home?.x);
    const y = Number(home?.y);
    const z = Number(home?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z, dimension: String(home?.dimension || "minecraft:overworld") };
}

function findMatchingHome(homes, targetHome) {
    return Object.values(homes).some((home) => 
        Math.abs(home.x - targetHome.x) < 0.1 && 
        Math.abs(home.y - targetHome.y) < 0.1 && 
        Math.abs(home.z - targetHome.z) < 0.1 &&
        home.dimension.replace("minecraft:", "") === targetHome.dimension.replace("minecraft:", "")
    );
}

function getAvailableHomeName(homes, legacyName) {
    let name = legacyName.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 24);
    if (!homes[name]) return name;
    for (let i = 2; i < 100; i++) {
        let newName = `${name.slice(0, 20)}_${i}`;
        if (!homes[newName]) return newName;
    }
    return `home_${Math.floor(Math.random() * 1000)}`;
}

function markPlayerMigrated(player, imported) {
    player.setDynamicProperty(MIGRATION_KEY, JSON.stringify({ imported, date: Date.now() }));
}
