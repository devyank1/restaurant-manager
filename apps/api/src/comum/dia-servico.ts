// Dia de serviço do restaurante: das 05:00 às 04:59 do dia seguinte, no
// horário de São Paulo. Assim a noite que passa da meia-noite é um dia só.
// São Paulo está em -03:00 o ano todo (sem horário de verão desde 2019).

const HORA_VIRADA = 5;
const DESLOCAMENTO_UTC = 3;

const partes = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Início (05:00 em SP) do dia de serviço que contém `agora`. */
export function inicioDoDiaDeServico(agora: Date): Date {
  const p = Object.fromEntries(
    partes.formatToParts(agora).map((x) => [x.type, x.value]),
  );
  const ano = Number(p.year);
  const mes = Number(p.month) - 1;
  let dia = Number(p.day);
  if (Number(p.hour) < HORA_VIRADA) dia -= 1;
  return new Date(Date.UTC(ano, mes, dia, HORA_VIRADA + DESLOCAMENTO_UTC));
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Início (segunda 05:00 em SP) da semana de serviço que contém `agora`. */
export function inicioDaSemanaDeServico(agora: Date): Date {
  const dia = inicioDoDiaDeServico(agora);
  // 05:00 em SP é 08:00Z do mesmo dia do calendário: getUTCDay é o dia em SP.
  const desdeSegunda = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - desdeSegunda * DIA_MS);
}
