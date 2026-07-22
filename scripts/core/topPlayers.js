import { world, system } from "@minecraft/server";
import { isModuleEnabled } from "./moduleState.js";
import { getOnlinePlayers, isValidEntity } from "./scriptCompat.js";
import { updateRankDisplay } from "./ranks.js";
import { getTeamSystem } from "../clan/teamManager.js";

const TOP_TAGS = ["top:1", "top:2", "top:3"];
const TOP_STATE_KEY = "labsdev:top_players_state";

export class TopPlayers {
    static state = {
        "top:1": { holder: null, previous: null, lastKill: 0, color: "§6" },
        "top:2": { holder: null, previous: null, lastKill: 0, color: "§7" },
        "top:3": { holder: null, previous: null, lastKill: 0, color: "§c" }
    };

    static init() {
        this.loadState();
        
        // Verifica inatividade a cada 10 minutos (12000 ticks)
        system.runInterval(() => {
            if (isModuleEnabled("top_players")) this.checkInactivity();
        }, 12000);

        // Sincroniza tags a cada 30 segundos (600 ticks)
        system.runInterval(() => {
            if (isModuleEnabled("top_players")) this.syncTags();
        }, 600);
    }

    static loadState() {
        try {
            const raw = world.getDynamicProperty(TOP_STATE_KEY);
            if (raw) this.state = JSON.parse(raw);
        } catch (e) {
            console.warn("[TopPlayers] Erro ao carregar estado:", e);
        }
    }

    static saveState() {
        world.setDynamicProperty(TOP_STATE_KEY, JSON.stringify(this.state));
    }

    static checkInactivity() {
        const now = Date.now();
        const limit = 24 * 60 * 60 * 1000; // 24 horas
        for (const tag of TOP_TAGS) {
            const data = this.state[tag];
            if (data.holder && data.lastKill > 0 && (now - data.lastKill >= limit)) {
                this.handleInactivity(tag);
            }
        }
    }

    static handleInactivity(tag) {
        const now = Date.now(); // CORREÇÃO: Definindo a variável 'now' que faltava
        const data = this.state[tag];
        const oldHolder = data.holder;
        const prevHolder = data.previous;
        
        world.sendMessage(`§6§l[TOP] §e${oldHolder} §7perdeu a tag §6${tag} §7por inatividade!`);
        
        // Se houver um anterior, ele assume, senão fica vazio
        this.state[tag] = prevHolder 
            ? { holder: prevHolder, previous: null, lastKill: now } 
            : { holder: null, previous: null, lastKill: 0 };
            
        this.saveState();
        this.refreshAllDisplays();
    }

    static handleKill(attacker, victim) {
        if (!isModuleEnabled("top_players")) return;
        
        const now = Date.now();
        const attackerName = attacker.name;
        const victimName = victim.name;

        // Encontra as posições atuais
        let attackerPos = 0;
        let victimPos = 0;

        for (let i = 1; i <= 3; i++) {
            if (this.state[`top:${i}`].holder === attackerName) attackerPos = i;
            if (this.state[`top:${i}`].holder === victimName) victimPos = i;
        }

        // Lógica de Inversão/Roubo de Tags:
        // 1. Player (sem tag) mata qualquer Top -> Ganha a tag do Top, Top perde.
        if (attackerPos === 0 && victimPos > 0) {
            const tag = `top:${victimPos}`;
            const oldHolder = this.state[tag].holder;
            this.state[tag] = { holder: attackerName, previous: oldHolder, lastKill: now };
            world.sendMessage(`§6§l[TOP] §e${attackerName} §7derrotou o §6TOP ${victimPos} §e${oldHolder} §7e assumiu seu lugar!`);
        }
        // 2. Top (2 ou 3) mata Top 1 -> Invertem as tags.
        else if (attackerPos > 1 && victimPos === 1) {
            const tag1 = "top:1";
            const tagAttacker = `top:${attackerPos}`;
            
            const oldTop1 = this.state[tag1].holder;
            this.state[tag1] = { holder: attackerName, previous: oldTop1, lastKill: now };
            this.state[tagAttacker] = { holder: oldTop1, previous: attackerName, lastKill: now };
            
            world.sendMessage(`§6§l[TOP] §e${attackerName} §7(TOP ${attackerPos}) derrotou o §6TOP 1 §e${oldTop1}§7! As tags foram invertidas.`);
        }
        // 3. Top 3 mata Top 2 -> Invertem as tags.
        else if (attackerPos === 3 && victimPos === 2) {
            const tag2 = "top:2";
            const tag3 = "top:3";
            
            const oldTop2 = this.state[tag2].holder;
            this.state[tag2] = { holder: attackerName, previous: oldTop2, lastKill: now };
            this.state[tag3] = { holder: oldTop2, previous: attackerName, lastKill: now };
            
            world.sendMessage(`§6§l[TOP] §e${attackerName} §7(TOP 3) derrotou o §6TOP 2 §e${oldTop2}§7! As tags foram invertidas.`);
        }
        // 4. Top mata alguém de rank inferior ou sem rank -> Apenas protege sua tag (atualiza lastKill).
        else if (attackerPos > 0 && (victimPos === 0 || victimPos > attackerPos)) {
            const tag = `top:${attackerPos}`;
            this.state[tag].lastKill = now;
            // Opcional: mensagem de defesa de tag
            // attacker.sendMessage(`§a[TOP] Você defendeu sua tag TOP ${attackerPos}!`);
        }
        // 5. Player (sem tag) mata Player (sem tag) -> Nao acontece nada.
        // O sistema so funciona se a Staff der a tag manualmente primeiro.
        else if (attackerPos === 0 && victimPos === 0) {
            // Logica removida para respeitar o requisito de atribuicao manual pela Staff.
        }

        this.saveState();
        this.syncTags();
    }

