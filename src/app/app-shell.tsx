import { Outlet, useLocation } from "react-router-dom"

import { PerfilFinanceiroProvider } from "@/app/perfil-financeiro"
import { AppSidebar } from "@/components/app-sidebar"
import { TransacaoExplorerProvider } from "@/features/transacoes/components/transacao-explorer"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppShell() {
  const { pathname } = useLocation()

  const titulosPorRota = new Map<string, string>([
    ["/", "Dashboard"],
    ["/transacoes", "Transações"],
    ["/agenda-financeira", "Agenda financeira"],
    ["/contas", "Contas e cartoes"],
    ["/orcamentos", "Orcamentos"],
    ["/metas", "Metas"],
    ["/ia", "IA financeira"],
    ["/configuracoes", "Configuracoes"],
    ["/conta", "Conta"],
  ])

  const tituloPagina = titulosPorRota.get(pathname) ?? "FinanceApp"

  return (
    <PerfilFinanceiroProvider>
      <TransacaoExplorerProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
              <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <div>
                    <h1 className="font-heading text-lg font-semibold">
                      {tituloPagina}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Visao consolidada da sua operacao financeira
                    </p>
                  </div>
                </div>
              </div>
            </header>
            <div className="flex-1 px-4 py-6 md:px-6">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TransacaoExplorerProvider>
    </PerfilFinanceiroProvider>
  )
}
