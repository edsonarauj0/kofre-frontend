import * as React from "react"

import { cn } from "@/lib/utils"
import { obterBancoPorInstituicao } from "@/shared/lib/bancos"

type TamanhoLogoBanco = "sm" | "md" | "lg"

const classesPorTamanho: Record<TamanhoLogoBanco, string> = {
  sm: "size-6 text-[0.125rem]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
}

export function LogoBanco({
  instituicao,
  tamanho = "md",
  mostrarNome = false,
  className,
}: {
  instituicao?: string | null
  tamanho?: TamanhoLogoBanco
  mostrarNome?: boolean
  className?: string
}) {
  const banco = obterBancoPorInstituicao(instituicao)
  const [falhouCarregamento, setFalhouCarregamento] = React.useState(false)
  const nome = banco?.nome ?? instituicao ?? "Conta"
  const sigla =
    banco?.sigla ??
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("")

  React.useEffect(() => {
    setFalhouCarregamento(false)
  }, [banco?.logoPath, instituicao])

  const logo = (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm overflow-hidden border bg-background font-semibold tracking-wide",
        classesPorTamanho[tamanho],
        className
      )}
      style={{
        backgroundColor: banco?.background ?? "#F4F4F5",
        color: banco?.foreground ?? "#52525B",
        borderColor: banco?.border ?? "#E4E4E7",
      }}
      aria-hidden="true"
    >
      {banco?.logoPath && !falhouCarregamento ? (
        <img
          src={banco.logoPath}
          alt={`${nome} logo`}
          className="size-full object-contain rounded-sm"
          loading="lazy"
          onError={() => setFalhouCarregamento(true)}
        />
      ) : (
        sigla
      )}
    </div>
  )

  if (!mostrarNome) {
    return logo
  }

  return (
    <div className="flex items-center gap-3">
      {logo}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="truncate text-xs text-muted-foreground">Instituicao selecionada</p>
      </div>
    </div>
  )
}
