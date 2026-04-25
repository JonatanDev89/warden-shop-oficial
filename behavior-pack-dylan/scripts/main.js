import { world, system, ItemStack } from '@minecraft/server';
import { http, HttpRequest, HttpRequestMethod, HttpHeader } from '@minecraft/server-net';
import { ActionFormData, MessageFormData } from '@minecraft/server-ui';

const WARDEN_API_BASE = 'https://warden-shop-oficial.onrender.com/api/addon';
const API_KEY = 'warden_qPpXWoLRQvPVbKJ0';

/* ===============================
   ANTIDUP
================================ */
const BLOCKED_EXACT = ["minecraft:crafter"];
const BLOCKED_CONTAINS = ["bundle"];

function isBlockedItem(typeId) {
    if (BLOCKED_EXACT.includes(typeId)) return true;
    return BLOCKED_CONTAINS.some(k => typeId.includes(k));
}

function cleanContainer(container) {
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && isBlockedItem(item.typeId)) container.setItem(i, null);
    }
}

function cleanPlayer(player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) cleanContainer(inv);
}

system.runInterval(() => {
    for (const player of world.getPlayers()) cleanPlayer(player);
}, 1);

/* ===============================
   WARDEN SHOP
================================ */
class WardenShop {
    constructor() {
        this.processingPlayers = new Set();
        system.run(() => this.init());
    }

    async init() {
        await this.waitForWorld();
        this.registerEvents();
        await this.testHealthCheck();
    }

    async waitForWorld() {
        return new Promise((resolve) => {
            let checkInterval = system.runInterval(() => {
                if (world.getAllPlayers().length > 0) {
                    system.clearRun(checkInterval);
                    resolve();
                }
            }, 20);
            system.runTimeout(() => { system.clearRun(checkInterval); resolve(); }, 100);
        });
    }

    registerEvents() {
        if (system.afterEvents?.scriptEventReceive) {
            system.afterEvents.scriptEventReceive.subscribe(async (event) => {
                await this.handleScriptEvent(event);
            });
        }
    }

    async handleScriptEvent(event) {
        const { id, sourceEntity } = event;
        if (!id?.startsWith('warden:') || sourceEntity?.typeId !== 'minecraft:player') return;
        if (id === 'warden:resgatar') await this.openRescueGUI(sourceEntity);
    }

    async testHealthCheck() {
        try {
            const request = new HttpRequest(`${WARDEN_API_BASE}/addon.health`);
            request.method = HttpRequestMethod.Get;
            request.headers = [new HttpHeader('Authorization', `Bearer ${API_KEY}`)];
            await http.request(request);
        } catch (_) {}
    }

    /* ── Buscar pedidos normais ── */
    async fetchPendingOrders() {
        try {
            const url = `${WARDEN_API_BASE}/pending-orders?apiKey=${encodeURIComponent(API_KEY)}`;
            const request = new HttpRequest(url);
            request.method = HttpRequestMethod.Get;
            const response = await http.request(request);
            if (response.status === 200 && response.body) {
                const data = JSON.parse(response.body);
                if (Array.isArray(data)) return data;
                if (data.orders) return data.orders;
            }
            return [];
        } catch (_) { return []; }
    }

    /* ── Buscar pedidos de kit personalizado ── */
    async fetchKitOrders() {
        try {
            const url = `${WARDEN_API_BASE}/kit-orders?apiKey=${encodeURIComponent(API_KEY)}`;
            const request = new HttpRequest(url);
            request.method = HttpRequestMethod.Get;
            const response = await http.request(request);
            if (response.status === 200 && response.body) {
                const data = JSON.parse(response.body);
                return data.orders ?? [];
            }
            return [];
        } catch (_) { return []; }
    }

