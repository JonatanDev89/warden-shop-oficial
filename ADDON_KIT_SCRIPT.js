/**
 * WardenShop — Kit Personalizado Script
 * Adicione este código ao seu script do addon Minecraft Bedrock.
 *
 * Como funciona:
 * 1. O addon busca pedidos de kit pendentes via API
 * 2. Para cada pedido, spawna um armor_stand com nameTag "WardenKit_{orderId}"
 * 3. O script detecta o armor_stand, cria uma shulker box com os itens do kit
 * 4. Marca o pedido como entregue
 *
 * CONFIGURAÇÃO:
 */

const WARDEN_API_URL = "https://SEU_DOMINIO.com"; // Troque pela URL da sua loja
const WARDEN_API_KEY = "warden_SUACHAVE";          // Troque pela sua API Key

// ─── Buscar e processar kits pendentes ────────────────────────────────────────
async function processKitOrders() {
  try {
    const res = await fetch(`${WARDEN_API_URL}/api/trpc/addon.getKitOrders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { apiKey: WARDEN_API_KEY } }),
    });
    const data = await res.json();
    const kitOrders = data?.result?.data?.json?.orders ?? [];

    for (const order of kitOrders) {
      // Verificar se o jogador está online
      const player = world.getPlayers().find(
        (p) => p.name.toLowerCase() === order.nickname.toLowerCase()
      );
      if (!player) continue; // Aguarda o jogador entrar

      deliverKitToPlayer(player, order);

      // Marcar como entregue
      await fetch(`${WARDEN_API_URL}/api/trpc/addon.markDelivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { apiKey: WARDEN_API_KEY, orderId: order.id } }),
      });
    }
  } catch (e) {
    console.warn(`[WardenKit] Erro ao processar kits: ${e}`);
  }
}

// ─── Montar shulker box com os itens do kit ───────────────────────────────────
function deliverKitToPlayer(player, order) {
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
      dim.setBlock(pos, "minecraft:purple_shulker_box");
      const block = dim.getBlock(pos);
      const container = block?.getComponent("minecraft:inventory")?.container;
      if (!container) return;

      // Preencher slots com os itens do kit
      for (const slot of order.kitSlots) {
        if (!slot || slot.slot < 0 || slot.slot >= container.size) continue;
        try {
          const itemId = slot.minecraftId.startsWith("minecraft:")
            ? slot.minecraftId
            : `minecraft:${slot.minecraftId}`;
          const item = new ItemStack(itemId, slot.quantity);
          container.setItem(slot.slot, item);
        } catch (e) {
          console.warn(`[WardenKit] Item inválido: ${slot.minecraftId} — ${e}`);
        }
      }

      // Notificar jogador
      player.sendMessage(
        `§a[WardenShop] §fSeu kit personalizado §e${order.orderNumber} §ffoi entregue! Procure a shulker box roxa ao seu lado.`
      );

      console.warn(
        `[WardenKit] Kit ${order.orderNumber} entregue para ${player.name} com ${order.kitSlots.length} itens.`
      );
    } catch (e) {
      console.warn(`[WardenKit] Erro ao entregar kit ${order.orderNumber}: ${e}`);
    }
  });
}

// ─── Gatilho via armor_stand (alternativa manual) ─────────────────────────────
// Se preferir entregar manualmente: spawne um armor_stand com nameTag "WardenKit_{orderId}"
// Ex: /summon armor_stand WardenKit_42 ~ ~ ~
world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e.typeId !== "minecraft:armor_stand") return;
  if (!e.nameTag?.startsWith("WardenKit_")) return;

  const orderId = parseInt(e.nameTag.replace("WardenKit_", ""));
  if (isNaN(orderId)) return;

  system.run(async () => {
    if (!e.isValid()) return;
    const loc = e.location;
    const dim = e.dimension;
    e.kill();

    try {
      const res = await fetch(`${WARDEN_API_URL}/api/trpc/addon.getKitOrders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { apiKey: WARDEN_API_KEY } }),
      });
      const data = await res.json();
      const orders = data?.result?.data?.json?.orders ?? [];
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        console.warn(`[WardenKit] Pedido #${orderId} não encontrado.`);
        return;
      }

      const pos = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
      dim.setBlock(pos, "minecraft:purple_shulker_box");
      const block = dim.getBlock(pos);
      const container = block?.getComponent("minecraft:inventory")?.container;
      if (!container) return;

      for (const slot of order.kitSlots) {
        if (!slot || slot.slot < 0 || slot.slot >= container.size) continue;
        try {
          const itemId = slot.minecraftId.startsWith("minecraft:")
            ? slot.minecraftId
            : `minecraft:${slot.minecraftId}`;
          const item = new ItemStack(itemId, slot.quantity);
          container.setItem(slot.slot, item);
        } catch (e) {
          console.warn(`[WardenKit] Item inválido: ${slot.minecraftId}`);
        }
      }

      // Marcar como entregue
      await fetch(`${WARDEN_API_URL}/api/trpc/addon.markDelivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { apiKey: WARDEN_API_KEY, orderId } }),
      });

      console.warn(`[WardenKit] Kit #${orderId} montado via armor_stand.`);
    } catch (err) {
      console.warn(`[WardenKit] Erro ao processar armor_stand: ${err}`);
    }
  });
});

// ─── Verificar kits a cada 5 minutos ─────────────────────────────────────────
system.runInterval(() => {
  processKitOrders();
}, 20 * 60 * 5); // 20 ticks/s × 60s × 5min
