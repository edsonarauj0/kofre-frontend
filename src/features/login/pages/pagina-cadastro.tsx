import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { IconLock, IconMail, IconUser } from "@tabler/icons-react"
import { signInWithEmailAndPassword } from "firebase/auth"

import { cadastroApi } from "@/features/autenticacao/api/autenticacao-api"
import { auth } from "@/shared/lib/firebase"
import { useAuth } from "@/app/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  extrairCamposErroApi,
  extrairMensagemErroApi,
} from "@/shared/lib/api-error"

const schema = z
  .object({
    nome: z.string().min(2, "Informe seu nome"),
    email: z.email("Informe um email valido"),
    senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(6, "Confirme sua senha"),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas precisam ser iguais",
    path: ["confirmarSenha"],
  })

type FormularioCadastro = z.infer<typeof schema>

export function PaginaCadastro() {
  const { autenticado, entrar } = useAuth()
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)
  const cadastroMutation = useMutation({
    mutationFn: cadastroApi,
  })
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormularioCadastro>({
    resolver: zodResolver(schema),
  })

  if (autenticado) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (valores: FormularioCadastro) => {
    setMensagemErro(null)

    try {
      // 1. Backend cria o usuário no Firebase Auth + perfil no Firestore
      await cadastroMutation.mutateAsync({
        nome: valores.nome,
        email: valores.email,
        senha: valores.senha,
      })

      // 2. Faz login via Firebase Auth com as credenciais recém-criadas
      await signInWithEmailAndPassword(auth, valores.email, valores.senha)

      // 3. Firebase onAuthStateChanged carrega o perfil automaticamente,
      //    mas chamamos entrar() como confirmação explícita.
      await entrar()
    } catch (erro) {
      const campos = extrairCamposErroApi(erro)

      if (campos?.nome) {
        setError("nome", { message: campos.nome })
      }
      if (campos?.email) {
        setError("email", { message: campos.email })
      }
      if (campos?.senha) {
        setError("senha", { message: campos.senha })
      }

      setMensagemErro(
        extrairMensagemErroApi(
          erro,
          "Nao foi possivel concluir o cadastro agora."
        )
      )
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta no Kofre</CardTitle>
          <CardDescription>
            Cadastre-se para acessar seu painel financeiro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome</Label>
              <div className="relative">
                <IconUser className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" {...register("nome")} />
              </div>
              {errors.nome ? (
                <p className="text-xs text-destructive">{errors.nome.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <div className="relative">
                <IconMail className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" {...register("email")} />
              </div>
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Senha</Label>
              <div className="relative">
                <IconLock className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" className="pl-8" {...register("senha")} />
              </div>
              {errors.senha ? (
                <p className="text-xs text-destructive">{errors.senha.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirmar senha</Label>
              <div className="relative">
                <IconLock className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  className="pl-8"
                  {...register("confirmarSenha")}
                />
              </div>
              {errors.confirmarSenha ? (
                <p className="text-xs text-destructive">
                  {errors.confirmarSenha.message}
                </p>
              ) : null}
            </div>
            {mensagemErro ? (
              <p className="text-xs text-destructive">{mensagemErro}</p>
            ) : null}
            <Button className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Criando conta..." : "Cadastrar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Ja tem conta?{" "}
            <Link to="/entrar" className="text-foreground underline underline-offset-4">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
