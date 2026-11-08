// "Garçom de mentira" para testar a Etapa 2A antes do app da equipe (2B).
// Usa os mesmos endpoints que o app vai usar. Uso (na raiz):
//   pnpm garcom turno on|off          entra/sai do turno
//   pnpm garcom chamados              lista os chamados
//   pnpm garcom mesas                 lista as mesas
//   pnpm garcom mesa 7                mostra as rodadas da mesa
//   pnpm garcom confirmar 7           confirma a rodada aguardando
//   pnpm garcom recusar 7             recusa a rodada aguardando
//   pnpm garcom tamanho 7 G           troca o tamanho do 1º item com Tamanho
//   pnpm garcom atendido 7            marca o chamado de atendente como atendido
//   pnpm garcom cancelar 7            cancela a rodada direta (dentro da janela)
//   pnpm garcom entregar 7            entrega os itens prontos da mesa
// Opção: --como bruno|dono (padrão: ana). API em API_URL (padrão localhost:3000).

const API = process.env.API_URL ?? 'http://localhost:3000';
const args = process.argv.slice(2);
const iComo = args.indexOf('--como');
const quem = iComo >= 0 ? args.splice(iComo, 2)[1] : 'ana';
const [comando, ...resto] = args;
const reais = (c) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS = {
  AGUARDANDO_GARCOM: 'aguardando garçom',
  CONFIRMADA: 'confirmada',
  CANCELADA: 'cancelada',
};

let cookie = '';
async function pedir(metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: {
      Cookie: cookie,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!r.ok)
    throw new Error(
      `${metodo} ${caminho} → ${r.status} ${dados?.mensagem ?? texto}`,
    );
  return { dados, r };
}

async function entrar() {
  const email = quem === 'dono' ? 'dono@demo.com' : `${quem}@demo.com`;
  const { dados, r } = await pedir('POST', '/equipe/login', {
    email,
    senha: 'demo1234',
  });
  cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  return dados;
}

async function mesaPorNumero(numero) {
  const { dados: mesas } = await pedir('GET', '/equipe/mesas');
  const mesa = mesas.find((m) => m.numero === Number(numero));
  if (!mesa) throw new Error(`Mesa ${numero} não existe`);
  return (await pedir('GET', `/equipe/mesas/${mesa.token}`)).dados;
}

function mostrarMesa(m) {
  console.log(
    `Mesa ${m.mesa.numero} · garçom: ${m.garcomNome ?? '—'} · confirmado ${reais(m.totalConfirmadoCentavos)}`,
  );
  if (m.rodadas.length === 0) console.log('  sem pedidos');
  for (const r of m.rodadas) {
    const novo = r.dispositivoNovo ? ' · celular novo' : '';
    const fase = r.fase && r.status === 'CONFIRMADA' ? ` · ${r.fase}` : '';
    const ate = r.cancelavelAte ? ' · dá para cancelar' : '';
    console.log(
      `  [${STATUS[r.status]}${fase}] ${reais(r.totalCentavos)}${novo}${ate}`,
    );
    for (const i of r.itens) {
      const opc = i.resumoOpcoes ? ` (${i.resumoOpcoes})` : '';
      const obs = i.observacao ? ` — obs: ${i.observacao}` : '';
      const st = i.status ? ` [${i.estacao}: ${i.status}]` : '';
      console.log(
        `     ${i.quantidade}× ${i.nome}${opc} ${reais(i.precoUnitarioCentavos * i.quantidade)}${obs}${st}`,
      );
    }
  }
}

function aguardando(m) {
  const r = m.rodadas.find((x) => x.status === 'AGUARDANDO_GARCOM');
  if (!r) throw new Error(`Mesa ${m.mesa.numero} não tem rodada aguardando`);
  return r;
}

