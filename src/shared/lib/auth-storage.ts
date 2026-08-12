export function limparSessao() {
  sessionStorage.removeItem("kofre.sessao")
}

export function inferirNomePeloEmail(email: string) {
  const prefixo = email.split("@")[0] ?? "Usuario"
  return prefixo
    .split(/[._-]/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ")
}
