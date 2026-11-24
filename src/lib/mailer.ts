import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

export interface Correo {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Correos "enviados" durante las pruebas (NODE_ENV=test y sin SMTP configurado) */
export const bandejaDePrueba: Correo[] = [];

const smtpConfigurado = Boolean(env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);

let transporter: Transporter | undefined;
function transporte() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

if (!smtpConfigurado && env.NODE_ENV !== "test") {
  console.warn(
    "[mail] SMTP no configurado (SMTP_USER, SMTP_PASS, MAIL_FROM): los correos no se envían, " +
      "los códigos se muestran en esta consola.",
  );
}

export const mailer = {
  configurado: smtpConfigurado,

  /** Envía un correo. Lanza error si SMTP2GO lo rechaza o no responde. */
  async enviar(correo: Correo) {
    if (!smtpConfigurado) {
      if (env.NODE_ENV === "test") {
        bandejaDePrueba.push(correo);
      } else {
        console.info(`[mail] (sin SMTP) Para: ${correo.to} | ${correo.subject}\n${correo.text}`);
      }
      return;
    }
    await transporte().sendMail({ from: env.MAIL_FROM, ...correo });
  },
};
