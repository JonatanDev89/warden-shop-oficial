import { world, system } from "@minecraft/server";
import { isModuleEnabled } from "../core/moduleState.js";
import { isValidEntity } from "../core/scriptCompat.js";

/**
 * @typedef {Object} TPARequest
 * @property {import("@minecraft/server").Player} sender
 * @property {import("@minecraft/server").Player} target
 * @property {"tpa" | "tpahere"} type
 * @property {number} timestamp
 */

/** @type {Map<string, TPARequest[]>} */
const pendingRequests = new Map();

/**
 * Adiciona uma requisição à fila do jogador alvo
 * @param {import("@minecraft/server").Player} target 
 * @param {import("@minecraft/server").Player} sender 
 * @param {"tpa" | "tpahere"} type 
 */
export function addRequestToQueue(target, sender, type) {
    if (!pendingRequests.has(target.id)) {
        pendingRequests.set(target.id, []);
    }
    
    const queue = pendingRequests.get(target.id);
    
    // Remove pedido anterior do mesmo sender para o mesmo target se existir
    const existingIndex = queue.findIndex(req => req.sender.id === sender.id);
    if (existingIndex !== -1) {
        queue.splice(existingIndex, 1);
    }
    
    queue.push({
        sender,
        target,
        type,
        timestamp: Date.now()
    });
    
    // Auto-expirar após 60 segundos
    system.runTimeout(() => {
        removeRequest(target.id, sender.id);
    }, 60 * 20);
}

/**
 * Remove uma requisição específica
 * @param {string} targetId 
 * @param {string} senderId 
 */
export function removeRequest(targetId, senderId) {
    const queue = pendingRequests.get(targetId);
    if (!queue) return;
    
    const index = queue.findIndex(req => req.sender.id === senderId);
    if (index !== -1) {
        queue.splice(index, 1);
    }
    
    if (queue.length === 0) {
        pendingRequests.delete(targetId);
    }
}

/**
 * Obtém todas as requisições de um jogador
 * @param {import("@minecraft/server").Player} player 
 * @returns {TPARequest[]}
 */
export function getRequestsForPlayer(player) {
    const queue = pendingRequests.get(player.id) || [];
    // Filtra apenas players válidos (online)
    return queue.filter(req => isValidEntity(req.sender));
}

/**
 * Limpa requisições quando um player sai
 */
world.afterEvents.playerLeave.subscribe((event) => {
    pendingRequests.delete(event.playerId);
    
    // Remove este player de todas as outras filas como sender
    for (const [targetId, queue] of pendingRequests.entries()) {
        const newQueue = queue.filter(req => req.sender.id !== event.playerId);
        if (newQueue.length === 0) {
            pendingRequests.delete(targetId);
        } else {
            pendingRequests.set(targetId, newQueue);
        }
    }
});
