import { useState } from "react";
import ShopLayout from "@/components/ShopLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Copy, Check, ExternalLink, Lock, Globe } from "lucide-react";
import { toast } from "sonner";

export default function ApiDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copiado!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative bg-muted rounded-lg p-4 border border-border">
      <pre className="text-sm text-foreground overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        className="absolute top-2 right-2 p-2 bg-primary/20 hover:bg-primary/30 rounded transition-colors"
      >
        {copiedCode === id ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4 text-primary" />
        )}
      </button>
    </div>
  );

  const EndpointCard = ({
    method,
    path,
    title,
    description,
    auth,
    params,
    response,
    example,
  }: {
    method: string;
    path: string;
    title: string;
    description: string;
    auth?: boolean;
    params?: string;
    response: string;
    example: string;
  }) => {
    const methodColors: Record<string, string> = {
      GET: "bg-blue-500/20 text-blue-400",
      POST: "bg-green-500/20 text-green-400",
      PUT: "bg-yellow-500/20 text-yellow-400",
      DELETE: "bg-red-500/20 text-red-400",
    };

    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className={methodColors[method]}>{method}</Badge>
                <code className="text-sm font-mono text-primary">{path}</code>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            {auth && (
              <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                <Lock className="h-3 w-3" />
                Requer Auth
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {params && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Parâmetros:</h4>
              <CodeBlock code={params} id={`params-${path}`} />
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Resposta:</h4>
            <CodeBlock code={response} id={`response-${path}`} />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Exemplo:</h4>
            <CodeBlock code={example} id={`example-${path}`} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ShopLayout>
      <div className="min-h-screen py-12">
        <div className="container max-w-4xl">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Code2 className="h-6 w-6 text-primary" />
              </div>
              <h1
                className="text-4xl font-bold text-foreground"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                API Documentation
              </h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Integre a Warden Shop com seu servidor Minecraft Bedrock via tRPC API.
            </p>
          </div>

          {/* Base URL */}
          <Card className="bg-card border-border mb-8">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code="https://wardenshop-8k5n6vk7.manus.space/api/trpc"
                id="base-url"
              />
              <p className="text-xs text-muted-foreground mt-3">
                Todos os endpoints são acessados via tRPC. Substitua o domínio pelo seu próprio.
              </p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="public" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="public">Público</TabsTrigger>
              <TabsTrigger value="addon">Addon Minecraft</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            {/* Public Endpoints */}
            <TabsContent value="public" className="space-y-6">
              <div className="space-y-2 mb-6">
                <h2 className="text-2xl font-bold text-foreground">Endpoints Públicos</h2>
                <p className="text-muted-foreground">
                  Endpoints sem autenticação para consultar produtos, categorias e cupons.
                </p>
              </div>

              <EndpointCard
                method="GET"
                path="/shop.getSettings"
                title="Obter Configurações da Loja"
                description="Retorna as configurações gerais do site (nome, logo, hero, etc.)"
                response={`{
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBgUrl: string;
  announcementText: string;
  announcementCoupon: string;
  glowIntensity: string;
  glowColor: string;
  wardenGifUrl: string;
}`}
                example={`// JavaScript/TypeScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.getSettings'
);
const settings = await response.json();
console.log(settings.result.data);`}
              />

              <EndpointCard
                method="GET"
                path="/shop.getCategories"
                title="Listar Categorias"
                description="Retorna todas as categorias de produtos com imagens e descrições."
                response={`{
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
}[]`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.getCategories'
);
const categories = await response.json();
categories.result.data.forEach(cat => {
  console.log(\`\${cat.name}: \${cat.description}\`);
});`}
              />

              <EndpointCard
                method="GET"
                path="/shop.getProducts"
                title="Listar Produtos"
                description="Retorna todos os produtos com preço, estoque e descrição."
                response={`{
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  commands: string | null;
  active: boolean;
}[]`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.getProducts'
);
const products = await response.json();
products.result.data.forEach(p => {
  console.log(\`\${p.name} - R$ \${p.price}\`);
});`}
              />

              <EndpointCard
                method="GET"
                path="/shop.searchProducts?query=..."
                title="Buscar Produtos"
                description="Busca produtos por nome ou descrição."
                params={`query: string (obrigatório)
  - Mínimo 2 caracteres
  - Busca em nome e descrição`}
                response={`{
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
}[]`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.searchProducts?input={"query":"kit"}'
);
const results = await response.json();
console.log(results.result.data);`}
              />

              <EndpointCard
                method="POST"
                path="/shop.validateCoupon"
                title="Validar Cupom"
                description="Valida um cupom e retorna o desconto em porcentagem."
                params={`{
  code: string
}`}
                response={`{
  valid: boolean;
  discount: number; // 0-100
  message: string;
}`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.validateCoupon',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'DESCONTO10' })
  }
);
const result = await response.json();
console.log(\`Desconto: \${result.result.data.discount}%\`);`}
              />

              <EndpointCard
                method="POST"
                path="/shop.createOrder"
                title="Criar Pedido"
                description="Cria um novo pedido com itens e informações do comprador."
                params={`{
  minecraftNickname: string;
  email: string;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  couponCode?: string;
}`}
                response={`{
  id: number;
  status: "pending" | "confirmed" | "delivered";
  totalPrice: number;
  discountApplied: number;
  createdAt: Date;
}`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/shop.createOrder',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      minecraftNickname: 'Player123',
      email: 'player@example.com',
      items: [{ productId: 1, quantity: 1 }],
      couponCode: 'DESCONTO10'
    })
  }
);
const order = await response.json();
console.log(\`Pedido criado: #\${order.result.data.id}\`);`}
              />
            </TabsContent>

            {/* Addon Endpoints */}
            <TabsContent value="addon" className="space-y-6">
              <div className="space-y-2 mb-6">
                <h2 className="text-2xl font-bold text-foreground">Endpoints do Addon Minecraft</h2>
                <p className="text-muted-foreground">
                  Endpoints para integração com o addon Minecraft Bedrock. Requerem API Key.
                </p>
              </div>

              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-yellow-400">
                    <strong>Autenticação:</strong> Todos os endpoints do addon requerem um header{" "}
                    <code className="bg-muted px-2 py-1 rounded">Authorization: Bearer YOUR_API_KEY</code>
                  </p>
                </CardContent>
              </Card>

              <EndpointCard
                method="GET"
                path="/addon.health"
                title="Health Check"
                description="Verifica se a API está online e respondendo."
                auth
                response={`{
  status: "ok";
  timestamp: string;
}`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/addon.health',
  {
    headers: {
      'Authorization': 'Bearer warden_xxxxx...'
    }
  }
);
const health = await response.json();
console.log(health.result.data.status);`}
              />

              <EndpointCard
                method="GET"
                path="/addon.getPendingOrders"
                title="Obter Pedidos Pendentes"
                description="Retorna todos os pedidos com status 'pending' ou 'confirmed' que precisam ser entregues."
                auth
                response={`{
  id: number;
  minecraftNickname: string;
  email: string;
  status: "pending" | "confirmed";
  totalPrice: number;
  commands: string; // JSON array de comandos
  createdAt: Date;
}[]`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/addon.getPendingOrders',
  {
    headers: {
      'Authorization': 'Bearer warden_xxxxx...'
    }
  }
);
const orders = await response.json();
orders.result.data.forEach(order => {
  const commands = JSON.parse(order.commands);
  console.log(\`Entregar a \${order.minecraftNickname}: \${commands}\`);
});`}
              />

              <EndpointCard
                method="POST"
                path="/addon.markDelivered"
                title="Marcar Pedido como Entregue"
                description="Marca um pedido como 'delivered' após executar os comandos no servidor."
                auth
                params={`{
  orderId: number
}`}
                response={`{
  success: boolean;
  message: string;
}`}
                example={`// JavaScript
const response = await fetch(
  'https://wardenshop-8k5n6vk7.manus.space/api/trpc/addon.markDelivered',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer warden_xxxxx...'
    },
    body: JSON.stringify({ orderId: 123 })
  }
);
const result = await response.json();
console.log(result.result.data.message);`}
              />
            </TabsContent>

            {/* Admin Endpoints */}
            <TabsContent value="admin" className="space-y-6">
              <div className="space-y-2 mb-6">
                <h2 className="text-2xl font-bold text-foreground">Endpoints Admin</h2>
                <p className="text-muted-foreground">
                  Endpoints protegidos para gerenciar a loja. Requerem autenticação OAuth e papel admin.
                </p>
              </div>

              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-red-400">
                    <strong>Segurança:</strong> Estes endpoints requerem autenticação OAuth (session cookie) e
                    papel <code className="bg-muted px-2 py-1 rounded">admin</code>. Acesse via navegador
                    autenticado.
                  </p>
                </CardContent>
              </Card>

              <EndpointCard
                method="GET"
                path="/admin.getSettings"
                title="Obter Configurações"
                description="Retorna todas as configurações do site para edição."
                auth
                response={`{
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBgUrl: string;
  announcementText: string;
  announcementCoupon: string;
  glowIntensity: string;
  glowColor: string;
  wardenGifUrl: string;
}`}
                example={`// Acesse em /admin/personalizacao`}
              />

              <EndpointCard
                method="POST"
                path="/admin.saveSettings"
                title="Salvar Configurações"
                description="Salva as configurações do site."
                auth
                params={`{
  storeName?: string;
  storeDescription?: string;
  logoUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroBgUrl?: string;
  announcementText?: string;
  announcementCoupon?: string;
  glowIntensity?: string;
  glowColor?: string;
  wardenGifUrl?: string;
}`}
                response={`{ success: boolean }`}
                example={`// Acesse em /admin/personalizacao`}
              />

              <EndpointCard
                method="GET"
                path="/admin.getOrders"
                title="Listar Pedidos"
                description="Retorna todos os pedidos com filtros opcionais."
                auth
                response={`{
  id: number;
  minecraftNickname: string;
  email: string;
  status: "pending" | "confirmed" | "delivered";
  totalPrice: number;
  discountApplied: number;
  commands: string;
  createdAt: Date;
}[]`}
                example={`// Acesse em /admin/pedidos`}
              />

              <EndpointCard
                method="POST"
                path="/admin.updateOrderStatus"
                title="Atualizar Status do Pedido"
                description="Muda o status de um pedido."
                auth
                params={`{
  orderId: number;
  status: "pending" | "confirmed" | "delivered";
}`}
                response={`{ success: boolean }`}
                example={`// Acesse em /admin/pedidos`}
              />

              <EndpointCard
                method="POST"
                path="/admin.createProduct"
                title="Criar Produto"
                description="Cria um novo produto na loja."
                auth
                params={`{
  categoryId: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
  commands?: string;
}`}
                response={`{ id: number; success: boolean }`}
                example={`// Acesse em /admin/produtos`}
              />

              <EndpointCard
                method="POST"
                path="/admin.updateProduct"
                title="Atualizar Produto"
                description="Atualiza um produto existente."
                auth
                params={`{
  productId: number;
  categoryId?: number;
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
  commands?: string;
  active?: boolean;
}`}
                response={`{ success: boolean }`}
                example={`// Acesse em /admin/produtos`}
              />

              <EndpointCard
                method="POST"
                path="/admin.deleteProduct"
                title="Deletar Produto"
                description="Remove um produto da loja."
                auth
                params={`{
  productId: number
}`}
                response={`{ success: boolean }`}
                example={`// Acesse em /admin/produtos`}
              />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <Card className="bg-card border-border mt-12">
            <CardHeader>
              <CardTitle className="text-base">Precisa de Ajuda?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para dúvidas sobre integração, visite nosso Discord ou consulte a documentação do addon.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Discord
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Documentação do Addon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}
