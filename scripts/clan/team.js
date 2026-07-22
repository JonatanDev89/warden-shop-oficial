import { world, system } from "@minecraft/server";
import { applyRankTags, formatRankedName } from "../core/ranks.js";
import { getOnlinePlayers, isValidEntity } from "../core/scriptCompat.js";

const DEFAULT_MAX_MEMBERS = 15;
const MAX_LOGS = 40;
const CLAN_TEAMS_KEY = "clan:teams";
const CLAN_PLAYERS_KEY = "clan:players";
const LEGACY_TEAMS_KEY = "team:teams";
const LEGACY_PLAYERS_KEY = "team:players";
const MAX_CLAN_NAME_LENGTH = 16;
const MAX_CLAN_TAG_LENGTH = 7;
const DEFAULT_COLORS = {
    name: "§f",
    tag: "§7",
};

// ── Fragmentação de Dados (Persistência Robusta) ──────────────────────────
const MAX_CHUNK_SIZE = 8000; // Limite seguro para cada propriedade

function saveChunkedData(key, data) {
    const json = JSON.stringify(data);
    const chunks = [];
    
    for (let i = 0; i < json.length; i += MAX_CHUNK_SIZE) {
        chunks.push(json.slice(i, i + MAX_CHUNK_SIZE));
    }
    
    // Salva a quantidade de chunks
    world.setDynamicProperty(`${key}:count`, chunks.length);
    
    // Salva cada chunk individualmente
    chunks.forEach((chunk, index) => {
        world.setDynamicProperty(`${key}:chunk:${index}`, chunk);
    });
    
    // Limpa chunks antigos se houver
    const oldInfo = world.getDynamicProperty(`${key}:count`);
    if (oldInfo > chunks.length) {
        for (let i = chunks.length; i < oldInfo; i++) {
            world.setDynamicProperty(`${key}:chunk:${i}`, undefined);
        }
    }
}

function loadChunkedData(key) {
    const count = world.getDynamicProperty(`${key}:count`);
    if (count === undefined || count === null) return null;
    
    let fullJson = "";
    for (let i = 0; i < count; i++) {
        const chunk = world.getDynamicProperty(`${key}:chunk:${i}`);
        if (chunk) fullJson += chunk;
    }
    
    try {
        return fullJson ? JSON.parse(fullJson) : null;
    } catch (e) {
        console.warn(`[Teams] Erro ao carregar dados fragmentados (${key}):`, e);
        return null;
    }
}

/**
 * Remove apenas a formatação visual para contagem de caracteres e validação.
 */
function stripFormatting(value) {
    return String(value ?? "").replace(/§./g, "").replace(/&[0-9a-fklmnor]/gi, "");
}

/**
 * Limpa o nome do clã mantendo a formatação se desejado, 
 * mas para o Labs vamos manter a limpeza no nome para busca, 
 * e permitir formatação na TAG.
 */
function cleanClanName(value) {
    return stripFormatting(value).trim().replace(/\s+/g, " ");
}

/**
 * A TAG agora permite formatação, então o "clean" apenas remove espaços e coloca em UPPERCASE 
 * o conteúdo de texto, mas preserva os códigos de cor para armazenamento.
 */
function cleanClanTag(value) {
    // Para a TAG, vamos permitir que o usuário envie cores.
    // O stripFormatting é usado apenas para validar o tamanho real do texto.
    return String(value ?? "").trim().replace(/\s+/g, "");
}

function isValidClanName(value) {
    const plain = stripFormatting(value);
    return plain.length > 0 && plain.length <= MAX_CLAN_NAME_LENGTH && /^[A-Za-z0-9 ]+$/.test(plain);
}

function isValidClanTag(value) {
    const plain = stripFormatting(value);
    return plain.length > 0 && plain.length <= MAX_CLAN_TAG_LENGTH && /^[A-Za-z0-9]+$/i.test(plain);
}

function normalizeLookup(value) {
    return stripFormatting(value).trim().toLowerCase();
}

/**
 * Normaliza a TAG garantindo que ela tenha formatação se fornecida, 
 * ou use a cor padrão se for texto puro.
 */
