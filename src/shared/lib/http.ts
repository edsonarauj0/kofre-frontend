import axios from "axios"
import { auth } from "@/shared/lib/firebase"
import { obterPerfilFinanceiroAtivoId } from "@/shared/lib/perfil-financeiro-storage"
import { limparSessao } from "@/shared/lib/auth-storage"

// Em produção, VITE_API_URL aponta para o backend na Vercel.
// Em desenvolvimento, usa-se o proxy do Vite (/api → localhost:3000).
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL as string}/api/v1`
  : "/api/v1"

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

// Injeta o Firebase ID Token automaticamente em cada requisição
http.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers["Authorization"] = `Bearer ${token}`
  }

  const perfilId = obterPerfilFinanceiroAtivoId()
  if (perfilId) {
    config.headers["X-Kofre-Perfil-Id"] = perfilId
  } else {
    delete config.headers["X-Kofre-Perfil-Id"]
  }

  return config
})

// 401 → força refresh do token Firebase e retenta a requisição
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean
    }

    const url = String(originalRequest?.url ?? "")
    const isAuthRoute =
      url.includes("/autenticacao/cadastro")

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true

      try {
        const user = auth.currentUser
        if (user) {
          const token = await user.getIdToken(true) // força refresh
          originalRequest.headers["Authorization"] = `Bearer ${token}`
          return http(originalRequest)
        }
      } catch {
        limparSessao()
        window.location.href = "/entrar"
      }
    }

    return Promise.reject(error)
  }
)

export { http }

// Mantida para compatibilidade — não faz nada com Firebase Auth
export async function garantirCsrfCookie() {
  // Firebase Auth não usa CSRF — função mantida para não quebrar imports
}
