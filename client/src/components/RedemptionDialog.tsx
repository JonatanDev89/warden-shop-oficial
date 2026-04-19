import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRedemption } from "@/contexts/RedemptionContext";

export function RedemptionDialog() {
  const { showDialog, setShowDialog } = useRedemption();
  const [copied, setCopied] = useState(false);

  const redemptionCommand = `/scriptevent warden:resgatar`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Seu Pedido foi Aprovado! 🎉</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Seu pedido foi confirmado pelo administrador! Use o comando abaixo no jogo para resgatar seus itens:
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
            <code className="text-foreground font-mono text-sm flex-1 break-all">
              {redemptionCommand}
            </code>
            <button
              onClick={() => copyToClipboard(redemptionCommand)}
              className="p-2 hover:bg-primary/20 rounded transition-colors shrink-0"
              title="Copiar comando"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <Copy className="h-5 w-5 text-primary" />
              )}
            </button>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
            <p className="font-semibold mb-1">⚠️ Instruções:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Copie o comando acima</li>
              <li>Entre no jogo e abra o chat</li>
              <li>Cole e execute o comando</li>
              <li>Seus itens aparecerão no seu inventário!</li>
            </ol>
          </div>
          <Button onClick={() => setShowDialog(false)} className="w-full">
            Entendi!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
