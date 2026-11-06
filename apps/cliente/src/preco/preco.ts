import type { GrupoOpcaoPublico, PratoPublico } from '../api/tipos'

/** Opções escolhidas: id do grupo → ids das opções. */
export type Selecao = Record<string, string[]>

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarReais(centavos: number): string {
  return formatador.format(centavos / 100)
}

// Mesma regra do desconto exibido: promoção só vale se for maior que zero e menor que o preço.
export function precoEfetivo(base: number, promo: number | null): number {
  return promo !== null && promo > 0 && promo < base ? promo : base
}

export function descontoPercentual(base: number, promo: number | null): number | null {
  if (promo === null || base <= 0 || promo <= 0 || promo >= base) return null
  return Math.round((1 - promo / base) * 100)
}

// Uma escolha única com preço (ex.: Tamanho P/M/G) define o preço do item;
// uma escolha única sem preço (ex.: Ponto da carne) não mexe nele.
function definePreco(grupo: GrupoOpcaoPublico): boolean {
  return grupo.tipo === 'UNICA' && grupo.opcoes.some((o) => o.precoCentavos > 0)
}

function grupoTamanho(prato: PratoPublico): GrupoOpcaoPublico | undefined {
  return prato.grupos.find((grupo) => grupo.obrigatorio && definePreco(grupo))
}

export function precoExibicao(prato: PratoPublico): {
  centavos: number
  originalCentavos: number | null
  desconto: number | null
  aPartirDe: boolean
} {
  const tamanho = grupoTamanho(prato)
  if (tamanho && tamanho.opcoes.length > 0) {
    const menor = Math.min(
      ...tamanho.opcoes.map((o) => precoEfetivo(o.precoCentavos, o.precoPromocionalCentavos)),
    )
    return { centavos: menor, originalCentavos: null, desconto: null, aPartirDe: true }
  }

  const desconto = descontoPercentual(prato.precoCentavos, prato.precoPromocionalCentavos)
  return {
    centavos: precoEfetivo(prato.precoCentavos, prato.precoPromocionalCentavos),
    originalCentavos: desconto === null ? null : prato.precoCentavos,
    desconto,
    aPartirDe: false,
  }
}

function opcoesEscolhidas(grupo: GrupoOpcaoPublico, selecao: Selecao) {
  const ids = selecao[grupo.id] ?? []
  return grupo.opcoes.filter((opcao) => ids.includes(opcao.id))
}

export function precoUnitario(prato: PratoPublico, selecao: Selecao): number {
  let base = precoEfetivo(prato.precoCentavos, prato.precoPromocionalCentavos)
  let maiorSabor = 0
  let adicionais = 0

  for (const grupo of prato.grupos) {
    const precos = opcoesEscolhidas(grupo, selecao).map((o) =>
      precoEfetivo(o.precoCentavos, o.precoPromocionalCentavos),
    )
    if (precos.length === 0) continue

    if (definePreco(grupo)) base = precos[0]
    // Meio a meio cobra o sabor mais caro (regra "MAIOR" da spec).
    if (grupo.tipo === 'SABORES') maiorSabor = Math.max(...precos)
    if (grupo.tipo === 'MULTIPLA') adicionais += precos.reduce((a, b) => a + b, 0)
  }

  return base + maiorSabor + adicionais
}

export function validarSelecao(prato: PratoPublico, selecao: Selecao): string[] {
  const erros: string[] = []
  for (const grupo of prato.grupos) {
    const quantidade = (selecao[grupo.id] ?? []).length
    const minimo = grupo.obrigatorio ? Math.max(grupo.min, 1) : grupo.min
    if (quantidade < minimo) erros.push(`Escolha ${grupo.nome}`)
    else if (quantidade > grupo.max) erros.push(`Escolha até ${grupo.max} em ${grupo.nome}`)
  }
  return erros
}