function normalizeClanTag(value, fallback = "CLAN") {
    if (isValidClanTag(value)) {
        // Se tem códigos de formatação, preserva-os; senão converte para maiúsculo
        const hasFormatting = String(value).includes("§") || String(value).includes("&");
        return hasFormatting ? value : value.toUpperCase();
    }

    const plainFallback = stripFormatting(fallback)
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, MAX_CLAN_TAG_LENGTH);

    return plainFallback || "CLAN";
}

/**
 * Agora aceita múltiplos códigos (ex: §e§l) ou mantém como está se já for rico.
 */
function normalizeColorCode(value, fallback) {
    if (!value) return fallback;
    const raw = String(value).trim().replace(/&/g, "§");
    
    // Se contém §, assumimos que é uma string formatada
    if (raw.includes("§")) return raw;

    // Caso contrário, tenta o comportamento antigo de código único
    if (raw.length === 1 && /^[0-9a-fklmnor]$/i.test(raw)) {
        return `§${raw.toLowerCase()}`;
    }

    return fallback;
}

function normalizeTeamColors(colors = {}) {
    const source = typeof colors === "object" && colors ? colors : {};

    return {
        name: normalizeColorCode(source.name ?? source.nameColor, DEFAULT_COLORS.name),
        tag: normalizeColorCode(source.tag ?? source.tagColor, DEFAULT_COLORS.tag),
    };
}

/**
 * Formata a TAG para exibição. Se a TAG já tiver cores internas (cor por letra), 
 * ela não aplica a cor global da TAG para não sobrescrever.
 */
function formatClanTag(team) {
    if (!team) return "";

    const colors = normalizeTeamColors(team.colors);
    const tag = team.tag ?? "CLAN";
    
    // Se a tag já contém códigos de cor próprios, usamos ela pura dentro dos colchetes
    const hasInternalColors = tag.includes("§");
    const displayTag = hasInternalColors ? tag : `${colors.tag}${tag.toUpperCase()}`;
    
    return `§r§8[${displayTag}§r§8]§r`;
}

export class Teams {
    constructor() {
        this.teams = new Map();
        this.playersTeam = new Map();
        this.isDirty = false;

        this.loadTeams();
        this.runConsistencyCheck();
    }

    loadTeams() {
        try {
            // Tenta carregar dados fragmentados primeiro, senão tenta o legado
            let teams = loadChunkedData(CLAN_TEAMS_KEY);
            
            if (!teams) {
                const legacy = world.getDynamicProperty(CLAN_TEAMS_KEY) ?? world.getDynamicProperty(LEGACY_TEAMS_KEY);
                if (typeof legacy === "string" && legacy.length > 0) {
                    teams = JSON.parse(legacy);
                }
            }

            if (Array.isArray(teams)) {
                for (const teamData of teams) {
                    const teamName = cleanClanName(teamData.name);
                    if (!teamName) continue;

                    this.teams.set(teamName, {
                        name: teamName,
                        tag: teamData.tag ?? teamName.slice(0, MAX_CLAN_TAG_LENGTH).toUpperCase(),
                        members: new Map(teamData.members ?? []),
                        leader: teamData.leader ?? null,
                        subLeaders: new Set(teamData.subLeaders ?? []),
                        settings: {
                            maxMembers: Number(teamData.settings?.maxMembers ?? DEFAULT_MAX_MEMBERS),
                            hideRoleTag: teamData.settings?.hideRoleTag === true,
                        },
                        colors: normalizeTeamColors(teamData.colors),
                        home: teamData.home ?? null,
                        logs: Array.isArray(teamData.logs) ? teamData.logs : [],
                        date: teamData.date ?? Date.now(),
                    });
                }
            }

            let playerTeams = loadChunkedData(CLAN_PLAYERS_KEY);
            if (!playerTeams) {
                const legacy = world.getDynamicProperty(CLAN_PLAYERS_KEY) ?? world.getDynamicProperty(LEGACY_PLAYERS_KEY);
                if (typeof legacy === "string" && legacy.length > 0) {
                    playerTeams = JSON.parse(legacy);
                }
            }

            if (Array.isArray(playerTeams)) {
                for (const [playerId, teamName] of playerTeams) {
                    this.playersTeam.set(playerId, teamName);
                }
            }

        } catch (e) {
            console.warn("§c[Teams] Erro ao carregar dados:", e);
        }
    }