    static syncTags() {
        const players = getOnlinePlayers();
        
        // 1. Garantir exclusividade: Encontrar quem deve ter cada tag
        const holders = {};
        for (const tag of TOP_TAGS) {
            holders[tag] = this.state[tag].holder;
        }

        // 2. Aplicar/Remover tags e atualizar o nametag
        for (const player of players) {
            if (!isValidEntity(player)) continue;
            
            let changed = false;
            for (const tag of TOP_TAGS) {
                try {
                    const shouldHave = holders[tag] === player.name;
                    const has = player.hasTag(tag);
                    
                    if (shouldHave && !has) {
                        player.addTag(tag);
                        changed = true;
                    } else if (!shouldHave && has) {
                        player.removeTag(tag);
                        changed = true;
                    }
                } catch (e) {}
            }

            // Atualiza o nametag do player se houve mudança ou se é um dos holders
            const isHolder = Object.values(holders).includes(player.name);
            if (changed || isHolder) {
                try {
                    const teamSystem = isModuleEnabled("clan") ? getTeamSystem() : null;
                    if (teamSystem?.updatePlayerDisplay) {
                        teamSystem.updatePlayerDisplay(player);
                    } else {
                        updateRankDisplay(player);
                    }
                } catch (e) {}
            }
        }
    }

    static refreshAllDisplays() {
        this.syncTags();
    }
}

// ── Listeners de scriptevent para gerenciamento manual ──────────────────────
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (!isModuleEnabled("top_players")) return;
    
    // warden:top_set "NomeDoJogador" "1|2|3"
    if (id === "warden:top_set") {
        if (sourceEntity && !sourceEntity.hasTag("admin")) return;
        
        const args = message?.trim().split(/\s+/);
        if (!args || args.length < 2) return;
        
        const targetName = args[0];
        const position = args[1];
        const tag = `top:${position}`;
        
        if (!TOP_TAGS.includes(tag)) return;
        
        TopPlayers.state[tag] = { holder: targetName, previous: TopPlayers.state[tag].holder, lastKill: Date.now() };
        TopPlayers.saveState();
        TopPlayers.syncTags();
        
        if (sourceEntity) sourceEntity.sendMessage(`§a[Top] §f${targetName} §7agora é o §6${tag}§7.`);
    }

    // warden:top_clear "1|2|3"
    if (id === "warden:top_clear") {
        if (sourceEntity && !sourceEntity.hasTag("admin")) return;
        
        const position = message?.trim();
        const tag = `top:${position}`;
        
        if (!TOP_TAGS.includes(tag)) return;
        
        TopPlayers.state[tag] = { holder: null, previous: null, lastKill: 0 };
        TopPlayers.saveState();
        TopPlayers.syncTags();
        
        if (sourceEntity) sourceEntity.sendMessage(`§a[Top] §7Tag §6${tag} §7limpa.`);
    }
});

// Inicializa o sistema
system.run(() => TopPlayers.init());
