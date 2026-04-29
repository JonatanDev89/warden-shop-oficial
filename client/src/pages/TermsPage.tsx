import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function TermsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Termos de Uso</h1>
              <p className="text-sm text-muted-foreground mt-1">Warden Shop</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <div className="space-y-8 text-sm leading-relaxed">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-bold mb-4">1. IDENTIFICAÇÃO</h2>
              <p className="text-muted-foreground mb-3">
                A Warden Shop é uma loja virtual independente responsável pela comercialização de benefícios digitais utilizados exclusivamente no servidor Warden Craft.
              </p>
              <p className="text-muted-foreground">
                Esta loja não possui qualquer vínculo, afiliação ou parceria com a Mojang Studios ou Microsoft.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-bold mb-4">2. NATUREZA DOS PRODUTOS</h2>
              <p className="text-muted-foreground mb-3">
                Todos os produtos disponibilizados são bens digitais, incluindo:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                <li>Kits</li>
                <li>Itens virtuais</li>
                <li>Benefícios VIP</li>
                <li>Vantagens dentro do servidor</li>
              </ul>
              <p className="text-muted-foreground mb-2">Os produtos:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Não possuem valor monetário fora do ambiente virtual</li>
                <li>Não podem ser transferidos, revendidos ou convertidos em dinheiro real</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-bold mb-4">3. PROCESSAMENTO E ENTREGA</h2>
              <p className="text-muted-foreground mb-3">
                A entrega dos produtos ocorre após a confirmação do pagamento, podendo ser:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Automática (via sistema)</li>
                <li>Manual (pela equipe)</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                O prazo pode variar conforme o método de pagamento e disponibilidade do servidor.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-bold mb-4">4. DIREITO DE ARREPENDIMENTO</h2>
              <p className="text-muted-foreground mb-3">
                De acordo com o Código de Defesa do Consumidor, o direito de arrependimento pode ser aplicado em compras online.
              </p>
              <p className="text-muted-foreground mb-3">
                No entanto, ao adquirir um produto digital com entrega imediata, o cliente:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Concorda com a execução imediata do serviço</li>
                <li>Renuncia expressamente ao direito de arrependimento após a entrega</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-bold mb-4">5. POLÍTICA DE REEMBOLSO</h2>
              <p className="text-muted-foreground mb-3">
                Não realizamos reembolsos após a entrega do produto digital.
              </p>
              <p className="text-muted-foreground mb-2">Exceções:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                <li>Falha comprovada na entrega</li>
                <li>Erro técnico causado pelo sistema da loja</li>
                <li>Cobrança duplicada</li>
              </ul>
              <p className="text-muted-foreground">
                Solicitações devem ser feitas via suporte.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-bold mb-4">6. CHARGEBACK E FRAUDE</h2>
              <p className="text-muted-foreground mb-3">
                A abertura de chargeback ou disputa indevida resultará em:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                <li>Suspensão imediata da conta no servidor</li>
                <li>Banimento permanente</li>
                <li>Bloqueio de futuras compras</li>
              </ul>
              <p className="text-muted-foreground">
                A loja se reserva o direito de apresentar provas da entrega e uso do produto junto às operadoras de pagamento.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-bold mb-4">7. RESPONSABILIDADE DO CLIENTE</h2>
              <p className="text-muted-foreground mb-3">
                O cliente é integralmente responsável por:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Informar corretamente seu nickname</li>
                <li>Garantir o uso da conta correta</li>
                <li>Cumprir as regras do servidor</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Erros de digitação não serão passíveis de reembolso.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-bold mb-4">8. BANIMENTOS</h2>
              <p className="text-muted-foreground mb-3">
                Caso o jogador seja punido ou banido:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Todos os produtos adquiridos serão perdidos</li>
                <li>Não haverá reembolso</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-bold mb-4">9. ALTERAÇÃO DE PRODUTOS</h2>
              <p className="text-muted-foreground mb-3">
                Os produtos podem ser alterados, balanceados ou removidos a qualquer momento para manter o equilíbrio do servidor.
              </p>
              <p className="text-muted-foreground mb-2">Isso inclui:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Ajustes em kits</li>
                <li>Mudança em vantagens</li>
                <li>Remoção de benefícios</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-bold mb-4">10. DISPONIBILIDADE DO SERVIDOR</h2>
              <p className="text-muted-foreground mb-3">
                O servidor pode sofrer:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                <li>Manutenções</li>
                <li>Instabilidades</li>
                <li>Interrupções temporárias</li>
              </ul>
              <p className="text-muted-foreground">
                Não há garantia de disponibilidade contínua (24/7).
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-xl font-bold mb-4">11. PROPRIEDADE INTELECTUAL</h2>
              <p className="text-muted-foreground mb-3">
                Todos os elementos do servidor e loja pertencem à equipe Warden Craft.
              </p>
              <p className="text-muted-foreground">
                O uso indevido de conteúdo poderá resultar em medidas legais.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-xl font-bold mb-4">12. PRIVACIDADE E DADOS (LGPD)</h2>
              <p className="text-muted-foreground mb-3">
                Os dados coletados são utilizados exclusivamente para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
                <li>Processamento de pagamentos</li>
                <li>Entrega dos produtos</li>
                <li>Comunicação com o cliente</li>
              </ul>
              <p className="text-muted-foreground">
                Não compartilhamos dados com terceiros, salvo quando necessário para processamento de pagamento.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="text-xl font-bold mb-4">13. LIMITAÇÃO DE RESPONSABILIDADE</h2>
              <p className="text-muted-foreground mb-3">
                A Warden Shop não se responsabiliza por:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Perda de acesso à conta do jogador</li>
                <li>Problemas causados por terceiros</li>
                <li>Instabilidades externas (internet, serviços, etc.)</li>
              </ul>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="text-xl font-bold mb-4">14. MODIFICAÇÕES DOS TERMOS</h2>
              <p className="text-muted-foreground">
                Estes termos podem ser alterados a qualquer momento sem aviso prévio. É responsabilidade do usuário revisá-los periodicamente.
              </p>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="text-xl font-bold mb-4">15. ACEITAÇÃO DOS TERMOS</h2>
              <p className="text-muted-foreground mb-3">
                Ao realizar uma compra, o cliente declara que:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Leu e concorda com todos os termos</li>
                <li>Está ciente da natureza digital dos produtos</li>
                <li>Reconhece que não há vínculo com a Mojang Studios</li>
              </ul>
            </section>

            {/* Section 16 */}
            <section>
              <h2 className="text-xl font-bold mb-4">16. SUPORTE</h2>
              <p className="text-muted-foreground">
                O suporte oficial é realizado exclusivamente via Discord do servidor Warden Craft.
              </p>
            </section>
          </div>
        </div>

        {/* Footer Action */}
        <div className="max-w-3xl mx-auto mt-12 pt-8 border-t border-border">
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar para Loja
            </Button>
            <Button onClick={() => window.close()}>
              Entendi os Termos
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
