/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/shared/lib/firebase"
import {
  atualizarPreferenciasApi,
  logoutApi,
  meApi,
} from "@/features/autenticacao/api/autenticacao-api"
import { limparSessao } from "@/shared/lib/auth-storage"
import {
  limparPreferenciasUsuario,
  salvarPreferenciasUsuario,
} from "@/shared/lib/preferencias-usuario"
import { limparPerfilFinanceiroAtivoId } from "@/shared/lib/perfil-financeiro-storage"

type EstadoAutenticacao = {
  carregando: boolean
  autenticado: boolean
  nome: string | null
  email: string | null
  moeda: string
  fusoHorario: string
  entrar: () => Promise<void>
  sair: () => Promise<void>
  atualizarPreferencias: (preferencias: {
    moeda: string
    fusoHorario: string
  }) => Promise<void>
}

const AuthContext = React.createContext<EstadoAutenticacao | undefined>(
  undefined
)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = React.useState(true)
  const [nome, setNome] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState<string | null>(null)
  const [moeda, setMoeda] = React.useState("BRL")
  const [fusoHorario, setFusoHorario] = React.useState("America/Sao_Paulo")

  const carregarPerfil = React.useCallback(async () => {
    try {
      const perfil = await meApi()
      setEmail(perfil.email)
      setNome(perfil.nome)
      setMoeda(perfil.moedaPadrao)
      setFusoHorario(perfil.fusoHorario)
      salvarPreferenciasUsuario({
        moeda: perfil.moedaPadrao,
        fusoHorario: perfil.fusoHorario,
      })
    } catch {
      // Perfil não encontrado — limpa o estado
      limparSessao()
      limparPreferenciasUsuario()
      limparPerfilFinanceiroAtivoId()
      setEmail(null)
      setNome(null)
      setMoeda("BRL")
      setFusoHorario("America/Sao_Paulo")
    }
  }, [])

  // Monitora o estado de autenticação do Firebase automaticamente.
  // Isso substitui o polling via sessaoApi() e o refresh manual de tokens.
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuário logado — carrega o perfil do backend
        await carregarPerfil()
      } else {
        // Usuário deslogado
        limparSessao()
        limparPreferenciasUsuario()
        limparPerfilFinanceiroAtivoId()
        setEmail(null)
        setNome(null)
        setMoeda("BRL")
        setFusoHorario("America/Sao_Paulo")
      }
      setCarregando(false)
    })

    return () => unsubscribe()
  }, [carregarPerfil])

  const entrar = React.useCallback(async () => {
    // Firebase onAuthStateChanged já cuida do estado — apenas recarrega o perfil
    await carregarPerfil()
  }, [carregarPerfil])

  const sair = React.useCallback(async () => {
    try {
      await logoutApi() // Firebase signOut
    } catch {
      // Logout local acontece de qualquer forma
    }
    limparSessao()
    limparPreferenciasUsuario()
    limparPerfilFinanceiroAtivoId()
    setEmail(null)
    setNome(null)
    setMoeda("BRL")
    setFusoHorario("America/Sao_Paulo")
  }, [])

  const atualizarPreferencias = React.useCallback(
    async (preferencias: { moeda: string; fusoHorario: string }) => {
      const resposta = await atualizarPreferenciasApi({
        moedaPadrao: preferencias.moeda,
        fusoHorario: preferencias.fusoHorario,
      })
      setMoeda(resposta.moedaPadrao)
      setFusoHorario(resposta.fusoHorario)
      salvarPreferenciasUsuario({
        moeda: resposta.moedaPadrao,
        fusoHorario: resposta.fusoHorario,
      })
    },
    []
  )

  const valor = React.useMemo<EstadoAutenticacao>(
    () => ({
      carregando,
      autenticado: Boolean(email),
      nome,
      email,
      moeda,
      fusoHorario,
      entrar,
      sair,
      atualizarPreferencias,
    }),
    [atualizarPreferencias, carregando, email, entrar, fusoHorario, moeda, nome, sair]
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contexto = React.useContext(AuthContext)
  if (!contexto) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider")
  }
  return contexto
}
