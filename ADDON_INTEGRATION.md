# Integração do Addon Minecraft Bedrock com Warden Shop API

## Visão Geral

O addon Minecraft Bedrock se conecta com a API da Warden Shop para gerenciar pedidos e entregar itens aos jogadores automaticamente.

## Endpoints da API

Todos os endpoints estão disponíveis em `/api/trpc/addon.*`

### 1. Health Check
**Endpoint:** `GET /api/trpc/addon.health`

Verifica se a API está online.

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T22:50:00.000Z",
  "version": "1.0.0"
}
```

### 2. Listar Pedidos Pendentes
**Endpoint:** `GET /api/trpc/addon.getPendingOrders`

Retorna todos os pedidos com status "pending" ou "confirmed" que têm comandos definidos.

**Headers Necessários:**
```
Authorization: Bearer {API_KEY}
```

**Parâmetros (JSON):**
```json
{
  "apiKey": "warden_08917ee8d8d110e99e763492ae5531a0f3640809603ea7fa"
}
```

**Resposta:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "orderNumber": "WS-001",
      "nickname": "Steve",
      "email": "steve@example.com",
      "status": "confirmed",
      "total": 29.90,
      "commands": [
        "give @p diamond_sword",
        "give @p diamond_pickaxe"
      ],
      "createdAt": "2026-04-17T20:00:00.000Z"
    }
  ],
  "count": 1
}
```

### 3. Marcar Pedido como Entregue
**Endpoint:** `POST /api/trpc/addon.markDelivered`

Marca um pedido como entregue (status = "delivered").

**Headers Necessários:**
```
Authorization: Bearer {API_KEY}
```

**Parâmetros (JSON):**
```json
{
  "apiKey": "warden_08917ee8d8d110e99e763492ae5531a0f3640809603ea7fa",
  "orderId": 1
}
```

**Resposta:**
```json
{
  "success": true,
  "orderId": 1,
  "message": "Pedido #1 marcado como entregue"
}
```

### 4. Obter Detalhes de um Pedido
**Endpoint:** `GET /api/trpc/addon.getOrder`

Retorna detalhes completos de um pedido específico.

**Headers Necessários:**
```
Authorization: Bearer {API_KEY}
```

**Parâmetros (JSON):**
```json
{
  "apiKey": "warden_08917ee8d8d110e99e763492ae5531a0f3640809603ea7fa",
  "orderId": 1
}
```

**Resposta:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "orderNumber": "WS-001",
    "nickname": "Steve",
    "email": "steve@example.com",
    "status": "confirmed",
    "total": 29.90,
    "commands": [
      "give @p diamond_sword",
      "give @p diamond_pickaxe"
    ],
    "createdAt": "2026-04-17T20:00:00.000Z"
  }
}
```

## Autenticação

Todos os endpoints (exceto `/health`) requerem uma **API Key válida e ativa**.

### Gerar uma API Key

1. Acesse o painel admin em `/admin/api-keys`
2. Clique em "Gerar Nova Chave"
3. Dê um nome para a chave (ex: "Addon Minecraft")
4. A chave será exibida uma única vez no formato: `warden_XXXXXXXX...`
5. Copie e guarde em segurança

### Usar a API Key no Addon

No arquivo do addon, configure:

```javascript
const API_KEY = 'warden_08917ee8d8d110e99e763492ae5531a0f3640809603ea7fa';
const WARDEN_API_BASE = 'https://seu-dominio.manus.space/api/trpc';
```

## Fluxo de Entrega de Itens

1. **Jogador compra itens** na loja e faz checkout
2. **Admin cria um pedido** no painel com:
   - Nickname do jogador
   - E-mail do comprador
   - Produtos/itens
   - **Comandos para executar** (ex: `give @p diamond_sword`)
3. **Addon verifica periodicamente** pedidos pendentes via `getPendingOrders`
4. **Quando jogador entra** no servidor, addon avisa sobre pedidos pendentes
5. **Jogador usa** `/scriptevent warden:resgatar` para receber itens
6. **Addon executa os comandos** e marca pedido como entregue

## Formato dos Comandos

Os comandos devem ser um array JSON armazenado no campo `commands` do pedido:

```json
[
  "give @p diamond_sword 1",
  "give @p diamond_pickaxe 1",
  "give @p 64 diamond",
  "effect @p speed 300 2"
]
```

**Placeholder disponível:** `{player}` será substituído pelo nome do jogador
```json
[
  "give {player} diamond_sword 1",
  "give {player} diamond_pickaxe 1"
]
```

## Tratamento de Erros

### Erro 401 - Unauthorized
```json
{
  "error": "UNAUTHORIZED",
  "message": "API Key inválida ou revogada"
}
```

**Solução:** Verifique se a API Key está correta e ativa no painel admin.

### Erro 404 - Not Found
```json
{
  "error": "NOT_FOUND",
  "message": "Pedido #999 não encontrado"
}
```

**Solução:** Verifique se o ID do pedido está correto.

### Erro 500 - Internal Server Error
```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Erro ao processar pedido"
}
```

**Solução:** Verifique os logs do servidor e tente novamente.

## Exemplo de Integração (JavaScript)

```javascript
async function fetchPendingOrders(apiKey) {
  const response = await fetch('https://seu-dominio.manus.space/api/trpc/addon.getPendingOrders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      apiKey: apiKey
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.result.data; // { success, orders, count }
}

async function markOrderDelivered(apiKey, orderId) {
  const response = await fetch('https://seu-dominio.manus.space/api/trpc/addon.markDelivered', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      apiKey: apiKey,
      orderId: orderId
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.result.data; // { success, orderId, message }
}
```

## Configuração no Addon

Atualize o arquivo do addon com:

```javascript
const WARDEN_API_BASE = 'https://seu-dominio.manus.space/api/trpc';
const API_KEY = 'warden_sua_chave_aqui';
```

Substitua:
- `seu-dominio.manus.space` pelo domínio da sua loja Warden Shop
- `warden_sua_chave_aqui` pela API Key gerada no painel admin

## Testando a Integração

1. **Verificar conexão:**
   ```
   curl https://seu-dominio.manus.space/api/trpc/addon.health
   ```

2. **Listar pedidos pendentes:**
   ```bash
   curl -X POST https://seu-dominio.manus.space/api/trpc/addon.getPendingOrders \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer warden_sua_chave_aqui" \
     -d '{"apiKey": "warden_sua_chave_aqui"}'
   ```

3. **No addon, use os comandos:**
   - `/scriptevent warden:status` - Ver status
   - `/scriptevent warden:listar` - Listar pedidos pendentes
   - `/scriptevent warden:resgatar` - Resgatar itens

## Troubleshooting

### Addon não conecta à API
- Verifique se a URL está correta
- Verifique se a API Key está ativa
- Verifique se há conexão com a internet
- Ative DEBUG_MODE no addon para ver logs

### Pedidos não aparecem
- Verifique se o pedido tem status "pending" ou "confirmed"
- Verifique se o pedido tem o campo `commands` preenchido
- Verifique se o nickname do jogador está correto

### Comandos não executam
- Verifique se os comandos estão no formato correto
- Verifique se o jogador tem espaço no inventário
- Verifique se o jogador está em local seguro

## Suporte

Para mais informações ou suporte, acesse o painel admin em `/admin` ou entre em contato com o administrador da loja.
