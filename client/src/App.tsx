import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import ThemeInjector from "./components/ThemeInjector";

// Public pages
import Home from "./pages/Home";
import ShopPage from "./pages/ShopPage";
import CategoryPage from "./pages/CategoryPage";
import ProductPage from "./pages/ProductPage";
import SearchPage from "./pages/SearchPage";
import CheckoutPage from "./pages/CheckoutPage";
import CartPage from "./pages/CartPage";
import OrderConfirmedPage from "./pages/OrderConfirmedPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import TermsPage from "./pages/TermsPage";
import LoginPage from "./pages/LoginPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminWebhooks from "./pages/admin/AdminWebhooks";
import AdminCustomization from "./pages/admin/AdminCustomization";
import AdminApiKeys from "./pages/admin/AdminApiKeys";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminKitItems from "./pages/admin/AdminKitItems";
import KitBuilderPage from "./pages/KitBuilderPage";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/loja" component={ShopPage} />
      <Route path="/categoria/:id" component={CategoryPage} />
      <Route path="/produto/:id" component={ProductPage} />
      <Route path="/busca" component={SearchPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/carrinho" component={CartPage} />
      <Route path="/pedido-confirmado" component={OrderConfirmedPage} />
      <Route path="/api-docs" component={ApiDocsPage} />
      <Route path="/termos" component={TermsPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/monte-seu-kit" component={KitBuilderPage} />

      {/* Admin routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/pedidos" component={AdminOrders} />
      <Route path="/admin/produtos" component={AdminProducts} />
      <Route path="/admin/categorias" component={AdminCategories} />
      <Route path="/admin/cupons" component={AdminCoupons} />
      <Route path="/admin/webhooks" component={AdminWebhooks} />
      <Route path="/admin/personalizacao" component={AdminCustomization} />
      <Route path="/admin/api-keys" component={AdminApiKeys} />
      <Route path="/admin/admins" component={AdminAdmins} />
      <Route path="/admin/kit-items" component={AdminKitItems} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <CartProvider>
          <ThemeInjector />
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
