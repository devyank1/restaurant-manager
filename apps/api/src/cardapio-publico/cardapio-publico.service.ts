import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardapioPublico } from './cardapio-publico.types';

// Tokens reais têm 22 caracteres; nada maior que isso merece ir ao banco.
const TAMANHO_MAXIMO_TOKEN = 64;

const porOrdem = { orderBy: { ordem: 'asc' as const } };

@Injectable()
export class CardapioPublicoService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorToken(token: string): Promise<CardapioPublico | null> {
    if (token.length > TAMANHO_MAXIMO_TOKEN) return null;

    const mesa = await this.prisma.mesa.findUnique({
      where: { token },
      include: {
        restaurante: {
          include: {
            categorias: {
              ...porOrdem,
              include: {
                pratos: {
                  ...porOrdem,
                  include: {
                    grupos: { ...porOrdem, include: { opcoes: porOrdem } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!mesa) return null;

    const { restaurante } = mesa;
    return {
      restaurante: {
        nome: restaurante.nome,
        logoUrl: restaurante.logoUrl,
        googleAvaliacaoUrl: restaurante.googleAvaliacaoUrl,
        wifi: restaurante.wifiSsid
          ? { ssid: restaurante.wifiSsid, senha: restaurante.wifiSenha }
          : null,
      },
      mesa: { numero: mesa.numero },
      categorias: restaurante.categorias
        .filter((categoria) => categoria.pratos.length > 0)
        .map((categoria) => ({
          id: categoria.id,
          nome: categoria.nome,
          pratos: categoria.pratos.map((prato) => ({
            id: prato.id,
            nome: prato.nome,
            descricao: prato.descricao,
            precoCentavos: prato.precoCentavos,
            precoPromocionalCentavos: prato.precoPromocionalCentavos,
            destaque: prato.destaque,
            esgotado: prato.esgotado,
            videoUrl: prato.videoUrl,
            posterUrl: prato.posterUrl,
            grupos: prato.grupos.map((grupo) => ({
              id: grupo.id,
              nome: grupo.nome,
              tipo: grupo.tipo,
              obrigatorio: grupo.obrigatorio,
              min: grupo.min,
              max: grupo.max,
              opcoes: grupo.opcoes.map((opcao) => ({
                id: opcao.id,
                nome: opcao.nome,
                precoCentavos: opcao.precoCentavos,
                precoPromocionalCentavos: opcao.precoPromocionalCentavos,
              })),
            })),
          })),
        })),
    };
  }
}
