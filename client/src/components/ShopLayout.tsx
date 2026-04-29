import { trpc } from "@/lib/trpc";
import { Search, ShoppingBag, Sword, Menu, X, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

import MonthlyGoal from "@/components/MonthlyGoal";

interface ShopLayoutProps {
  children: React.ReactNode;
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const s = settings as Record<string, string> | undefined;
  const storeName = s?.storeName ?? "Warden Shop";
  const announcementText = s?.announcementText ?? "";
  const announcementCoupon = s?.announcementCoupon ?? "";
  const logoUrl = s?.logoUrl ?? "";
  const fontFamily = s?.fontFamily ?? "'Inter', sans-serif";
  const isAdmin = user?.role === "admin";

  // Feature flags
  const flag = (key: string) => (s?.[key] ?? "true") !== "false";
  const featureSearch       = flag("featureSearch");
  const featureAnnouncement = flag("featureAnnouncement");
  const featureKitBuilder   = flag("featureKitBuilder");
  const featureMonthlyGoal  = flag("featureMonthlyGoal");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily }}>
      {/* Announcement Banner */}
      {featureAnnouncement && announcementText && (
        <div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4 font-medium">
          {announcementText}
          {announcementCoupon && (
            <span className="ml-2 bg-primary-foreground/20 px-2 py-0.5 rounded font-mono font-bold">
              {announcementCoupon}
            </span>
          )}
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-8 w-8 object-contain" />
              ) : (
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                  <Sword className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div className="block">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-base sm:text-lg text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {storeName}
                  </span>
                  <BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-none hidden sm:block">Loja oficial</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm">Início</Button>
              </Link>
              <Link href="/loja">
                <Button variant="ghost" size="sm">Loja</Button>
              </Link>
              {featureKitBuilder && (
                <Link href="/monte-seu-kit">
                  <Button variant="ghost" size="sm">Monte seu Kit</Button>
                </Link>
              )}
              <a href="https://discord.gg" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">Discord</Button>
              </a>
            </nav>

            {/* Search */}
            {featureSearch && (
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="pl-9 bg-muted border-border"
                />
              </div>
            </form>
            )}

            {/* Auth */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <span className="text-sm text-muted-foreground hidden lg:block">{user?.name}</span>
                  </div>
                  {user?.role === "admin" && (
                    <Link href="/admin">
                      <Button size="sm" variant="outline" className="text-xs">Admin</Button>
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => logout()} className="text-xs hidden sm:flex">
                    Sair
                  </Button>
                </div>
              ) : (
                <a href="/login">
                  <Button size="sm" variant="outline">Entrar</Button>
                </a>
              )}

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden border-t border-border py-3 space-y-1">
              {featureSearch && (
              <form onSubmit={handleSearch} className="pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="pl-9 bg-muted"
                  />
                </div>
              </form>
              )}
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">Início</Button>
              </Link>
              <Link href="/loja" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">Loja</Button>
              </Link>
              {featureKitBuilder && (
                <Link href="/monte-seu-kit" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start">Monte seu Kit</Button>
                </Link>
              )}
              <a href="https://discord.gg" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="w-full justify-start">Discord</Button>
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Monthly Goal */}
      {featureMonthlyGoal && <MonthlyGoal />}

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="container py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                {logoUrl ? (
                  <img src={logoUrl} alt={storeName} className="h-7 w-7 object-contain rounded" />
                ) : (
                  <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
                    <Sword className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <span className="font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {storeName}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{settings?.storeDescription ?? "A loja oficial do servidor Warden Craft."}</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Navegação</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-primary transition-colors">Início</Link></li>
                <li><Link href="/loja" className="hover:text-primary transition-colors">Loja</Link></li>
                <li><Link href="/" className="hover:text-primary transition-colors">Comunidade</Link></li>
                <li><a href="https://discord.gg" className="hover:text-primary transition-colors">Discord</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Entre em contato pelo Discord</li>
                <li>Entrega manual pelo admin</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6">
            <div className="flex justify-center gap-6 mb-4 text-sm">
              <Link href="/loja" className="text-primary hover:underline">
                Loja
              </Link>
              {isAdmin && (
                <Link href="/api-docs" className="text-primary hover:underline">
                  API Docs
                </Link>
              )}
              <Link href="/termos" className="text-primary hover:underline">
                Termos de Uso
              </Link>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
