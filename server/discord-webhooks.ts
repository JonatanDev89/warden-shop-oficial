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
    console.log('[Webhook] Enviando para:', webhookUrl.substring(0, 50) + '...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Webhook] Erro na resposta:', response.status, errorText);
    }
    
    return response.ok;
  } catch (error) {
    console.error('[Webhook] Erro ao enviar webhook Discord:', error);
    return false;
  }
}

function applyVariables(template: string, order: any): string {
  // Calcular valores
  const total = parseFloat(String(order.total || 0));
  const subtotal = parseFloat(String(order.subtotal || total));
  const desconto = subtotal - total;
  
  // Formatar lista de itens
  let itemsList = '';
  if (order.items && Array.isArray(order.items)) {
    itemsList = order.items
      .map((item: any) => `${item.quantity}x ${item.productName || item.name}`)
      .join(', ');
  }
  
  // Quantidade total de itens
  let totalQuantity = 0;
  if (order.items && Array.isArray(order.items)) {
    totalQuantity = order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  }
  
  // Formatar data no horário de Brasília
  // O createdAt vem em UTC do banco, precisamos converter para BRT/BRST (-3h)
  let formattedDate = '';
  if (order.createdAt) {
    const orderDate = new Date(order.createdAt);
    // Converter para horário de Brasília usando Intl.DateTimeFormat
    formattedDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(orderDate);
  } else {
    const now = new Date();
    formattedDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
  }
  
  let result = template;
  
  const replacements: Record<string, string> = {
    '{nick}': order.minecraftNickname ?? '',
    '{pedido}': order.orderNumber ?? '',
    '{total}': `R$ ${total.toFixed(2).replace('.', ',')}`,
    '{email}': order.email ?? '',
    '{data}': formattedDate,
    '{status}': order.status ?? '',
    '{itens}': itemsList || 'Nenhum item',
    '{quantidade}': String(totalQuantity),
    '{cupom}': order.couponCode ?? 'Nenhum',
    '{desconto}': desconto > 0 ? `R$ ${desconto.toFixed(2).replace('.', ',')}` : 'R$ 0,00',
    '{subtotal}': `R$ ${subtotal.toFixed(2).replace('.', ',')}`,
  };

  for (const [key, value] of Object.entries(replacements)) {
    // Usar split/join em vez de regex para evitar problemas com caracteres especiais
    result = result.split(key).join(value);
  }

  return result;
}

export async function notifyPendingOrder(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  
  // Formatar data no horário de Brasília
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(orderDate);
  
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
        { name: 'Data', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderAccepted(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  
  // Formatar data no horário de Brasília
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
  
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
        { name: 'Data de Aprovação', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderRejected(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  
  // Formatar data no horário de Brasília
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
  
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
        { name: 'Data de Recusa', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function notifyOrderDelivered(order: any) {
  console.log('[Webhook] notifyOrderDelivered chamado:', {
    orderNumber: order.orderNumber,
    status: order.status,
    hasOrder: !!order
  });

  const webhooks = await getActiveWebhooksByType('notification');
  console.log('[Webhook] Webhooks de notificação encontrados:', webhooks?.length ?? 0);

  if (!webhooks?.length) {
    console.log('[Webhook] Nenhum webhook de notificação ativo encontrado');
    return;
  }

  // Formatar data no horário de Brasília
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  for (const webhook of webhooks) {
    console.log('[Webhook] Enviando notificação de entrega para:', webhook.url.substring(0, 50) + '...');
    
    const customMsg = webhook.msgEntregue ? applyVariables(webhook.msgEntregue, order) : null;
    const embed: DiscordEmbed = {
      title: '🎁 Pedido Entregue',
      description: customMsg ?? 'Pedido foi entregue com sucesso no jogo!',
      color: 0x0099FF,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Entrega', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    
    const success = await sendWebhook(webhook.url, { embeds: [embed] });
    console.log('[Webhook] Notificação de entrega enviada:', success ? 'sucesso' : 'falhou');
  }
}

export async function notifyOrderDeleted(order: any) {
  const webhooks = await getActiveWebhooksByType('notification');
  if (!webhooks?.length) return;
  
  // Formatar data no horário de Brasília
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
  
  for (const webhook of webhooks) {
    const customMsg = webhook.msgDeletado ? applyVariables(webhook.msgDeletado, order) : null;
    const embed: DiscordEmbed = {
      title: '🗑️ Pedido Deletado',
      description: customMsg ?? 'Pedido foi removido do sistema',
      color: 0x888888,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Data', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    await sendWebhook(webhook.url, { embeds: [embed] });
  }
}

export async function sendDeliveryReceipt(order: any) {
  console.log('[Webhook] sendDeliveryReceipt chamado:', {
    orderNumber: order.orderNumber,
    status: order.status,
    hasOrder: !!order
  });

  if (order.status !== 'delivered') {
    console.log('[Webhook] Comprovante não enviado - status não é "delivered":', order.status);
    return;
  }

  const webhooks = await getActiveWebhooksByType('receipt');
  console.log('[Webhook] Webhooks de comprovante encontrados:', webhooks?.length ?? 0);

  if (!webhooks?.length) {
    console.log('[Webhook] Nenhum webhook de comprovante ativo encontrado');
    return;
  }

  // Formatar data no horário de Brasília
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  for (const webhook of webhooks) {
    console.log('[Webhook] Enviando comprovante para:', webhook.url.substring(0, 50) + '...');
    
    const customMsg = webhook.msgEntregue ? applyVariables(webhook.msgEntregue, order) : null;
    const embed: DiscordEmbed = {
      title: '🎁 Comprovante de Entrega',
      description: customMsg ?? 'Pedido entregue com sucesso no jogo!',
      color: 0x00FF00,
      fields: customMsg ? [] : [
        { name: 'Número do Pedido', value: `#${order.orderNumber}`, inline: true },
        { name: 'Jogador', value: order.minecraftNickname, inline: true },
        { name: 'Total', value: `R$ ${parseFloat(String(order.total)).toFixed(2)}`, inline: true },
        { name: 'Data de Entrega', value: formattedDate, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    
    const success = await sendWebhook(webhook.url, { embeds: [embed] });
    console.log('[Webhook] Comprovante enviado:', success ? 'sucesso' : 'falhou');
  }
}
