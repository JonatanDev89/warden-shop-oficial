import { trpc } from "@/lib/trpc";
import { Hammer, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  const { data: settings } = trpc.shop.getSettings.useQuery();
  
  const maintenanceMessage = settings?.maintenanceMessage || "Estamos realizando melhorias para oferecer uma experiência ainda melhor para você. Voltaremos em breve!";
  const discordUrl = settings?.discordUrl || "#";

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Hammer className="w-64 h-64 text-primary animate-pulse" />
          </div>
          
          <div className="relative space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <Hammer className="w-12 h-12 text-primary" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                Em <span className="text-primary">Manutenção</span>
              </h1>
              <div className="h-1 w-24 bg-primary mx-auto rounded-full" />
            </div>

            <p className="text-slate-400 text-lg leading-relaxed">
              {maintenanceMessage}
            </p>

            <div className="pt-4 flex flex-col gap-3">
              <Button 
                asChild
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 text-black font-bold gap-2"
              >
                <a href={discordUrl} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="w-5 h-5" />
                  Acompanhar no Discord
                </a>
              </Button>
              
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Obrigado pela paciência!</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-12">
          <p className="text-slate-600 text-xs font-mono uppercase tracking-widest">
            {settings?.storeName || "Warden Shop"} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
