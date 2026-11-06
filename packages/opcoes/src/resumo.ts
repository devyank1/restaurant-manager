import type { Selecao } from './preco'
import type { GrupoOpcaoPublico, PratoPublico } from './tipos'

const SEPARADOR_OPCOES: Record<GrupoOpcaoPublico['tipo'], string> = {
  UNICA: ', ',
  MULTIPLA: ', ',
  SABORES: ' / ',
}

export function resumirOpcoes(prato: PratoPublico, selecao: Selecao): string {
  return prato.grupos
    .map((grupo) => {
      const ids = selecao[grupo.id] ?? []
      const nomes = grupo.opcoes.filter((o) => ids.includes(o.id)).map((o) => o.nome)
      return nomes.join(SEPARADOR_OPCOES[grupo.tipo])
    })
    .filter((parte) => parte.length > 0)
    .join(' · ')
}

