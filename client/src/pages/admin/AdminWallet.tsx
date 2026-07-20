import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet, Plus, Minus, TrendingUp } from "lucide-react";

export function AdminWallet() {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] = useState<"withdrawal" | "adjustment">("withdrawal");

  const utils = trpc.useUtils();
  const { data: walletStats, isLoading: statsLoading } = trpc.admin.getWalletStats.useQuery();
  const { data: transactions, isLoading: transLoading } = trpc.admin.getWalletTransactions.useQuery();
  const addTransaction = trpc.admin.addWalletTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transação adicionada com sucesso!");
      setAmount("");
      setDescription("");
      setTransactionType("withdrawal");
      setIsOpen(false);
      utils.admin.getWalletStats.invalidate();
      utils.admin.getWalletTransactions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar transação");
    },
  });

  const handleAddTransaction = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Digite um valor válido");
      return;
    }

    addTransaction.mutate({
      amount,
      type: transactionType,
      description: description || undefined,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getTransactionIcon = (type: string) => {
    if (type === "sale") return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (type === "withdrawal") return <Minus className="w-4 h-4 text-red-600" />;
    return <Plus className="w-4 h-4 text-blue-600" />;
  };

  const getTransactionColor = (type: string) => {
    if (type === "sale") return "text-green-600 font-semibold";
    if (type === "withdrawal") return "text-red-600 font-semibold";
    return "text-blue-600 font-semibold";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carteira</h1>
          <p className="text-muted-foreground mt-1">Gerencie o saldo e histórico de transações</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Transação</DialogTitle>
              <DialogDescription>
                Registre uma retirada ou ajuste no saldo da carteira
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Transação</Label>
                <div className="flex gap-2">
                  <Button
                    variant={transactionType === "withdrawal" ? "default" : "outline"}
                    onClick={() => setTransactionType("withdrawal")}
                    className="flex-1 gap-2"
                  >
                    <Minus className="w-4 h-4" />
                    Retirada
                  </Button>
                  <Button
                    variant={transactionType === "adjustment" ? "default" : "outline"}
                    onClick={() => setTransactionType("adjustment")}
                    className="flex-1 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajuste
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Ex: Saque para conta bancária"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Button
                onClick={handleAddTransaction}
                disabled={addTransaction.isPending}
                className="w-full"
              >
                {addTransaction.isPending ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatCurrency(walletStats?.balance ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Saldo disponível</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? "..." : formatCurrency(walletStats?.totalSales ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receita acumulada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Retiradas</CardTitle>
            <Minus className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? "..." : formatCurrency(walletStats?.totalWithdrawals ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Saques realizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>
            Todas as transações da carteira em ordem cronológica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando transações...
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {formatDate(transaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className="capitalize">
                            {transaction.type === "sale"
                              ? "Venda"
                              : transaction.type === "withdrawal"
                              ? "Retirada"
                              : "Ajuste"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className={`text-right ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === "withdrawal" || (transaction.type === "adjustment" && parseFloat(String(transaction.amount)) < 0)
                          ? "-"
                          : "+"}
                        {formatCurrency(Math.abs(parseFloat(String(transaction.amount))))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação registrada ainda
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
