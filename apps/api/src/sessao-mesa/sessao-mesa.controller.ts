import { Controller, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { COOKIE_DISPOSITIVO, DURACAO_DISPOSITIVO_MS } from './participante';
import { SessaoMesaService } from './sessao-mesa.service';

@Controller('publico/mesas/:token')
export class SessaoMesaController {
  constructor(private readonly sessoes: SessaoMesaService) {}

  @Post('entrar')
  @HttpCode(200)
  async entrar(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ dispositivoConfirmado: boolean }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const resultado = await this.sessoes.entrar(
      token,
      cookies?.[COOKIE_DISPOSITIVO],
    );
    if (resultado.novo) {
      res.cookie(COOKIE_DISPOSITIVO, resultado.dispositivoId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: DURACAO_DISPOSITIVO_MS,
      });
    }
    return { dispositivoConfirmado: resultado.confirmado };
  }
}
