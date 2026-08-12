import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, Navigate } from "react-router-dom"
import { IconLock, IconMail } from "@tabler/icons-react"
import { useState } from "react"

import { loginApi } from "@/features/autenticacao/api/autenticacao-api"
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
import { extrairMensagemErroApi } from "@/shared/lib/api-error"

const schema = z.object({
  email: z.email("Informe um email valido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
})

type FormularioLogin = z.infer<typeof schema>

export function PaginaLogin() {
  const { autenticado, entrar } = useAuth()
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)
  const loginMutation = useMutation({
    mutationFn: loginApi,
  })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormularioLogin>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "edson@kofre.app",
      senha: "123456",
    },
  })

  if (autenticado) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (valores: FormularioLogin) => {
    setMensagemErro(null)

    try {
      // loginApi usa Firebase signInWithEmailAndPassword
      await loginMutation.mutateAsync(valores)
      // Firebase onAuthStateChanged no AuthProvider já carregará o perfil automaticamente.
      // A chamada a entrar() é mantida como fallback explícito.
      await entrar()
    } catch (erro) {
      setMensagemErro(
        extrairMensagemErroApi(
          erro,
          "Credenciais invalidas. Verifique seu email e senha."
        )
      )
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Entrar no Kofre</CardTitle>
          <CardDescription>
            Acesse seu painel financeiro com autenticacao protegida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
            {mensagemErro ? (
              <p className="text-xs text-destructive">{mensagemErro}</p>
            ) : null}
            <Button className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Ainda nao tem conta?{" "}
            <Link
              to="/cadastro"
              className="text-foreground underline underline-offset-4"
            >
              Criar conta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
