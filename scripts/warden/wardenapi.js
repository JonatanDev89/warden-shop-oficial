import {
    world,
    system,
    CommandPermissionLevel,
    CustomCommandStatus,
    ItemStack,
    EnchantmentTypes
} from '@minecraft/server';
import { CommandBridge } from "../core/bridge.js";
import { http, HttpRequest, HttpRequestMethod, HttpHeader } from '@minecraft/server-net';
import { ActionFormData, MessageFormData } from '@minecraft/server-ui';
import { isModuleEnabled, showForm } from '../core/moduleState.js';
import { getCommandSourceEntity } from '../core/scriptCompat.js';

const WARDEN_API_BASE = 'https://warden-shop-oficial.onrender.com/api/addon';
const API_KEY = 'wsk_1cd4d91926dc7bf1f6790c0d08a3e50e43b770ba411758bcf29a534798860c74370e3b1c6560f95942c15505b4bcd1b8';

class WardenShop {
    constructor() {
        this.processingPlayers = new Set();
    }

    async openRescueGUI(player) {
        if (player.hasTag('pvp_off')) {
            const form = new MessageFormData()
                .title('§c§l⚠ Zona Segura')
                .body('§ePara sua segurança, resgate seus itens fora do spawn ou zonas protegidas.')
                .button1('§aEntendido');
            await showForm(form, player);
            return;
        }

        player.sendMessage('§7[Warden Shop] Buscando seus pedidos...');
        
        try {
            const [itemsData, kitsData] = await Promise.all([
                this.fetchGET('pending-items'),
                this.fetchGET('kit-orders')
            ]);

            // FILTRAGEM: Removemos itens que começam com [SLOT, pois eles fazem parte de um kit completo
            // O Minecraft Bedrock retorna player.name com espaços se o jogador tiver.
            const normalItems = (itemsData.items ?? []).filter(i => 
                i.minecraftNickname?.toLowerCase()?.trim() === player.name.toLowerCase()?.trim() &&
                !i.productName.startsWith('[SLOT')
            );
            
            const kitOrders = (kitsData.orders ?? []).filter(o => 
                o.nickname?.toLowerCase()?.trim() === player.name.toLowerCase()?.trim()
            );

            if (normalItems.length === 0 && kitOrders.length === 0) {
                player.sendMessage('§eNenhum item pendente encontrado para o nick: §f' + player.name);
                return;
            }

            const form = new ActionFormData()
                .title('§6Warden Shop')
                .body(`§aOlá ${player.name}, você tem itens para resgatar:`);

            const allOptions = [];

            // Adiciona opção para resgatar todos os kits se houver mais de um
            if (kitOrders.length > 1) {
                form.button(`§bResgatar TODOS os Kits Pendentes\n§8(${kitOrders.length} kits)`);
                allOptions.push({ type: 'all_kits', data: kitOrders });
            }

            // Adiciona itens normais (produtos que não são kits personalizados)
            for (const item of normalItems) {
                form.button(`§e${item.productName}\n§8[Loja] Clique para receber`);
                allOptions.push({ type: 'normal', data: item });
            }

            // Adiciona os kits personalizados individualmente
            for (const kit of kitOrders) {
                form.button(`§bKit Personalizado\n§8${kit.orderNumber} - Clique para receber`);
                allOptions.push({ type: 'kit', data: kit });
            }

            const response = await showForm(form, player);
            if (response.canceled) return;

            const selected = allOptions[response.selection];
            if (selected.type === 'normal') {
                this.deliverNormalItem(player, selected.data);
            } else if (selected.type === 'kit') {
                this.deliverKitOrder(player, selected.data);
            } else if (selected.type === 'all_kits') {
                this.deliverAllPendingKits(player, selected.data);
            }

        } catch (e) {
            console.error(`[WardenShop] Excecao: ${e}`);
            player.sendMessage('§cOcorreu um erro ao processar o resgate.');
        }
    }

    async fetchGET(endpoint) {
        const url = `${WARDEN_API_BASE}/${endpoint}?apiKey=${encodeURIComponent(API_KEY)}`;
        const req = new HttpRequest(url);
        req.method = HttpRequestMethod.Get;
        const res = await http.request(req);
        if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
        return JSON.parse(res.body);
    }

    async fetchPOST(endpoint, body) {
        const req = new HttpRequest(`${WARDEN_API_BASE}/${endpoint}`);
        req.method = HttpRequestMethod.Post;
        req.headers = [new HttpHeader('Content-Type', 'application/json')];
        req.body = JSON.stringify({ ...body, apiKey: API_KEY });
        const res = await http.request(req);
        if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
        return JSON.parse(res.body);
    }