    /* ── GUI principal ── */
    async openRescueGUI(player) {
        if (player.hasTag('pvp_off')) {
            await this.showSafeZoneWarning(player);
            return;
        }

        if (this.processingPlayers.has(player.name)) {
            player.sendMessage('§6[Warden Shop] §eAguarde, processando...');
            return;
        }

        player.sendMessage('§7[Warden Shop] Buscando pedidos...');

        // Buscar pedidos normais e kits ao mesmo tempo
        const [normalOrders, kitOrders] = await Promise.all([
            this.fetchPendingOrders(),
            this.fetchKitOrders(),
        ]);

        const playerNormal = normalOrders.filter(o =>
            o.minecraftNickname?.toLowerCase() === player.name.toLowerCase()
        );
        const playerKits = kitOrders.filter(o =>
            o.nickname?.toLowerCase() === player.name.toLowerCase()
        );

        // Unificar: marcar kits com flag isKit
        const allOrders = [
            ...playerNormal.map(o => ({ ...o, isKit: false })),
            ...playerKits.map(o => ({
                ...o,
                isKit: true,
                minecraftNickname: o.nickname,
                total: o.total,
            })),
        ];

        if (allOrders.length === 0) {
            await this.showNoOrdersScreen(player);
            return;
        }

        await this.showOrderListScreen(player, allOrders);
    }

    async showSafeZoneWarning(player) {
        const form = new MessageFormData()
            .title('§c§l⚠ Zona Segura')
            .body(
                '§l§eVocê está em uma §c§lZona Segura§r§l§e!\n\n' +
                '§r§lPara resgatar seus itens, saia da zona segura.\n\n' +
                '§l§cO resgate foi bloqueado por segurança.'
            )
            .button1('§l§aEntendido')
            .button2('§l§7Fechar');
        await form.show(player).catch(() => {});
    }

    async showNoOrdersScreen(player) {
        const form = new MessageFormData()
            .title('§6§lWarden Shop')
            .body('§l§7Você não possui pedidos pendentes no momento.\n\n§r§lSe você fez uma compra recentemente, aguarde alguns instantes e tente novamente.')
            .button1('§l§aOk')
            .button2('§l§7Fechar');
        await form.show(player).catch(() => {});
    }

    async showOrderListScreen(player, orders) {
        const form = new ActionFormData()
            .title('§6§lWarden Shop §r§l- Pedidos Pendentes')
            .body(`§l§aVocê tem ${orders.length} pedido(s) pendente(s).\n§r§lSelecione um pedido para resgatar.`);

        for (const order of orders) {
            const total = order.total ?? '0.00';
            const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : 'N/A';
            const tag = order.isKit ? '§d[KIT PERSONALIZADO] ' : '';
            form.button(`${tag}§l§e${order.orderNumber} §r§l- §aR$ ${total}\n§r§8Data: ${date}`);
        }

        let response;
        try { response = await form.show(player); } catch (_) { return; }
        if (response.canceled) return;

        await this.showOrderDetailScreen(player, orders[response.selection], orders);
    }

    async showOrderDetailScreen(player, order, allOrders) {
        const total = order.total ?? '0.00';
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : 'N/A';

        let itemsText = '';
        if (order.isKit && order.kitSlots?.length > 0) {
            itemsText = '\n§l§7Itens do Kit:\n' +
                order.kitSlots.map(s => `  §r§l§f• ${s.quantity}x ${s.name}`).join('\n');
        } else if (order.items?.length > 0) {
            itemsText = '\n§l§7Itens:\n' + order.items.map(i => `  §r§l§f• ${i.name || i.item || i}`).join('\n');
        }

        const form = new MessageFormData()
            .title(`§l§6Pedido §e${order.orderNumber}`)
            .body(
                `§l§7Pedido: §f${order.orderNumber}\n` +
                `§l§7Valor: §aR$ ${total}\n` +
                `§l§7Data: §f${date}` +
                itemsText +
                '\n\n§l§eDeseja resgatar este pedido agora?'
            )
            .button1('§l§a✔ Resgatar')
            .button2('§l§7← Voltar');

        let response;
        try { response = await form.show(player); } catch (_) { return; }
        if (response.canceled || response.selection === 1) {
            await this.showOrderListScreen(player, allOrders);
            return;
        }

        await this.deliverSingleOrder(player, order, allOrders);
    }

    async deliverSingleOrder(player, order, allOrders) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            let success = false;

