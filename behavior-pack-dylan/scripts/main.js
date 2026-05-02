import { world, system, ItemStack, EnchantmentTypes } from '@minecraft/server';
import { http, HttpRequest, HttpRequestMethod, HttpHeader } from '@minecraft/server-net';
import { ActionFormData, MessageFormData } from '@minecraft/server-ui';

const WARDEN_API_BASE = 'https://warden-shop-oficial.onrender.com/api/addon';
const API_KEY = 'wsk_b08777ccc4637a0ee6ebfdcc269f56b4ffc2c69377dc02a28ab028c480db4575119cb4add260eb50c14b8b580ba01253';

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
        if (id === 'warden:resgatar') {
            await this.openRescueGUI(sourceEntity);
        }
    }

    async testHealthCheck() {
        try {
            const request = new HttpRequest(`${WARDEN_API_BASE}/addon.health`);
            request.method = HttpRequestMethod.Get;
            request.headers = [new HttpHeader('Authorization', `Bearer ${API_KEY}`)];
            await http.request(request);
        } catch (_) {}
    }

    /* ── Buscar items pendentes (um por um, não pedidos completos) ── */
    async fetchPendingItems() {
        try {
            const url = `${WARDEN_API_BASE}/pending-items?apiKey=${encodeURIComponent(API_KEY)}`;
            const request = new HttpRequest(url);
            request.method = HttpRequestMethod.Get;
            const response = await http.request(request);
            if (response.status === 200 && response.body) {
                const data = JSON.parse(response.body);
                console.warn('[WardenShop] fetchPendingItems response:', JSON.stringify(data));
                const items = data.items ?? [];
                console.warn('[WardenShop] Parsed items:', items.length);
                return items;
            }
            return [];
        } catch (e) { 
            console.warn('[WardenShop] fetchPendingItems error:', e);
            return []; 
        }
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

    async openRescueGUI(player) {
        if (player.hasTag('pvp_off')) {
            await this.showSafeZoneWarning(player);
            return;
        }

        if (this.processingPlayers.has(player.name)) {
            player.sendMessage('§6[Warden Shop] §eAguarde, processando...');
            return;
        }

        player.sendMessage('§7[Warden Shop] Buscando itens...');

        const [normalItems, kitOrders] = await Promise.all([
            this.fetchPendingItems(),
            this.fetchKitOrders(),
        ]);

        const playerItems = normalItems.filter(item =>
            item.minecraftNickname?.toLowerCase() === player.name.toLowerCase()
        );
        const playerKits = kitOrders.filter(o =>
            o.nickname?.toLowerCase() === player.name.toLowerCase()
        );

        // Unificar lista: items normais + kits
        const allItems = [
            ...playerItems.map(item => ({ ...item, isKit: false, isItem: true })),
            ...playerKits.map(o => ({ ...o, isKit: true, isItem: false, minecraftNickname: o.nickname })),
        ];

        if (allItems.length === 0) {
            await this.showNoOrdersScreen(player);
            return;
        }

        await this.showItemListScreen(player, allItems);
    }

    async showSafeZoneWarning(player) {
        const form = new MessageFormData()
            .title('§c§l⚠ Zona Segura')
            .body(
                '§l§eVocê está em uma §c§lZona Segura§r§l§e!\n\n' +
                '§r§lPara resgatar seus itens, saia da zona segura para um local onde não possa ser roubado.\n\n' +
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

    async showItemListScreen(player, items) {
        const form = new ActionFormData()
            .title('§6§lWarden Shop §r§l- Itens Pendentes')
            .body(
                `§l§aVocê tem ${items.length} item(ns) para resgatar.\n` +
                `§r§lSelecione um item para resgatar.`
            );

        for (const item of items) {
            if (item.isKit) {
                // Kit personalizado
                const total = item.total || item.totalPrice || '0.00';
                const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A';
                form.button(`§d[KIT] §l§e${item.orderNumber ?? `#${item.id}`} §r§l- §aR$ ${total}\n§r§8Data: ${date}`);
            } else {
                // Item normal
                const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A';
                const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
                form.button(`§l§e${qty}${item.productName}\n§r§8Pedido: ${item.orderNumber} • ${date}`);
            }
        }

        let response;
        try { response = await form.show(player); } catch (_) { return; }
        if (response.canceled) return;

        await this.showItemDetailScreen(player, items[response.selection], items);
    }

    async showItemDetailScreen(player, item, allItems) {
        if (item.isKit) {
            // Kit personalizado - mostra detalhes do kit
            const total = item.total || item.totalPrice || '0.00';
            const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A';
            let itemsText = '';
            if (item.kitSlots?.length > 0) {
                itemsText = '\n§l§7Itens do Kit:\n' +
                    item.kitSlots.map(s => `  §r§l§f• ${s.quantity}x ${s.name}`).join('\n');
            }

            const form = new MessageFormData()
                .title(`§l§6Kit §e${item.orderNumber ?? `#${item.id}`}`)
                .body(
                    `§l§7ID: §f${item.orderNumber ?? `#${item.id}`}\n` +
                    `§l§7Valor: §aR$ ${total}\n` +
                    `§l§7Data: §f${date}` +
                    itemsText +
                    '\n\n§l§eDeseja resgatar este kit agora?'
                )
                .button1('§l§a✔ Resgatar')
                .button2('§l§7← Voltar');

            let response;
            try { response = await form.show(player); } catch (_) { return; }
            if (response.canceled || response.selection === 1) {
                await this.showItemListScreen(player, allItems);
                return;
            }

            await this.deliverSingleKit(player, item, allItems);
        } else {
            // Item normal
            const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A';
            const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
            const price = parseFloat(item.unitPrice) * item.quantity;

            const form = new MessageFormData()
                .title(`§l§6${item.productName}`)
                .body(
                    `§l§7Produto: §f${qty}${item.productName}\n` +
                    `§l§7Pedido: §f${item.orderNumber}\n` +
                    `§l§7Valor: §aR$ ${price.toFixed(2)}\n` +
                    `§l§7Data: §f${date}\n` +
                    '\n§l§eDeseja resgatar este item agora?'
                )
                .button1('§l§a✔ Resgatar')
                .button2('§l§7← Voltar');

            let response;
            try { response = await form.show(player); } catch (_) { return; }
            if (response.canceled || response.selection === 1) {
                await this.showItemListScreen(player, allItems);
                return;
            }

            await this.deliverSingleItem(player, item, allItems);
        }
    }

    async deliverSingleItem(player, item, allItems) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            const success = await this.deliverItem(player, item);
            if (success) await this.markItemAsDelivered(item.itemId);
            await this.showDeliveryResultScreen(player, success ? 1 : 0, success ? 0 : 1);
        } finally {
            this.processingPlayers.delete(player.name);
        }
    }

    async deliverSingleKit(player, kit, allItems) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            const success = await this.deliverKitOrder(player, kit);
            if (success) await this.markOrderAsDelivered(kit.id);
            await this.showDeliveryResultScreen(player, success ? 1 : 0, success ? 0 : 1);
        } finally {
            this.processingPlayers.delete(player.name);
        }
    }

    /* ── Kit personalizado: usa o mesmo sistema do armor_stand ──
       Cria a shulker box com os itens do JSON na posição do jogador. ── */
    async deliverKitOrder(player, order) {
        return new Promise((resolve) => {
            system.run(() => {
                try {
                    const dim = player.dimension;
                    const loc = player.location;

                    const pos = {
                        x: Math.floor(loc.x) + 1,
                        y: Math.floor(loc.y),
                        z: Math.floor(loc.z),
                    };

                    dim.runCommand(`setblock ${pos.x} ${pos.y} ${pos.z} minecraft:purple_shulker_box`);

                    system.runTimeout(() => {
                        try {
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

                                    // Apply enchantments if present
                                    if (slot.enchants?.length > 0) {
                                        const enchantable = item.getComponent('minecraft:enchantable');
                                        if (enchantable) {
                                            for (const ench of slot.enchants) {
                                                try {
                                                    const enchType = EnchantmentTypes.get(ench.id);
                                                    if (enchType) {
                                                        enchantable.addEnchantment({ type: enchType, level: ench.level });
                                                    }
                                                } catch (e) {
                                                    console.warn(`[WardenKit] Encantamento inválido: ${ench.id} — ${e}`);
                                                }
                                            }
                                        }
                                    }

                                    container.setItem(slot.slot, item);
                                    placed++;
                                } catch (e) {
                                    console.warn(`[WardenKit] Item inválido: ${slot.minecraftId} — ${e}`);
                                }
                            }

                            if (placed > 0) {
                                player.sendMessage(
                                    `§a[Warden Shop] §fKit §e${order.orderNumber} §fentregue! Procure a §dshulker box roxa §fao seu lado.`
                                );
                            }

                            resolve(placed > 0);
                        } catch (e) {
                            console.warn(`[WardenKit] Erro ao preencher shulker: ${e}`);
                            resolve(false);
                        }
                    }, 2);
                } catch (e) {
                    console.warn(`[WardenKit] Erro: ${e}`);
                    resolve(false);
                }
            });
        });
    }

    /* ── Item normal: executa comandos do produto ── */
    async deliverItem(player, item) {
        try {
            const commands = item.commands ?? [];
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

    async markItemAsDelivered(itemId) {
        try {
            const request = new HttpRequest(`${WARDEN_API_BASE}/mark-item-delivered`);
            request.method = HttpRequestMethod.Post;
            request.headers = [new HttpHeader('Content-Type', 'application/json')];
            request.body = JSON.stringify({ apiKey: API_KEY, itemId });
            await http.request(request);
        } catch (_) {}
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
                    ? `§l§aItem entregue com sucesso!\n` +
                      '\n§r§lObrigado por comprar na §6§lWarden Craft Store§r§l!'
                    : '§l§cNão foi possível entregar o item.\n\n§r§lTente novamente em instantes ou contate o suporte.'
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