    markDirty() {
        this.isDirty = true;
    }

        saveTeams() {
        if (!this.isDirty) return;

        try {
            const teamsArray = [];

            for (const [, team] of this.teams) {
                teamsArray.push({
                    name: team.name,
                    tag: team.tag,
                    members: Array.from(team.members.entries()),
                    leader: team.leader,
                    subLeaders: Array.from(team.subLeaders ?? []),
                    settings: team.settings ?? { maxMembers: DEFAULT_MAX_MEMBERS },
                    colors: team.colors,
                    home: team.home ?? null,
                    logs: Array.isArray(team.logs) ? team.logs.slice(-MAX_LOGS) : [],
                    date: team.date,
                });
            }

            // Salva usando fragmentação para evitar limites
            saveChunkedData(CLAN_TEAMS_KEY, teamsArray);
            saveChunkedData(CLAN_PLAYERS_KEY, Array.from(this.playersTeam.entries()));

            // Limpa propriedades legadas para economizar espaço
            world.setDynamicProperty(CLAN_TEAMS_KEY, undefined);
            world.setDynamicProperty(LEGACY_TEAMS_KEY, undefined);
            world.setDynamicProperty(CLAN_PLAYERS_KEY, undefined);
            world.setDynamicProperty(LEGACY_PLAYERS_KEY, undefined);

            this.isDirty = false;
        } catch (e) {
            console.error("§c[Teams] Erro ao salvar dados:", e);
        }
    }

    clearAll() {
        world.setDynamicProperty(CLAN_TEAMS_KEY, undefined);
        world.setDynamicProperty(CLAN_PLAYERS_KEY, undefined);
        world.setDynamicProperty(LEGACY_TEAMS_KEY, undefined);
        world.setDynamicProperty(LEGACY_PLAYERS_KEY, undefined);

        this.teams.clear();
        this.playersTeam.clear();
        this.isDirty = false;

        for (const player of getOnlinePlayers()) {
            this.updatePlayerDisplay(player);
        }

        console.warn("§c[Teams] Todos os dados foram apagados");
    }

    findTeamName(teamName) {
        const lookup = normalizeLookup(teamName);

        for (const existingName of this.teams.keys()) {
            if (normalizeLookup(existingName) === lookup) {
                return existingName;
            }
        }

        return null;
    }

    findTeamByTag(teamTag) {
        const lookup = normalizeLookup(teamTag);

        for (const team of this.teams.values()) {
            if (normalizeLookup(team.tag) === lookup) {
                return team;
            }
        }

        return null;
    }

