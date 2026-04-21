import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sword, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const logoUrl = settings?.logoUrl ?? "";
  const storeName = settings?.storeName ?? "Warden Shop";

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Bem-vindo de volta!");
      navigate("/");
    },
    onError: (e) => toast.error(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Conta criada com sucesso!");
      navigate("/");
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, oklch(0.10 0.02 240) 0%, oklch(0.14 0.04 200) 50%, oklch(0.10 0.03 145) 100%)",
      }}
    >
      {/* Grid decorativo */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.65 0.22 145) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.22 145) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="h-12 w-12 object-contain rounded-xl shadow-lg" style={{ boxShadow: "0 0 24px oklch(0.65 0.22 200 / 0.4)" }} />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg" style={{ boxShadow: "0 0 24px oklch(0.65 0.22 200 / 0.4)" }}>
                  <Sword className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
              <span className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {storeName}
              </span>
            </div>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            {/* Tabs login/cadastro */}
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === "login"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === "register"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cadastrar
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    {...loginForm.register("email")}
                    className="bg-muted border-border"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...loginForm.register("password")}
                      className="bg-muted border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Nome</Label>
                  <Input
                    id="reg-name"
                    placeholder="Seu nome"
                    autoComplete="name"
                    {...registerForm.register("name")}
                    className="bg-muted border-border"
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    {...registerForm.register("email")}
                    className="bg-muted border-border"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      {...registerForm.register("password")}
                      className="bg-muted border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm">Confirmar senha</Label>
                  <Input
                    id="reg-confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    {...registerForm.register("confirmPassword")}
                    className="bg-muted border-border"
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar conta
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground mt-4">
              Ao continuar, você concorda com os{" "}
              <Link href="/termos" className="text-primary hover:underline">
                Termos de Uso
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link href="/" className="hover:text-primary transition-colors">
            ← Voltar para a loja
          </Link>
        </p>
      </div>
    </div>
  );
}
