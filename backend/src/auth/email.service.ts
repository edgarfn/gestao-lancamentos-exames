import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<boolean>('SMTP_SECURE') ?? false,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  async enviarRecuperacaoSenha(email: string, nome: string, urlRecuperacao: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@sistema';

    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado — link de recuperação de senha para ${email}: ${urlRecuperacao}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Recuperação de senha',
      text: `Olá, ${nome}!\n\nClique no link abaixo para redefinir sua senha (válido por 1 hora):\n\n${urlRecuperacao}\n\nSe você não solicitou a recuperação, ignore este e-mail.`,
      html: `
        <p>Olá, <strong>${nome}</strong>!</p>
        <p>Clique no link abaixo para redefinir sua senha (válido por <strong>1 hora</strong>):</p>
        <p><a href="${urlRecuperacao}" style="color:#1a7f64">${urlRecuperacao}</a></p>
        <p style="color:#888;font-size:0.85em">Se você não solicitou a recuperação, ignore este e-mail.</p>
      `,
    });
  }
}
