import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet, Plus, Minus, TrendingUp, ArrowLeft, Calendar, Info, DollarSign } from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";

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

  const getTransactionIcon = (type: string, amt: number) => {
    if (type === "sale") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (type === "withdrawal") return <Minus className="w-4 h-4 text-rose-500" />;
    return amt >= 0 ? <Plus className="w-4 h-4 text-blue-500" /> : <Minus className="w-4 h-4 text-amber-500" />;
  };

  const getTransactionColor = (type: string, amt: number) => {
    if (type === "sale") return "text-emerald-500 font-medium";
    if (type === "withdrawal") return "text-rose-500 font-medium";
    return amt >= 0 ? "text-blue-500 font-medium" : "text-amber-500 font-medium";
  };

  return (
    <AdminLayout title="Carteira Financeira">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Controle de Carteira
              </h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe suas vendas e gerencie seus gastos
              </p>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-sm">
                <Plus className="w-4 h-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Registrar Movimentação
                </DialogTitle>
                <DialogDescription>
                  Adicione uma retirada ou ajuste manual ao saldo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Tipo de Operação</Label>
                  <div className="flex p-1 bg-muted rounded-lg gap-1">
                    <Button
                      variant={transactionType === "withdrawal" ? "default" : "ghost"}
                      onClick={() => setTransactionType("withdrawal")}
                      className="flex-1 text-xs h-8"
                    >
                      <Minus className="w-3 h-3 mr-2" />
                      Retirada
                    </Button>
                    <Button
                      variant={transactionType === "adjustment" ? "default" : "ghost"}
                      onClick={() => setTransactionType("adjustment")}
                      className="flex-1 text-xs h-8"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Ajuste
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Valor (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      className="pl-9"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-sm font-medium">Descrição / Motivo</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Pagamento de hospedagem"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddTransaction}
                disabled={addTransaction.isPending}
                className="w-full"
              >
                {addTransaction.isPending ? "Processando..." : "Salvar Transação"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Saldo Atual</CardTitle>
              <div className="p-2 bg-primary/10 rounded-full">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {statsLoading ? (
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(walletStats?.balance ?? 0)
                )}
              </div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3 mr-1" />
                Valor disponível para uso
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total de Vendas</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-emerald-500">
                {statsLoading ? (
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(walletStats?.totalSales ?? 0)
                )}
              </div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
                Receita bruta acumulada
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total de Gastos</CardTitle>
              <div className="p-2 bg-rose-500/10 rounded-full">
                <Minus className="h-4 w-4 text-rose-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-rose-500">
                {statsLoading ? (
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  formatCurrency(walletStats?.totalWithdrawals ?? 0)
                )}
              </div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <Minus className="h-3 w-3 mr-1 text-rose-500" />
                Retiradas e despesas
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="shadow-sm border-none bg-card/50">
          <CardHeader className="border-b bg-card/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Histórico Financeiro</CardTitle>
                <CardDescription>Detalhamento de todas as entradas e saídas</CardDescription>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {transLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando transações...</p>
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="px-6 font-semibold">Data e Hora</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Descrição</TableHead>
                      <TableHead className="text-right px-6 font-semibold">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const amt = parseFloat(String(transaction.amount));
                      return (
                        <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="px-6 py-4 text-sm font-medium">
                            <div className="flex flex-col">
                              <span>{formatDate(transaction.createdAt).split(' ')[0]}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {formatDate(transaction.createdAt).split(' ')[1]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-full bg-muted`}>
                                {getTransactionIcon(transaction.type, amt)}
                              </div>
                              <span className="text-sm font-medium capitalize">
                                {transaction.type === "sale"
                                  ? "Venda"
                                  : transaction.type === "withdrawal"
                                  ? "Retirada"
                                  : "Ajuste"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {transaction.description || <span className="text-muted-foreground/50 italic">Sem descrição</span>}
                          </TableCell>
                          <TableCell className={`text-right px-6 ${getTransactionColor(transaction.type, amt)}`}>
                            <div className="flex items-center justify-end gap-1">
                              <span>
                                {transaction.type === "withdrawal" || (transaction.type === "adjustment" && amt < 0)
                                  ? "-"
                                  : "+"}
                              </span>
                              <span>{formatCurrency(Math.abs(amt))}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Wallet className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-lg">Nenhuma transação</h3>
                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                  As movimentações financeiras aparecerão aqui conforme as vendas ocorrerem.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