    createTeam(teamName, teamTag = teamName) {
        // Agora permitimos cores no nome também
        const nameToSave = teamName.trim();
        const cleanName = stripFormatting(nameToSave);
        const tagToSave = teamTag.trim().replace(/\s+/g, "");

        if (cleanName.length === 0) {
            return { retorna: false, msg: "O nome do clan não pode ser vazio" };
        }

        if (!isValidClanName(nameToSave)) {
            return { retorna: false, msg: `O nome deve ter letras, numeros e no maximo ${MAX_CLAN_NAME_LENGTH} caracteres (sem cores)` };
        }

        if (!isValidClanTag(tagToSave)) {
            return { retorna: false, msg: `A tag deve ter no maximo ${MAX_CLAN_TAG_LENGTH} caracteres visiveis` };
        }

        if (this.findTeamName(cleanName)) {
            return { retorna: false, msg: "Esse clan já existe" };
        }

        if (this.findTeamByTag(tagToSave)) {
            return { retorna: false, msg: "Essa tag de clan já existe" };
        }

        this.teams.set(cleanName, {
            name: nameToSave, // Salva o nome com cores
            tag: tagToSave,
            members: new Map(),
            leader: null,
            subLeaders: new Set(),
            settings: {
                maxMembers: DEFAULT_MAX_MEMBERS,
            },
            colors: { ...DEFAULT_COLORS },
            home: null,
            logs: [],
            date: Date.now(),
        });

        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: `Clan ${cleanName} criado com sucesso`, teamName: cleanName, tag: tagToSave };
    }

    deleteTeam(teamName) {
        if (!this.teams.has(teamName)) {
            return { retorna: false, msg: "Clan não existe" };
        }

        const team = this.teams.get(teamName);

        for (const playerId of team.members.keys()) {
            this.playersTeam.delete(playerId);

            const player = getOnlinePlayers().find((p) => p.id === playerId);
            if (player) {
                this.updatePlayerDisplay(player);
            }
        }

        this.teams.delete(teamName);
        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: `Clan ${teamName} deletado` };
    }

    joinTeam(player, teamName) {
        if (!player) {
            return { retorna: false, msg: "Jogador inválido" };
        }

        if (!this.teams.has(teamName)) {
            return { retorna: false, msg: "Clan não existe" };
        }

        const currentTeam = this.playersTeam.get(player.id);
        if (currentTeam) {
            return { retorna: false, msg: `Você já está no clan ${currentTeam}` };
        }

        const team = this.teams.get(teamName);
        const maxMembers = Number(team.settings?.maxMembers ?? DEFAULT_MAX_MEMBERS);

        if (team.members.size >= maxMembers) {
            return { retorna: false, msg: "O clan atingiu o limite de membros" };
        }

        team.members.set(player.id, player.name);
        this.playersTeam.set(player.id, teamName);

        if (team.members.size === 1) {
            team.leader = player.id;
        }

        this.addLog(teamName, `${player.name} entrou no clan`);
        this.markDirty();
        this.saveTeams();
        
        // Garante a atualização visual imediata
        system.run(() => {
            this.updatePlayerDisplay(player);
        });

        return { retorna: true, msg: `Você entrou no clan ${teamName}` };
    }

    leaveTeam(player) {
        if (!player) {
            return { retorna: false, msg: "Jogador inválido" };
        }

        const teamName = this.playersTeam.get(player.id);

        if (!teamName) {
            return { retorna: false, msg: "Você não está em nenhum clan" };
        }

        const team = this.teams.get(teamName);
        if (!team) {
            this.playersTeam.delete(player.id);
            this.markDirty();
            this.saveTeams();
            return { retorna: false, msg: "Clan não existe" };
        }

        const playerName = team.members.get(player.id) ?? player.name;

        team.members.delete(player.id);
        team.subLeaders?.delete(player.id);
        this.playersTeam.delete(player.id);

        if (team.leader === player.id) {
            team.leader = team.members.size > 0 ? team.members.keys().next().value : null;
            team.subLeaders?.delete(team.leader);

            if (team.leader && team.members.has(team.leader)) {
                this.addLog(teamName, `${team.members.get(team.leader)} virou líder automaticamente`);
            }
        }

        this.addLog(teamName, `${playerName} saiu do clan`);
        this.updatePlayerDisplay(player);

        if (team.members.size === 0) {
            this.teams.delete(teamName);
        }

        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: `Você saiu do clan ${teamName}` };
    }

    renameTeam(oldName, leaderId, newName, newTag) {
        const team = this.teams.get(oldName);
        if (!team) return { retorna: false, msg: "Clan não existe" };
        if (team.leader !== leaderId) return { retorna: false, msg: "Só o líder pode renomear o clan" };

        const cleanNewName = cleanClanName(newName);
        if (!isValidClanName(newName)) return { retorna: false, msg: "Nome inválido" };
        if (cleanNewName !== oldName && this.teams.has(cleanNewName)) return { retorna: false, msg: "Esse nome já está em uso" };

        if (newTag && !isValidClanTag(newTag)) return { retorna: false, msg: "Tag inválida" };

        // Se o nome mudou, precisamos reindexar no Map
        if (cleanNewName !== oldName) {
            this.teams.delete(oldName);
            team.name = newName;
            this.teams.set(cleanNewName, team);

            // Atualiza o Map de playersTeam
            for (const [playerId, tName] of this.playersTeam.entries()) {
                if (tName === oldName) {
                    this.playersTeam.set(playerId, cleanNewName);
                }
            }
        } else {
            team.name = newName;
        }

        if (newTag) team.tag = newTag;

        this.addLog(cleanNewName, `Clan renomeado para ${newName}`);
        this.markDirty();
        this.saveTeams();

        // Atualiza display de todos os membros online
        system.run(() => {
            for (const playerId of team.members.keys()) {
                const player = getOnlinePlayers().find(p => p.id === playerId);
                if (player) this.updatePlayerDisplay(player);
            }
        });

        return { retorna: true, msg: "Clan renomeado com sucesso" };
    }

    transferLeadership(teamName, currentLeaderId, newLeaderId, force = false) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (!force && team.leader !== currentLeaderId) {
            return { retorna: false, msg: "Só o líder atual pode transferir a liderança" };
        }

        if (!team.members.has(newLeaderId)) {
            return { retorna: false, msg: "O jogador precisa estar no clan" };
        }

        if (newLeaderId === currentLeaderId) {
            return { retorna: false, msg: "Esse jogador já é o líder" };
        }

        team.leader = newLeaderId;
        team.subLeaders?.delete(newLeaderId);

        this.addLog(teamName, `Liderança transferida para ${team.members.get(newLeaderId)}`);
        this.markDirty();
        this.saveTeams();

        return {
            retorna: true,
            msg: `Liderança transferida para ${team.members.get(newLeaderId)}`,
        };
    }

    setSubLeader(teamName, leaderId, memberId, enabled) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (team.leader !== leaderId) {
            return { retorna: false, msg: "Só o líder pode gerenciar sublíderes" };
        }

        if (!team.members.has(memberId)) {
            return { retorna: false, msg: "O jogador precisa estar no clan" };
        }

        if (memberId === team.leader) {
            return { retorna: false, msg: "O líder não pode ser sublíder" };
        }

        if (!team.subLeaders) {
            team.subLeaders = new Set();
        }

        if (enabled) {
            if (team.subLeaders.has(memberId)) {
                return { retorna: false, msg: "Esse jogador já é sublíder" };
            }

            team.subLeaders.add(memberId);
            this.addLog(teamName, `${team.members.get(memberId)} virou sublíder`);
            this.markDirty();
            this.saveTeams();

            return {
                retorna: true,
                msg: `${team.members.get(memberId)} agora é sublíder`,
            };
        }

        if (!team.subLeaders.has(memberId)) {
            return { retorna: false, msg: "Esse jogador não é sublíder" };
        }

        team.subLeaders.delete(memberId);
        this.addLog(teamName, `${team.members.get(memberId)} deixou de ser sublíder`);
        this.markDirty();
        this.saveTeams();

        return {
            retorna: true,
            msg: `${team.members.get(memberId)} não é mais sublíder`,
        };
    }

    setTeamLimit(teamName, leaderId, maxMembers, force = false) {
        const team = this.teams.get(teamName);
        const limit = Number(maxMembers);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        // Se force for true, ignoramos a verificação de líder (usado pelo Admin)
        if (!force && team.leader !== leaderId) {
            return { retorna: false, msg: "Só o líder pode alterar o limite" };
        }

        if (limit < team.members.size) {
            return { retorna: false, msg: "O limite não pode ser menor que os membros atuais" };
        }

        team.settings.maxMembers = limit;
        this.addLog(teamName, `Limite de membros alterado para ${limit}`);
        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: `Novo limite definido: ${limit}` };
    }

    setTeamColors(teamName, leaderId, colors) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (team.leader !== leaderId) {
            return { retorna: false, msg: "Só o líder pode alterar as cores" };
        }

        team.colors = normalizeTeamColors(colors);
        this.addLog(teamName, "Cores do clan atualizadas");

        for (const playerId of team.members.keys()) {
            const member = getOnlinePlayers().find((target) => target.id === playerId);
            if (member) {
                this.updatePlayerDisplay(member);
            }
        }

        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: "Cores do clan atualizadas" };
    }

    setTeamHome(teamName, leaderId, location, dimensionId) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (team.leader !== leaderId) {
            return { retorna: false, msg: "Só o líder pode definir a home" };
        }

        if (!location || typeof dimensionId !== "string") {
            return { retorna: false, msg: "Home inválida" };
        }

        team.home = {
            x: Number(location.x),
            y: Number(location.y),
            z: Number(location.z),
            dimensionId,
        };

        this.addLog(
            teamName,
            `Home definida em ${Math.floor(team.home.x)}, ${Math.floor(team.home.y)}, ${Math.floor(team.home.z)}`
        );

        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: "Home do clan definida com sucesso" };
    }

    clearTeamHome(teamName, leaderId) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (team.leader !== leaderId) {
            return { retorna: false, msg: "Só o líder pode remover a home" };
        }

        if (!team.home) {
            return { retorna: false, msg: "O clan não tem home definida" };
        }

        team.home = null;
        this.addLog(teamName, "Home do clan removida");
        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: "Home removida com sucesso" };
    }

    addLog(teamName, text) {
        const team = this.teams.get(teamName);
        if (!team) return;

        if (!Array.isArray(team.logs)) {
            team.logs = [];
        }

        team.logs.push({
            time: Date.now(),
            text: String(text),
        });

        if (team.logs.length > MAX_LOGS) {
            team.logs = team.logs.slice(-MAX_LOGS);
        }

        this.markDirty();
    }

    isSubLeader(player) {
        if (!player) return false;

        const team = this.getPlayerTeam(player);
        if (!team || !team.subLeaders) return false;

        return team.subLeaders.has(player.id);
    }

    getPlayerTeam(player) {
        if (!player) return null;

        const teamName = this.playersTeam.get(player.id);
        if (!teamName) return null;

        // Tenta pegar pela chave direta (clean name)
        let team = this.teams.get(teamName);
        
        // Se não encontrar, tenta normalizar a busca (fallback de segurança)
        if (!team) {
            const realName = this.findTeamName(teamName);
            if (realName) team = this.teams.get(realName);
        }

        return team ?? null;
    }

    getPlayerTeamKey(player) {
        if (!player) return null;
        const teamName = this.playersTeam.get(player.id);
        if (!teamName) return null;
        
        if (this.teams.has(teamName)) return teamName;
        return this.findTeamName(teamName);
    }

    getMembersTeam(teamName) {
        const team = this.teams.get(teamName);
        if (!team) return [];

        return Array.from(team.members.keys());
    }

    isTeam(player1, player2) {
        if (!player1 || !player2) return false;

        const team1 = this.playersTeam.get(player1.id);
        const team2 = this.playersTeam.get(player2.id);

        return Boolean(team1 && team2 && team1 === team2);
    }

    kickFromTeam(playerId, teamName) {
        const team = this.teams.get(teamName);

        if (!team) {
            return { retorna: false, msg: "Clan não existe" };
        }

        if (!team.members.has(playerId)) {
            return { retorna: false, msg: "Player não está no clan" };
        }

        const memberName = team.members.get(playerId) ?? "Player";

        team.members.delete(playerId);
        team.subLeaders?.delete(playerId);
        this.playersTeam.delete(playerId);

        if (team.leader === playerId) {
            team.leader = team.members.size > 0 ? team.members.keys().next().value : null;
            team.subLeaders?.delete(team.leader);
        }

        this.addLog(teamName, `${memberName} foi removido do clan`);

        const kickedPlayer = getOnlinePlayers().find((player) => player.id === playerId);
        if (kickedPlayer) {
            this.updatePlayerDisplay(kickedPlayer);
        }

        if (team.members.size === 0) {
            this.teams.delete(teamName);
        }

        this.markDirty();
        this.saveTeams();

        return { retorna: true, msg: `Player removido do clan ${teamName}` };
    }

    runConsistencyCheck() {
        let fixes = 0;
        const rebuiltPlayersTeam = new Map();

        for (const [teamName, team] of Array.from(this.teams.entries())) {
            if (!(team.members instanceof Map)) {
                team.members = new Map(team.members ?? []);
                fixes++;
            }

            if (!(team.subLeaders instanceof Set)) {
                team.subLeaders = new Set(team.subLeaders ?? []);
                fixes++;
            }

            // Na consistência, não forçamos a limpeza da TAG se ela já for válida (mesmo com cores)
            if (!isValidClanTag(team.tag)) {
                team.tag = stripFormatting(team.tag).toUpperCase().slice(0, MAX_CLAN_TAG_LENGTH);
                fixes++;
            }

            if (!team.settings || typeof team.settings !== "object") {
                team.settings = { maxMembers: DEFAULT_MAX_MEMBERS };
                fixes++;
            }

            const colors = normalizeTeamColors(team.colors);
            if (!team.colors || JSON.stringify(team.colors) !== JSON.stringify(colors)) {
                team.colors = colors;
                fixes++;
            }

            let maxMembers = Number(team.settings.maxMembers);
            if (!Number.isInteger(maxMembers) || maxMembers < 2) {
                maxMembers = DEFAULT_MAX_MEMBERS;
                fixes++;
            }
            team.settings.maxMembers = maxMembers;

            if (!Array.isArray(team.logs)) {
                team.logs = [];
                fixes++;
            }

            if (team.logs.length > MAX_LOGS) {
                team.logs = team.logs.slice(-MAX_LOGS);
                fixes++;
            }

            if (
                team.home &&
                (
                    typeof team.home.dimensionId !== "string" ||
                    !Number.isFinite(team.home.x) ||
                    !Number.isFinite(team.home.y) ||
                    !Number.isFinite(team.home.z)
                )
            ) {
                team.home = null;
                fixes++;
            }

            if (team.members.size === 0) {
                this.teams.delete(teamName);
                fixes++;
                continue;
            }

            if (!team.leader || !team.members.has(team.leader)) {
                team.leader = team.members.keys().next().value;
                fixes++;
            }

            for (const subLeaderId of Array.from(team.subLeaders.values())) {
                if (subLeaderId === team.leader || !team.members.has(subLeaderId)) {
                    team.subLeaders.delete(subLeaderId);
                    fixes++;
                }
            }

            for (const [playerId, memberName] of Array.from(team.members.entries())) {
                if (!playerId || !memberName) {
                    team.members.delete(playerId);
                    fixes++;
                    continue;
                }

                rebuiltPlayersTeam.set(playerId, teamName);
            }

            if (team.members.size === 0) {
                this.teams.delete(teamName);
                fixes++;
                continue;
            }
        }

        const originalPlayers = JSON.stringify(Array.from(this.playersTeam.entries()));
        const rebuiltPlayers = JSON.stringify(Array.from(rebuiltPlayersTeam.entries()));

        if (originalPlayers !== rebuiltPlayers) {
            this.playersTeam = rebuiltPlayersTeam;
            fixes++;
        }

        if (fixes > 0) {
            this.markDirty();
            this.saveTeams();
        }

        return { fixes };
    }

    updatePlayerDisplay(player) {
        if (!player) return;

        system.run(() => {
            try {
                const team = this.getPlayerTeam(player);

                if (!isValidEntity(player)) return; // Adicionado isValidEntity para evitar erro de entidade inválida
                for (const tag of player.getTags()) {
                    if (tag.startsWith("clan_")) {
                        player.removeTag(tag);
                    }
                }

                if (team) {
                    // Remove formatação para a TAG interna do Minecraft (não suporta §)
                    const safeTagName = stripFormatting(team.tag).replace(/[^a-zA-Z0-9_]/g, "_");
                    player.addTag(`clan_${safeTagName}`);
                }

                applyRankTags(player);

                // Tags de cargo (L/M/S) removidas do nametag e do chat a pedido do usuário

                // Ordem final: [TOP] [CLAN] [RANK]
                const clanTag = team ? formatClanTag(team) : "";
                player.nameTag = formatRankedName(player, clanTag, "");
            } catch (e) {
                console.warn("§e[Teams] Não foi possível atualizar o display do player:", e);
            }
        });
    }

    onJoinPlayer(player) {
        if (!player) return;

        system.runTimeout(() => {
            const teamName = this.playersTeam.get(player.id);

            if (teamName && this.teams.has(teamName)) {
                const team = this.teams.get(teamName);

                if (team.members.get(player.id) !== player.name) {
                    team.members.set(player.id, player.name);
                    this.markDirty();
                    this.saveTeams();
                }
            }
            
            // Atualiza o display mesmo que não tenha clã, para garantir que o Rank apareça
            this.updatePlayerDisplay(player);
        }, 40);
    }

    onLeavePlayer() {}
}
