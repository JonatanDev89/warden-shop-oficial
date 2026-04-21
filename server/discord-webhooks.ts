import { getActiveWebhooksByType } from './db';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar webhook Discord:', error);
    return false;
  }
}

function applyVariables(template: string, order: any): string {
  return template
    .replace(/\{nick\}/g, order.minecraftNickname ?? '')
    .replace(/\{pedido\}/g, order.orderNumber ?? '')
    .replace(/\{total\}/g, `R$ ${parseFloat(String(order.total)).toFixed(2)}`)
    .replace(/\{email\}/g, order.email ?? '')
    .replace(/\{data\}/g, new Date().toLocaleString('pt-BR'))
    .replace(/\{status\}/g, order.status ?? '');
}

export async function notifyPendingOrder(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgPendente ? applyVariables(webhook.msgPendente, order) : null;
    const embed: DiscordEmbed = {
      title: '📋 Pedido Pendente',
      description: customMsg ?? 'Novo pedido aguardando aprovação do administrador',
      color: 0xFFA500,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderAccepted(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgAceito ? applyVariables(webhook.msgAceito, order) : null;
    const embed: DiscordEmbed = {
      title: '✅ Pedido Aceito',
      description: customMsg ?? 'Pedido aprovado e pronto para entrega no jogo',
      color: 0x00FF00,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Aprovação', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderRejected(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgRecusado ? applyVariables(webhook.msgRecusado, order) : null;
    const embed: DiscordEmbed = {
      title: '❌ Pedido Recusado',
      description: customMsg ?? 'Pedido foi recusado pelo administrador',
      color: 0xFF0000,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Recusa', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderDelivered(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgEntregue ? applyVariables(webhook.msgEntregue, order) : null;
    const embed: DiscordEmbed = {
      title: '🎁 Pedido Entregue',
      description: customMsg ?? 'Pedido foi entregue com sucesso no jogo!',
      color: 0x0099FF,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Entrega', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderDeleted(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgDeletado ? applyVariables(webhook.msgDeletado, order) : null;
    const embed: DiscordEmbed = {
      title: '🗑️ Pedido Deletado',
      description: customMsg ?? 'Pedido foi removido do sistema',
      color: 0x888888,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function sendDeliveryReceipt(order: any) {
  if (order.status !== 'delivered') return;
  const webhooks = await getActiveWebhooksByType('receipt');
  if (!webhooks?.length) return;
  for (const webhook of webhooks) {
    const customMsg = webhook.msgEntregue ? applyVariables(webhook.msgEntregue, order) : null;
    const embed: DiscordEmbed = {
      title: '🎁 Comprovante de Entrega',
      description: customMsg ?? 'Pedido entregue com sucesso no jogo!',
      color: 0x00FF00,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Entrega', value: new Date().toLocaleString('pt-BR'), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}
