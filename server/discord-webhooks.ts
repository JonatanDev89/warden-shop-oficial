import { getActiveWebhooksByType } from './db';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

async function sendWebhook(webhookUrl: string, message: DiscordMessage): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar webhook Discord:', error);
    return false;
  }
}

/**
 * Notifica quando um novo pedido é criado e aguarda aprovação
 */
export async function notifyPendingOrder(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks || webhooks.length === 0) {
    console.log('[Discord] Sem webhooks de notificação configurados');
    return;
  }

  const embed: DiscordEmbed = {
    title: '📋 Pedido Pendente',
    description: `Novo pedido aguardando aprovação do administrador`,
    color: 0xFFA500, // Orange
    fields: [
      { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
      { name: 'Jogador', value: order.minecraftNickname, inline: true },
      { name: 'Total', value: `R$ ${(typeof order.total === 'string' ? parseFloat(order.total) : order.total).toFixed(2)}`, inline: true },
      { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

/**
 * Notifica quando um pedido é aceito pelo administrador
 */
export async function notifyOrderAccepted(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks || webhooks.length === 0) {
    console.log('[Discord] Sem webhooks de notificação configurados');
    return;
  }

  const embed: DiscordEmbed = {
    title: '✅ Pedido Aceito',
    description: `Pedido aprovado e pronto para entrega no jogo`,
    color: 0x00FF00, // Green
    fields: [
      { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
      { name: 'Jogador', value: order.minecraftNickname, inline: true },
      { name: 'Total', value: `R$ ${(typeof order.total === 'string' ? parseFloat(order.total) : order.total).toFixed(2)}`, inline: true },
      { name: 'Data de Aprovação', value: new Date().toLocaleString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

/**
 * Notifica quando um pedido é rejeitado pelo administrador
 */
export async function notifyOrderRejected(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks || webhooks.length === 0) {
    console.log('[Discord] Sem webhooks de notificação configurados');
    return;
  }

  const embed: DiscordEmbed = {
    title: '❌ Pedido Recusado',
    description: `Pedido foi recusado pelo administrador`,
    color: 0xFF0000, // Red
    fields: [
      { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
      { name: 'Jogador', value: order.minecraftNickname, inline: true },
      { name: 'Total', value: `R$ ${(typeof order.total === 'string' ? parseFloat(order.total) : order.total).toFixed(2)}`, inline: true },
      { name: 'Data de Recusa', value: new Date().toLocaleString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

/**
 * Notifica quando um pedido é entregue com sucesso no jogo
 */
export async function notifyOrderDelivered(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks || webhooks.length === 0) {
    console.log('[Discord] Sem webhooks de notificação configurados');
    return;
  }

  const embed: DiscordEmbed = {
    title: '🎁 Pedido Entregue',
    description: `Pedido foi entregue com sucesso no jogo!`,
    color: 0x0099FF, // Blue
    fields: [
      { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
      { name: 'Jogador', value: order.minecraftNickname, inline: true },
      { name: 'Total', value: `R$ ${(typeof order.total === 'string' ? parseFloat(order.total) : order.total).toFixed(2)}`, inline: true },
      { name: 'Data de Entrega', value: new Date().toLocaleString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

/**
 * Envia comprovante de entrega (sem expor email do jogador)
 * Este webhook é enviado para um canal separado de recibos
 * APENAS quando o pedido é entregue com sucesso
 */
export async function sendDeliveryReceipt(order: any) {
  // Só envia comprovante se o pedido foi entregue
  if (order.status !== 'delivered') {
    console.log(`[Discord] Comprovante não enviado: pedido ${order.orderNumber} não foi entregue (status: ${order.status})`);
    return;
  }

  const webhooks = await getActiveWebhooksByType('receipt');
  if (!webhooks || webhooks.length === 0) {
    console.log('[Discord] Sem webhooks de recibos configurados');
    return;
  }

  const embed: DiscordEmbed = {
    title: '🎁 Comprovante de Entrega',
    description: `Pedido entregue com sucesso no jogo!`,
    color: 0x00FF00, // Green
    fields: [
      { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
      { name: 'Jogador', value: order.minecraftNickname, inline: true },
      { name: 'Total', value: `R$ ${(typeof order.total === 'string' ? parseFloat(order.total) : order.total).toFixed(2)}`, inline: true },
      { name: 'Data de Entrega', value: new Date().toLocaleString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  for (const webhook of webhooks) {
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}
