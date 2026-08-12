import { http } from "@/shared/lib/http"
import {
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth"
import { auth } from "@/shared/lib/firebase"

interface CadastroRequest {
  nome: string
  email: string
  senha: string
}

interface UsuarioResponse {
  id: string
  nome: string
  email: string
  moedaPadrao: string
  fusoHorario: string
}

interface PreferenciasRequest {
  moedaPadrao: string
  fusoHorario: string
}

/** Cria a conta no Firebase Auth + perfil no Firestore via backend */
export async function cadastroApi(payload: CadastroRequest) {
  const { data } = await http.post<UsuarioResponse>(
    "/autenticacao/cadastro",
    payload
  )
  return data
}

/** Faz login via Firebase Auth — retorna o usuário Firebase */
export async function loginApi(payload: { email: string; senha: string }) {
  const credencial = await signInWithEmailAndPassword(
    auth,
    payload.email,
    payload.senha
  )
  return credencial.user
}

/** Faz logout via Firebase Auth */
export async function logoutApi() {
  await signOut(auth)
}

/** Busca o perfil do usuário autenticado no backend */
export async function meApi(): Promise<UsuarioResponse> {
  const { data } = await http.get<UsuarioResponse>("/autenticacao/me")
  return data
}

/** Atualiza preferências do usuário (moeda, fuso horário) */
export async function atualizarPreferenciasApi(payload: PreferenciasRequest) {
  const { data } = await http.put<UsuarioResponse>(
    "/autenticacao/preferencias",
    payload
  )
  return data
}

// Alias para compatibilidade com código existente
export const sessaoApi = meApi
