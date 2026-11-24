import { EstadoAlertas } from './estado-alertas';
import type { AlertaBruto, Gravidade } from './alertas';

const T0 = new Date('2026-01-01T12:00:00Z');
const em = (s: number) => new Date(T0.getTime() + s * 1000);

const alerta = (
  chave: string,
  gravidade: Gravidade = 'MEDIA',
  desde: Date | null = null,
): AlertaBruto => ({
  chave,
  tipo: 'PEDIDO_ATRASADO',
  gravidade,
  titulo: chave,
  detalhe: '',
  desde,
  link: null,
});

describe('EstadoAlertas', () => {
  it('só mostra o alerta depois de 60 s', () => {
    const e = new EstadoAlertas();
    expect(e.atualizar('r1', [alerta('a')], T0).visiveis).toHaveLength(0);
    expect(e.atualizar('r1', [alerta('a')], em(59)).visiveis).toHaveLength(0);
    expect(e.atualizar('r1', [alerta('a')], em(60)).visiveis).toHaveLength(1);
  });

  it('recomeça a contagem se o alerta some e volta', () => {
    const e = new EstadoAlertas();
    e.atualizar('r1', [alerta('a')], T0);
    e.atualizar('r1', [], em(30));
    expect(e.atualizar('r1', [alerta('a')], em(90)).visiveis).toHaveLength(0);
    expect(e.atualizar('r1', [alerta('a')], em(149)).visiveis).toHaveLength(0);
    expect(e.atualizar('r1', [alerta('a')], em(150)).visiveis).toHaveLength(1);
  });

  it('ordena por gravidade e depois pelo mais antigo', () => {
    const e = new EstadoAlertas();
    const cands = [
      alerta('m-novo', 'MEDIA', em(-10)),
      alerta('b', 'BAIXA', em(-100)),
      alerta('m-velho', 'MEDIA', em(-50)),
      alerta('alta', 'ALTA', em(-5)),
    ];
    e.atualizar('r1', cands, T0);
    const r = e.atualizar('r1', cands, em(60));
    expect(r.visiveis.map((a) => a.chave)).toEqual([
      'alta',
      'm-velho',
      'm-novo',
      'b',
    ]);
  });

  it('usa o desde do candidato quando existe, senão a primeira vez vista', () => {
    const e = new EstadoAlertas();
    const cands = [alerta('a', 'MEDIA', em(-300)), alerta('b')];
    e.atualizar('r1', cands, T0);
    const r = e.atualizar('r1', cands, em(60));
    expect(r.visiveis.find((a) => a.chave === 'a')!.desde).toEqual(em(-300));
    expect(r.visiveis.find((a) => a.chave === 'b')!.desde).toEqual(T0);
  });

  it('mudou é true quando entra alerta e false na chamada igual seguinte', () => {
    const e = new EstadoAlertas();
    expect(e.atualizar('r1', [], T0).mudou).toBe(false);
    e.atualizar('r1', [alerta('a')], em(1));
    expect(e.atualizar('r1', [alerta('a')], em(61)).mudou).toBe(true);
    expect(e.atualizar('r1', [alerta('a')], em(62)).mudou).toBe(false);
    expect(e.atualizar('r1', [], em(63)).mudou).toBe(true);
  });

  it('mudou é true quando muda só a gravidade', () => {
    const e = new EstadoAlertas();
    e.atualizar('r1', [alerta('a', 'BAIXA')], T0);
    e.atualizar('r1', [alerta('a', 'BAIXA')], em(60));
    expect(e.atualizar('r1', [alerta('a', 'ALTA')], em(61)).mudou).toBe(true);
  });

  it('candidato novo na primeira chamada ainda não é mudança', () => {
    const e = new EstadoAlertas();
    const c = alerta('a', 'MEDIA', em(-120));
    // candidato novo ainda precisa estabilizar, então nada visível
    expect(e.atualizar('r1', [c], T0).mudou).toBe(false);
  });

  it('restaurantes têm estados separados', () => {
    const e = new EstadoAlertas();
    e.atualizar('r1', [alerta('a')], T0);
    expect(e.atualizar('r2', [alerta('a')], em(60)).visiveis).toHaveLength(0);
    expect(e.atualizar('r1', [alerta('a')], em(60)).visiveis).toHaveLength(1);
  });
});
