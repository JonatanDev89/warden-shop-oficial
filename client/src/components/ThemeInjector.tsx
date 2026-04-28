import { useThemeInjector } from "@/hooks/useThemeInjector";

/**
 * Componente sem UI que apenas aplica as variáveis de tema do banco
 * no elemento <html>. Deve ser renderizado dentro do TRPCProvider.
 */
export default function ThemeInjector() {
  useThemeInjector();
  return null;
}