async function main() {
  const eu = await entrar();
  switch (comando) {
    case 'turno': {
      const emTurno = resto[0] !== 'off';
      await pedir('PATCH', '/equipe/turno', { emTurno });
      console.log(`${eu.nome} ${emTurno ? 'entrou no' : 'saiu do'} turno`);
      break;
    }
    case 'chamados': {
      const { dados } = await pedir('GET', '/equipe/chamados');
      if (dados.length === 0) console.log(`Nenhum chamado para ${eu.nome}`);
      for (const c of dados) {
        const tipo =
          c.tipo === 'ATENDENTE'
            ? 'chamou o atendente'
            : 'pedido para confirmar';
        const extra = [
          c.paraTodos && 'para todos',
          c.tentativas > 1 && 'repassado',
          c.status === 'LIDO' && 'lido',
        ]
          .filter(Boolean)
          .join(', ');
        console.log(
          `Mesa ${c.mesa.numero}: ${tipo}${extra ? ` (${extra})` : ''}`,
        );
      }
      break;
    }
    case 'mesas': {
      const { dados } = await pedir('GET', '/equipe/mesas');
      for (const m of dados) {
        if (!m.aberta) continue;
        console.log(
          `Mesa ${m.numero} · ${m.garcomNome ?? 'sem garçom'} · ${m.pendentes} aguardando · ${m.prontos ?? 0} prontos`,
        );
      }
      break;
    }
    case 'mesa':
      mostrarMesa(await mesaPorNumero(resto[0]));
      break;
    case 'confirmar':
    case 'recusar': {
      const r = aguardando(await mesaPorNumero(resto[0]));
      await pedir('POST', `/equipe/rodadas/${r.id}/${comando}`);
      console.log(
        `Rodada ${comando === 'confirmar' ? 'confirmada' : 'recusada'}`,
      );
      mostrarMesa(await mesaPorNumero(resto[0]));
      break;
    }
    case 'cancelar': {
      const m = await mesaPorNumero(resto[0]);
      const r = m.rodadas.find((x) => x.cancelavelAte);
      if (!r) throw new Error(`Mesa ${m.mesa.numero} não tem rodada na janela`);
      await pedir('POST', `/equipe/rodadas/${r.id}/cancelar`);
      console.log('Rodada cancelada');
      mostrarMesa(await mesaPorNumero(resto[0]));
      break;
    }
    case 'entregar': {
      const m = await mesaPorNumero(resto[0]);
      const prontas = m.rodadas.filter((x) =>
        x.itens.some((i) => i.status === 'PRONTO'),
      );
      if (prontas.length === 0) throw new Error('Nada pronto para entregar');
      for (const r of prontas) {
        await pedir('POST', `/equipe/rodadas/${r.id}/entregar`);
      }
      console.log('Prontos entregues');
      mostrarMesa(await mesaPorNumero(resto[0]));
      break;
    }
    case 'tamanho': {
      const [numero, nomeTamanho] = resto;
      const m = await mesaPorNumero(numero);
      const r = aguardando(m);
      const { dados: cardapio } = await pedir(
        'GET',
        `/publico/mesas/${m.mesa.token}/cardapio`,
      );
      const pratos = cardapio.categorias.flatMap((c) => c.pratos);
      for (const item of r.itens) {
        const grupo = pratos
          .find((p) => p.id === item.pratoId)
          ?.grupos.find((g) => g.nome === 'Tamanho');
        if (!grupo) continue;
        const opcao = grupo.opcoes.find(
          (o) => o.nome.toLowerCase() === String(nomeTamanho).toLowerCase(),
        );
        if (!opcao)
          throw new Error(
            `Tamanhos: ${grupo.opcoes.map((o) => o.nome).join(', ')}`,
          );
        await pedir('PATCH', `/equipe/rodadas/${r.id}/itens/${item.id}`, {
          selecao: { ...item.selecao, [grupo.id]: [opcao.id] },
        });
        console.log(`${item.nome}: tamanho trocado para ${opcao.nome}`);
        mostrarMesa(await mesaPorNumero(numero));
        return;
      }
      throw new Error('Nenhum item com Tamanho na rodada aguardando');
    }
    case 'atendido': {
      const { dados } = await pedir('GET', '/equipe/chamados');
      const doMesa = dados.filter(
        (c) => c.mesa.numero === Number(resto[0]) && c.tipo === 'ATENDENTE',
      );
      if (doMesa.length === 0)
        throw new Error(
          `Nenhum chamado de atendente da mesa ${resto[0]} para ${eu.nome}`,
        );
      for (const c of doMesa)
        await pedir('POST', `/equipe/chamados/${c.id}/resolver`);
      console.log(`Mesa ${resto[0]}: atendido`);
      break;
    }
    default:
      console.log(
        'Comandos: turno on|off, chamados, mesas, mesa N, confirmar N, recusar N, cancelar N, entregar N, tamanho N G, atendido N [--como bruno|dono]',
      );
  }
}

main().catch((erro) => {
  // "fetch failed" sem API no ar: mostra o motivo (ex.: ECONNREFUSED).
  console.error(
    erro.cause
      ? `${erro.message} (${erro.cause.code ?? erro.cause})`
      : erro.message,
  );
  process.exitCode = 1;
});
