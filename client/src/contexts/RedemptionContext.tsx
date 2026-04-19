import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface RedemptionContextType {
  orderNumber: string | null;
  isApproved: boolean;
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  setOrderNumber: (orderNumber: string | null) => void;
}

const RedemptionContext = createContext<RedemptionContextType | undefined>(undefined);

export function RedemptionProvider({ children }: { children: ReactNode }) {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const utils = trpc.useUtils();

  // Extrair orderNumber da URL ou localStorage quando o componente monta
  useEffect(() => {
    console.log("[RedemptionContext] Montando contexto, URL:", window.location.href);
    
    // Primeiro, verificar URL (prioridade alta)
    const params = new URLSearchParams(window.location.search);
    const orderNum = params.get("orderNumber");
    console.log("[RedemptionContext] Parâmetro orderNumber da URL:", orderNum);
    
    if (orderNum) {
      setOrderNumber(orderNum);
      localStorage.setItem("lastOrderNumber", orderNum);
      console.log("[RedemptionContext] OrderNumber definido da URL:", orderNum);
      return;
    }

    // Se não encontrou na URL, verificar localStorage
    const savedOrderNumber = localStorage.getItem("lastOrderNumber");
    if (savedOrderNumber) {
      setOrderNumber(savedOrderNumber);
      console.log("[RedemptionContext] OrderNumber definido do localStorage:", savedOrderNumber);
    } else {
      console.log("[RedemptionContext] Nenhum orderNumber encontrado");
    }
  }, []);

  // Polling para verificar status do pedido
  useEffect(() => {
    if (!orderNumber) {
      console.log("[RedemptionContext] Sem orderNumber, parando polling");
      return;
    }

    console.log("[RedemptionContext] Iniciando polling para:", orderNumber);

    const pollInterval = setInterval(async () => {
      try {
        console.log("[RedemptionContext] Fazendo fetch para orderNumber:", orderNumber);
        const order = await utils.shop.getOrderByNumber.fetch({ orderNumber });
        console.log("[RedemptionContext] Resposta recebida:", order);
        console.log("[RedemptionContext] Status do pedido:", order.status);

        if (order.status === "game_pending" && !isApproved) {
          console.log("[RedemptionContext] Pedido aprovado! Mostrando dialog");
          setIsApproved(true);
          setShowDialog(true);
        }
      } catch (error) {
        console.log("[RedemptionContext] Erro ao buscar pedido:", error);
      }
    }, 3000); // Poll a cada 3 segundos

    return () => {
      console.log("[RedemptionContext] Limpando polling");
      clearInterval(pollInterval);
    };
  }, [orderNumber, isApproved, utils]);

  // Função para fechar o dialog
  const handleCloseDialog = (open: boolean) => {
    console.log("[RedemptionContext] handleCloseDialog chamado com open:", open);
    setShowDialog(open);
    // Se fechando e pedido foi aprovado, limpar do localStorage
    if (!open && isApproved) {
      localStorage.removeItem("lastOrderNumber");
      setOrderNumber(null);
      console.log("[RedemptionContext] Limpando orderNumber após resgate");
    }
  };

  console.log("[RedemptionContext] Renderizando com estado:", { orderNumber, isApproved, showDialog });

  return (
    <RedemptionContext.Provider
      value={{
        orderNumber,
        isApproved,
        showDialog,
        setShowDialog: handleCloseDialog,
        setOrderNumber,
      }}
    >
      {children}
    </RedemptionContext.Provider>
  );
}

export function useRedemption() {
  const context = useContext(RedemptionContext);
  if (!context) {
    throw new Error("useRedemption deve ser usado dentro de RedemptionProvider");
  }
  console.log("[useRedemption] Hook chamado, contexto:", context);
  return context;
}
