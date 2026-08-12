/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/app/auth"
import {
  criarPerfilFinanceiroApi,
  excluirPerfilFinanceiroApi,
  listarPerfisFinanceirosApi,
} from "@/features/perfis/api/perfis-financeiros-api"
import {
  limparPerfilFinanceiroAtivoId,
  obterPerfilFinanceiroAtivoId,
  salvarPerfilFinanceiroAtivoId,
} from "@/shared/lib/perfil-financeiro-storage"
import type { PerfilFinanceiro } from "@/shared/types/financeiro"

type EstadoPerfilFinanceiro = {
  carregando: boolean
  criando: boolean
  excluindo: boolean
  perfis: PerfilFinanceiro[]
  perfilAtivo: PerfilFinanceiro | null
  selecionarPerfil: (perfilId: string) => Promise<void>
  criarPerfil: (nome: string) => Promise<void>
  excluirPerfil: (perfilId: string) => Promise<void>
}

const PerfilFinanceiroContext = React.createContext<
  EstadoPerfilFinanceiro | undefined
>(undefined)

export function PerfilFinanceiroProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const { autenticado, carregando: carregandoAuth } = useAuth()
  const [perfilAtivoId, setPerfilAtivoId] = React.useState<string | null>(() =>
    obterPerfilFinanceiroAtivoId()
  )

  const perfisQuery = useQuery({
    queryKey: ["perfis-financeiros"],
    queryFn: listarPerfisFinanceirosApi,
    enabled: autenticado,
  })

  const criarPerfilMutation = useMutation({
    mutationFn: criarPerfilFinanceiroApi,
  })
  const excluirPerfilMutation = useMutation({
    mutationFn: excluirPerfilFinanceiroApi,
  })

  React.useEffect(() => {
    if (carregandoAuth || autenticado) {
      return
    }

    setPerfilAtivoId(null)
    limparPerfilFinanceiroAtivoId()
  }, [autenticado, carregandoAuth])

  React.useEffect(() => {
    const perfis = perfisQuery.data ?? []

    if (!autenticado || perfis.length === 0) {
      return
    }

    const perfilPersistido = perfilAtivoId
      ? perfis.find((perfil) => perfil.id === perfilAtivoId)
      : null
    const proximoPerfil = perfilPersistido ?? perfis.find((perfil) => perfil.padrao) ?? perfis[0]

    if (!proximoPerfil) {
      return
    }

    if (perfilAtivoId !== proximoPerfil.id) {
      setPerfilAtivoId(proximoPerfil.id)
    }

    salvarPerfilFinanceiroAtivoId(proximoPerfil.id)
  }, [autenticado, perfilAtivoId, perfisQuery.data])

  const selecionarPerfil = React.useCallback(
    async (perfilId: string) => {
      if (perfilAtivoId === perfilId) {
        return
      }

      setPerfilAtivoId(perfilId)
      salvarPerfilFinanceiroAtivoId(perfilId)
      await queryClient.invalidateQueries()
    },
    [perfilAtivoId, queryClient]
  )

  const criarPerfil = React.useCallback(
    async (nome: string) => {
      const perfilNome = nome.trim()

      if (!perfilNome) {
        throw new Error("Informe um nome para o perfil.")
      }

      const novoPerfil = await criarPerfilMutation.mutateAsync({ nome: perfilNome })

      queryClient.setQueryData<PerfilFinanceiro[]>(["perfis-financeiros"], (atual) => {
        if (!atual) {
          return [novoPerfil]
        }

        return [...atual, novoPerfil]
      })

      setPerfilAtivoId(novoPerfil.id)
      salvarPerfilFinanceiroAtivoId(novoPerfil.id)
      await queryClient.invalidateQueries()
    },
    [criarPerfilMutation, queryClient]
  )

  const excluirPerfil = React.useCallback(
    async (perfilId: string) => {
      const perfisAtuais = perfisQuery.data ?? []
      const perfisRestantes = perfisAtuais.filter((perfil) => perfil.id !== perfilId)

      await excluirPerfilMutation.mutateAsync(perfilId)

      const proximoPerfilAtivo =
        perfisRestantes.find((perfil) => perfil.padrao) ?? perfisRestantes[0] ?? null

      queryClient.setQueryData<PerfilFinanceiro[]>(["perfis-financeiros"], perfisRestantes)

      if (proximoPerfilAtivo) {
        setPerfilAtivoId(proximoPerfilAtivo.id)
        salvarPerfilFinanceiroAtivoId(proximoPerfilAtivo.id)
      } else {
        setPerfilAtivoId(null)
        limparPerfilFinanceiroAtivoId()
      }

      await queryClient.invalidateQueries()
    },
    [excluirPerfilMutation, perfisQuery.data, queryClient]
  )

  const perfis = perfisQuery.data ?? []
  const perfilAtivo = perfis.find((perfil) => perfil.id === perfilAtivoId) ?? null

  const valor = React.useMemo<EstadoPerfilFinanceiro>(
    () => ({
      carregando: carregandoAuth || perfisQuery.isLoading,
      criando: criarPerfilMutation.isPending,
      excluindo: excluirPerfilMutation.isPending,
      perfis,
      perfilAtivo,
      selecionarPerfil,
      criarPerfil,
      excluirPerfil,
    }),
    [
      carregandoAuth,
      criarPerfil,
      criarPerfilMutation.isPending,
      excluirPerfil,
      excluirPerfilMutation.isPending,
      perfilAtivo,
      perfis,
      perfisQuery.isLoading,
      selecionarPerfil,
    ]
  )

  return (
    <PerfilFinanceiroContext.Provider value={valor}>
      {children}
    </PerfilFinanceiroContext.Provider>
  )
}

export function usePerfilFinanceiro() {
  const contexto = React.useContext(PerfilFinanceiroContext)

  if (!contexto) {
    throw new Error(
      "usePerfilFinanceiro deve ser usado dentro de PerfilFinanceiroProvider"
    )
  }

  return contexto
}
