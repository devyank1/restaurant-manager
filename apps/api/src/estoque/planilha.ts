// Planilha .xlsx da lista de compras: uma aba por fornecedor.
import ExcelJS from 'exceljs';
import type { GrupoCompra, LinhaCompra } from './compras.service';
import { embalagensPara, formatarQuantidade } from './quantidade';

/** Nome de aba válido no Excel (máx. 31, sem []:*?/\). */
function nomeDeAba(nome: string, usados: Set<string>): string {
  const base =
    nome
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Aba';
  let final = base;
  for (let n = 2; usados.has(final.toLowerCase()); n++) {
    final = `${base.slice(0, 28)} ${n}`;
  }
  usados.add(final.toLowerCase());
  return final;
}

/** Quantidade e unidade para as colunas: embalagens ou "45" + "L". */
function colunas(l: LinhaCompra): [number, string] {
  if (l.embalagem) {
    const emb = l.embalagem;
    return [
      embalagensPara(l.quantidade, emb.quantidade),
      `${emb.nome} (${formatarQuantidade(emb.quantidade, l.unidade)})`,
    ];
  }
  const [numero, unidade] = formatarQuantidade(l.quantidade, l.unidade).split(
    ' ',
  );
  return [Number(numero.replace(',', '.')), unidade];
}

export async function gerarPlanilha(grupos: GrupoCompra[]): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  const usados = new Set<string>();
  for (const g of grupos) {
    const aba = livro.addWorksheet(
      nomeDeAba(g.fornecedor?.nome ?? 'Sem fornecedor', usados),
    );
    aba.columns = [{ width: 30 }, { width: 12 }, { width: 20 }, { width: 30 }];
    aba.addRow(['Item', 'Quantidade', 'Unidade', 'Observação']).font = {
      bold: true,
    };
    for (const l of g.itens) aba.addRow([l.nome, ...colunas(l), '']);
  }
  return Buffer.from(await livro.xlsx.writeBuffer());
}
