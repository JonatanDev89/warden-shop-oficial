# Warden Shop — TODO

## Schema & Backend
- [x] Schema: categories, products, orders, order_items, coupons, api_keys, webhooks, site_settings
- [x] DB helpers: getDb queries para todas as entidades
- [x] tRPC routers: shop (público), admin (protegido por role=admin)
- [x] Seed inicial: categorias e produto de exemplo

## Páginas Públicas
- [x] Layout global com Navbar (logo, links, busca, login) e banner de anúncio de cupom
- [x] Home: hero banner, seção de categorias, top compradores, FAQ
- [x] Listagem de produtos por categoria (nome, preço, estoque, botão comprar)
- [x] Página de detalhes do produto (descrição, conteúdo do kit, botão "Comprar Agora")
- [x] Busca de produtos por nome/descrição
- [x] Checkout: nickname Minecraft, e-mail, cupom de desconto, resumo do pedido
- [x] Página de confirmação do pedido com próximos passos

## Painel Admin
- [x] Layout admin com sidebar (Dashboard, Pedidos, Produtos, Categorias, Cupons, Webhooks, Personalização, API Keys, Gerenciar Admins)
- [x] Dashboard: cards (total pedidos, receita, produtos, categorias), gráfico de status, gráfico tendência de vendas
- [x] Gerenciamento de Pedidos (CRUD + mudança de status: pending/confirmed/delivered/cancelled)
- [x] Gerenciamento de Produtos (CRUD: nome, descrição, preço, estoque, categoria, conteúdo do kit)
- [x] Gerenciamento de Categorias (CRUD)
- [x] Gerenciamento de Cupons (CRUD: código, tipo desconto, valor, ativo/inativo)
- [x] Webhooks Discord (dois destinos: comprovante e notificação, com ativar/desativar)
- [x] Personalização do site (nome, descrição, hero título, hero subtítulo, bg URL, logo URL, texto anúncio, cupom anúncio)
- [x] API Keys (listar, criar, revogar, excluir)
- [x] Gerenciar Admins (listar usuários admin, adicionar por e-mail, remover)

## Integrações
- [x] Envio de webhook Discord ao criar pedido (comprovante + notificação)
- [x] Aplicação de cupom de desconto no checkout
- [x] Ranking de top compradores calculado dinamicamente

## Testes
- [x] Testes vitest para routers principais: 13 testes passando (shop + admin + auth)


## Integração Addon Minecraft Bedrock
- [x] Campo `commands` adicionado à tabela orders (migração SQL)
- [x] Helpers de DB para addon: getPendingOrdersForAddon, markOrderAsDelivered, getOrderForAddon
- [x] Router tRPC addon com endpoints: health, getPendingOrders, markDelivered, getOrder
- [x] Autenticação por API Key (SHA-256 hash) para todos endpoints do addon
- [x] Campo de comandos (JSON array) adicionado ao dialog de detalhes do pedido no admin
- [x] Testes Vitest para addon router (7 testes passando)
- [x] Documentação completa: ADDON_INTEGRATION.md


## Melhorias Recentes (Nova Sessão)
- [x] Separar notificações Discord em três tipos: Pedido Pendente, Pedido Aceito, Pedido Entregue
- [x] Remover email do player no comprovante de entrega (privacidade)
- [x] Adicionar mais opções de personalização no painel admin (chave PIX, descrição, cores)
- [x] Integrar chave PIX do painel no checkout


## Melhorias - Tela de Confirmação e Resgate
- [x] Exibir chave PIX na tela de confirmação para copiar
- [x] Implementar polling de status do pedido em tempo real
- [x] Criar pop-up com comando de resgate `/scriptevent warden:resgatar` após aprovação do admin
- [x] Permitir copiar comando com um clique


## Melhorias - Pop-up Global de Resgate
- [x] Remover sistema global de contexto (simplificação)
- [x] Exibir comando de resgate junto com chave PIX na página de confirmação
- [x] Permitir copiar comando e chave PIX com um clique