    async deliverNormalItem(player, item) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            const commands = item.commands ?? [];
            for (const cmd of commands) {
                // No Bedrock, nomes com espaços PRECISAM de aspas duplas, ex: "Nome Com Espaço"
                const finalCmd = cmd.replace(/{player}/g, `"${player.name}"`);
                world.getDimension('overworld').runCommand(finalCmd);
            }

            await this.fetchPOST('mark-item-delivered', { itemId: item.itemId });
            player.sendMessage('§a[Warden] Item resgatado com sucesso!');
            player.playSound('random.levelup');
        } catch (e) {
            player.sendMessage('§cErro ao entregar o item.');
        } finally {
            this.processingPlayers.delete(player.name);
        }
    }

    async deliverKitOrder(player, kit) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            player.sendMessage('§7[Warden] Criando sua Shulker Box personalizada...');
            
            const dim = player.dimension;
            const loc = player.location;
            const pos = {
                x: Math.floor(loc.x),
                y: Math.floor(loc.y),
                z: Math.floor(loc.z),
            };

            dim.runCommand(`setblock ${pos.x} ${pos.y} ${pos.z} minecraft:purple_shulker_box replace`);

            system.runTimeout(() => {
                try {
                    const block = dim.getBlock(pos);
                    const container = block?.getComponent('minecraft:inventory')?.container;

                    if (!container) {
                        player.sendMessage('§cErro ao acessar a Shulker Box.');
                        this.processingPlayers.delete(player.name);
                        return;
                    }

                    let placedCount = 0;
                    for (const slot of (kit.kitSlots ?? [])) {
                        try {
                            const itemId = slot.minecraftId.includes(':') ? slot.minecraftId : `minecraft:${slot.minecraftId}`;
                            const itemStack = new ItemStack(itemId, Math.max(1, slot.quantity));

                            if (slot.enchants && slot.enchants.length > 0) {
                                const enchantable = itemStack.getComponent('minecraft:enchantable');
                                if (enchantable) {
                                    for (const ench of slot.enchants) {
                                        try {
                                            const type = EnchantmentTypes.get(ench.id);
                                            if (type) enchantable.addEnchantment({ type: type, level: ench.level });
                                        } catch(e) {}
                                    }
                                }
                            }

                            const targetSlot = (slot.slot >= 0 && slot.slot < container.size) ? slot.slot : placedCount;
                            container.setItem(targetSlot, itemStack);
                            placedCount++;
                        } catch (e) {}
                    }

                    if (placedCount > 0) {
                        this.fetchPOST('mark-delivered', { orderId: kit.id });
                        player.sendMessage('§a[Warden] Kit entregue na Shulker Box roxa aos seus pés!');
                        player.playSound('random.levelup');
                    }
                } catch (e) {
                    player.sendMessage('§cErro ao preencher a Shulker Box.');
                } finally {
                    this.processingPlayers.delete(player.name);
                }
            }, 10);

        } catch (e) {
            player.sendMessage('§cErro ao gerar o kit.');
            this.processingPlayers.delete(player.name);
        }
    }

    async deliverAllPendingKits(player, kits) {
        if (this.processingPlayers.has(player.name)) return;
        this.processingPlayers.add(player.name);

        try {
            player.sendMessage(`§7[Warden] Resgatando ${kits.length} kits...`);
            for (const kit of kits) {
                await this.deliverKitOrder(player, kit);
                player.sendMessage(`§a[Warden] Kit ${kit.orderNumber} resgatado.`);
                // Pequeno delay para evitar sobrecarga ou problemas de sincronização
                await new Promise(resolve => system.runTimeout(resolve, 5));
            }
            player.sendMessage('§a[Warden] Todos os kits pendentes foram resgatados!');
            player.playSound('random.levelup');
        } catch (e) {
            player.sendMessage('§cOcorreu um erro ao resgatar todos os kits.');
            console.error(`[WardenShop] Erro ao resgatar todos os kits: ${e}`);
        } finally {
            this.processingPlayers.delete(player.name);
        }
    }
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    CommandBridge.register("resgatar", (player, args) => {
        if (!isModuleEnabled("warden")) {
            player.sendMessage("§c[Warden] O sistema de loja está desativado no momento.");
            return;
        }
        wardenShopInstance.openRescueGUI(player);
    });
    
    if (!customCommandRegistry) return;
    try {
        customCommandRegistry.registerCommand(
            { 
                name: 'warden:resgatar', 
                description: 'Abre o menu de resgate da loja Warden', 
                permissionLevel: CommandPermissionLevel.Any 
            },
            (origin) => {
                const player = getCommandSourceEntity(origin);
                if (player) {
                    system.run(() => {
                        if (!isModuleEnabled('warden')) {
                            player.sendMessage('§cLoja desativada.');
                            return;
                        }
                        wardenShopInstance.openRescueGUI(player);
                    });
                }
                return { status: CustomCommandStatus.Success };
            }
        );
    } catch (e) {}
});

const wardenShopInstance = new WardenShop();
