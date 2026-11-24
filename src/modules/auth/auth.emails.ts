// =============================================================================
//  Correos de autenticación (código de 6 dígitos).
//  Mismo estilo del front: Hanken Grotesk, morado brand (#5b3fd9), tinta #1f1d2b.
//  HTML para clientes de correo: tablas y estilos en línea (Gmail ignora <style> en parte).
// =============================================================================

const C = {
  brand50: "#f4f1ff",
  brand200: "#ddd5fc",
  brand300: "#c2b3f8",
  brand400: "#9c84f2",
  brand700: "#5b3fd9",
  ink: "#1f1d2b",
  muted: "#6b6880",
  subtle: "#9a97ab",
  line: "#e7e5ee",
  surface: "#f7f7f9",
} as const;

const FUENTE = "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const FUENTE_CODIGO = "'Hanken Grotesk', 'SF Mono', 'Segoe UI Mono', Menlo, Consolas, monospace";

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Plantilla {
  etiqueta: string; // pastilla sobre el título
  titulo: string;
  intro: string; // HTML ya escapado
  codigo: string;
  minutos: number;
  aviso: string; // texto de seguridad al final
  preheader: string; // vista previa en la bandeja de entrada
}

function plantilla(p: Plantilla) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapar(p.titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @media (max-width: 520px) {
    .card { padding: 32px 24px !important; }
    .titulo { font-size: 24px !important; }
    .codigo { font-size: 30px !important; letter-spacing: 8px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.surface};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapar(p.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <!-- Logo -->
        <tr>
          <td style="padding:0 4px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" height="40" align="center" valign="middle"
                    style="width:40px;height:40px;border-radius:20px;background:${C.brand700};background-image:linear-gradient(135deg,${C.brand400},${C.brand700});color:#ffffff;font-family:${FUENTE};font-size:15px;font-weight:800;letter-spacing:0.5px;">IM</td>
                <td style="padding-left:12px;font-family:${FUENTE};">
                  <div style="font-size:18px;line-height:20px;font-weight:700;color:${C.ink};">IdeaMatch</div>
                  <div style="font-size:11px;line-height:14px;margin-top:3px;letter-spacing:1.3px;color:${C.muted};">Ideas que despegan</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tarjeta -->
        <tr>
          <td style="background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(31,29,43,0.04),0 4px 16px rgba(31,29,43,0.04);">
            <div style="height:4px;line-height:4px;font-size:0;background:${C.brand700};background-image:linear-gradient(90deg,${C.brand400},${C.brand700});">&nbsp;</div>
            <div class="card" style="padding:40px;font-family:${FUENTE};">

              <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${C.brand50};color:${C.brand700};font-size:12px;font-weight:600;">${escapar(p.etiqueta)}</span>

              <h1 class="titulo" style="margin:20px 0 0;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;color:${C.ink};">${escapar(p.titulo)}</h1>

              <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:${C.muted};">${p.intro}</p>

              <!-- Código -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td align="center" style="background:${C.brand50};border:1px dashed ${C.brand300};border-radius:14px;padding:24px 12px;">
                    <div style="font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};">Tu código</div>
                    <div class="codigo" style="margin-top:10px;font-family:${FUENTE_CODIGO};font-size:38px;line-height:1;font-weight:800;letter-spacing:12px;padding-left:12px;color:${C.brand700};">${escapar(p.codigo)}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${C.muted};text-align:center;">
                Vence en <strong style="color:${C.ink};">${p.minutos} minutos</strong> y solo se puede usar una vez.
              </p>

              <div style="height:1px;line-height:1px;font-size:0;background:${C.line};margin:32px 0 24px;">&nbsp;</div>

              <p style="margin:0;font-size:13px;line-height:1.6;color:${C.subtle};">${escapar(p.aviso)}</p>
            </div>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td align="center" style="padding:24px 16px 0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${C.subtle};">
            IdeaMatch · Conecta ideas con personas que las hacen realidad<br>
            Este es un correo automático, no respondas a este mensaje.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

interface DatosCorreo {
  nombre: string;
  codigo: string;
  minutos: number;
}

export function correoVerificacion({ nombre, codigo, minutos }: DatosCorreo) {
  const aviso = "Si no creaste una cuenta en IdeaMatch, puedes ignorar este correo. Nunca te pediremos este código por teléfono ni por chat.";
  return {
    subject: `${codigo} es tu código de verificación de IdeaMatch`,
    html: plantilla({
      etiqueta: "Verificación de cuenta",
      titulo: "Confirma tu correo",
      intro: `Hola, <strong style="color:${C.ink};">${escapar(nombre)}</strong>. Gracias por unirte a IdeaMatch. Ingresa este código en la pantalla de verificación para activar tu cuenta.`,
      codigo,
      minutos,
      aviso,
      preheader: `Tu código de verificación es ${codigo}. Vence en ${minutos} minutos.`,
    }),
    text:
      `Hola, ${nombre}:\n\nTu código de verificación de IdeaMatch es: ${codigo}\n\n` +
      `Vence en ${minutos} minutos y solo se puede usar una vez.\n\n${aviso}\n`,
  };
}

export function correoRecuperacion({ nombre, codigo, minutos }: DatosCorreo) {
  const aviso =
    "Si no pediste cambiar tu contraseña, ignora este correo: tu contraseña actual sigue funcionando. Nunca te pediremos este código por teléfono ni por chat.";
  return {
    subject: `${codigo} es tu código para restablecer tu contraseña de IdeaMatch`,
    html: plantilla({
      etiqueta: "Recuperación de contraseña",
      titulo: "Restablece tu contraseña",
      intro: `Hola, <strong style="color:${C.ink};">${escapar(nombre)}</strong>. Recibimos una solicitud para cambiar la contraseña de tu cuenta. Ingresa este código para crear una nueva.`,
      codigo,
      minutos,
      aviso,
      preheader: `Tu código para restablecer la contraseña es ${codigo}. Vence en ${minutos} minutos.`,
    }),
    text:
      `Hola, ${nombre}:\n\nTu código para restablecer la contraseña de IdeaMatch es: ${codigo}\n\n` +
      `Vence en ${minutos} minutos y solo se puede usar una vez.\n\n${aviso}\n`,
  };
}
