import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-bold text-lg mb-4">Warden Shop</h3>
            <p className="text-sm text-muted-foreground">
              A loja oficial do servidor Warden Craft. Adquira kits, itens e benefícios exclusivos.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Links Úteis</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/loja" className="text-primary hover:underline">
                  Loja
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="text-primary hover:underline">
                  API Docs
                </Link>
              </li>
              <li>
                <Link href="/termos" className="text-primary hover:underline">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-bold text-lg mb-4">Suporte</h3>
            <p className="text-sm text-muted-foreground">
              Precisa de ajuda? Entre em contato pelo Discord do servidor Warden Craft.
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; 2026 Warden Shop. Todos os direitos reservados.</p>
          <p>Warden Shop não é afiliado à Mojang Studios ou Microsoft.</p>
        </div>
      </div>
    </footer>
  );
}
