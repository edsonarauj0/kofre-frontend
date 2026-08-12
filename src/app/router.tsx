/* eslint-disable react-refresh/only-export-components */
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom"

import { useAuth } from "@/app/auth"
import { AppShell } from "@/app/app-shell"
import { PaginaAgendaFinanceira } from "@/features/agenda/pages/pagina-agenda-financeira"
import { PaginaConfiguracoes } from "@/features/configuracoes/pages/pagina-configuracoes"
import { PaginaCartoes } from "@/features/contas/pages/pagina-cartoes"
import { PaginaContas } from "@/features/contas/pages/pagina-contas"
import { PaginaDashboard } from "@/features/dashboard/pages/pagina-dashboard"
import { PaginaIa } from "@/features/ia/pages/pagina-ia"
import { PaginaCadastro } from "@/features/login/pages/pagina-cadastro"
import { PaginaLogin } from "@/features/login/pages/pagina-login"
import { PaginaMetas } from "@/features/metas/pages/pagina-metas"
import { PaginaOrcamentos } from "@/features/orcamentos/pages/pagina-orcamentos"
import { PaginaTransacoes } from "@/features/transacoes/pages/pagina-transacoes"
import { PaginaConta } from "@/features/conta/pages/pagina-conta"
import { PaginaCategoria } from "@/features/categoria/pagina-categoria"

function RotaProtegida() {
  const { autenticado, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Validando sessao...
      </div>
    )
  }

  if (!autenticado) {
    return <Navigate to="/entrar" replace />
  }

  return <Outlet />
}

function RotaPublica() {
  const { autenticado, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Validando sessao...
      </div>
    )
  }

  if (autenticado) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <RotaPublica />,
    children: [
      {
        path: "/entrar",
        element: <PaginaLogin />,
      },
      {
        path: "/cadastro",
        element: <PaginaCadastro />,
      },
    ],
  },
  {
    element: <RotaProtegida />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <PaginaDashboard />,
          },
          {
            path: "transacoes",
            element: <PaginaTransacoes />,
          },
          {
            path: "contas",
            element: <PaginaContas />,
          },
          {
            path: "cartoes",
            element: <PaginaCartoes />,
          },
          {
            path: "orcamentos",
            element: <PaginaOrcamentos />,
          },
          {
            path: "agenda-financeira",
            element: <PaginaAgendaFinanceira />,
          },
          {
            path: "metas",
            element: <PaginaMetas />,
          },
          {
            path: "ia",
            element: <PaginaIa />,
          },
          {
            path: "configuracoes",
            element: <PaginaConfiguracoes />,
          },
          {
            path: "conta",
            element: <PaginaConta />,
          },
          {
            path: "categorias",
            element: <PaginaCategoria />,
          }
        ],
      },
    ],
  },
])