            if (order.isKit) {
                success = await this.deliverKitOrder(player, order);
            } else {
                success = await this.deliverOrder(player, order);
            }

            if (success) await this.markOrderAsDelivered(order.id);
            await this.showDeliveryResultScreen(player, success ? 1 : 0, success ? 0 : 1);
        } finally {
            this.processingPlayers.delete(player.name);
        }
    }

    /* ── Entregar kit personalizado: cria shulker box com os itens ── */
    async deliverKitOrder(player, order) {
        return new Promise((resolve) => {
            system.run(() => {
                try {
                    const dim = player.dimension;
                    const loc = player.location;

                    // Posição ao lado do jogador
                    const pos = {
                        x: Math.floor(loc.x) + 1,
                        y: Math.floor(loc.y),
                        z: Math.floor(loc.z),
                    };

                    // Criar shulker box roxa
                    dim.setBlock(pos, 'minecraft:purple_shulker_box');
                    const block = dim.getBlock(pos);
                    const container = block?.getComponent('minecraft:inventory')?.container;

                    if (!container) {
                        resolve(false);
                        return;
                    }

                    let placed = 0;
                    for (const slot of (order.kitSlots ?? [])) {
                        if (!slot || slot.slot < 0 || slot.slot >= container.size) continue;
                        try {
                            const itemId = slot.minecraftId.includes(':')
                                ? slot.minecraftId
                                : `minecraft:${slot.minecraftId}`;
                            const item = new ItemStack(itemId, Math.max(1, slot.quantity));
                            container.setItem(slot.slot, item);
                            placed++;
                        } catch (e) {
                            console.warn(`[WardenKit] Item inválido: ${slot.minecraftId} — ${e}`);
                        }
                    }

                    if (placed > 0) {
                        player.sendMessage(
                            `§a[Warden Shop] §fSeu kit personalizado §e${order.orderNumber} §ffoi montado! Procure a §dshulker box roxa §fao seu lado.`
                        );
                    }

                    resolve(placed > 0);
                } catch (e) {
                    console.warn(`[WardenKit] Erro ao entregar kit: ${e}`);
                    resolve(false);
                }
            });
        });
    }

    /* ── Entregar pedido normal via comandos ── */
    async deliverOrder(player, order) {
        try {
            let commands = [];
            if (order.commands) {
                if (typeof order.commands === 'string') {
                    try { commands = JSON.parse(order.commands); }
                    catch (_) { if (order.commands.trim()) commands = [order.commands]; }
                } else if (Array.isArray(order.commands)) {
                    commands = order.commands;
                }
            }
            if (commands.length === 0) return false;

            let executed = 0;
            for (const command of commands) {
                try {
                    world.getDimension('overworld').runCommand(command.replace(/{player}/g, player.name));
                    executed++;
                } catch (_) {}
            }
            return executed > 0;
        } catch (_) { return false; }
    }

    async markOrderAsDelivered(orderId) {
        try {
            const request = new HttpRequest(`${WARDEN_API_BASE}/mark-delivered`);
            request.method = HttpRequestMethod.Post;
            request.headers = [new HttpHeader('Content-Type', 'application/json')];
            request.body = JSON.stringify({ apiKey: API_KEY, orderId });
            await http.request(request);
        } catch (_) {}
    }

    async showDeliveryResultScreen(player, delivered, failed) {
        const success = delivered > 0;
        const form = new MessageFormData()
            .title(success ? '§a§l✔ Resgate Concluído' : '§c§l✘ Falha no Resgate')
            .body(
                success
                    ? `§l§a${delivered} pedido(s) entregue(s) com sucesso!\n` +
                      (failed > 0 ? `§l§c${failed} pedido(s) falharam.\n` : '') +
                      '\n§r§lObrigado por comprar na §6§lWarden Craft Store§r§l!'
                    : '§l§cNão foi possível entregar os pedidos.\n\n§r§lTente novamente em instantes ou contate o suporte.'
            )
            .button1('§l§aFechar')
            .button2('§l§7Ok');

        try {
            if (success) player.playSound('random.levelup');
            await form.show(player);
        } catch (_) {}
    }
}

system.run(() => new WardenShop());
