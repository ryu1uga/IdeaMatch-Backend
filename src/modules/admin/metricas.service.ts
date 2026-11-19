import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";

// ---------------------------------------------------------------------------
// Indicadores del panel de administración. Cada uno: { value, changeThisMonth }.
// Si el cálculo falla se devuelve el último resultado bueno (caché en memoria)
// con su `updatedAt` y `stale: true`.
// ---------------------------------------------------------------------------

const OFFSET_LIMA_H = 5; // America/Lima = UTC-5 todo el año (sin horario de verano)

/** Inicio del mes (en hora de Lima) desplazado `delta` meses */
function inicioMes(delta = 0, ahora = new Date()) {
  const lima = new Date(ahora.getTime() - OFFSET_LIMA_H * 3600_000);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth() + delta, 1, OFFSET_LIMA_H));
}

const redondear = (n: number) => Math.round(n * 10) / 10;

async function tasaAceptacion(desde?: Date, hasta?: Date) {
  const rango = desde || hasta ? { fechaResolucion: { ...(desde && { gte: desde }), ...(hasta && { lt: hasta }) } } : {};
  const [aceptadas, rechazadas] = await Promise.all([
    prisma.postulacion.count({ where: { estado: "Aceptada", ...rango } }),
    prisma.postulacion.count({ where: { estado: "Rechazada", ...rango } }),
  ]);
  const total = aceptadas + rechazadas;
  return total ? redondear((aceptadas / total) * 100) : null;
}

async function calcular() {
  const mes = inicioMes(0);
  const mesAnterior = inicioMes(-1);
  const ACTIVOS = ["Abierto", "En_Curso"];

  const [usuarios, usuariosMes, activos, activosMes, tasa, tasaMes, tasaMesAnterior, abiertos, reportesMes] =
    await Promise.all([
      prisma.usuario.count({ where: { estado: { not: "Baja" } } }),
      prisma.usuario.count({ where: { estado: { not: "Baja" }, fechaRegistro: { gte: mes } } }),
      prisma.proyecto.count({ where: { estado: { in: ACTIVOS } } }),
      prisma.proyecto.count({ where: { estado: { in: ACTIVOS }, fechaPublicacion: { gte: mes } } }),
      tasaAceptacion(),
      tasaAceptacion(mes),
      tasaAceptacion(mesAnterior, mes),
      prisma.reporte.count({ where: { estado: { in: ["Pendiente", "En_Revision"] } } }),
      prisma.reporte.count({ where: { fechaReporte: { gte: mes } } }),
    ]);

  return {
    // usuarios registrados (sin bajas) · nuevos este mes
    users: { value: usuarios, changeThisMonth: usuariosMes },
    // proyectos abiertos o en curso · de ellos, publicados este mes
    activeProjects: { value: activos, changeThisMonth: activosMes },
    // % aceptadas sobre resueltas · diferencia en puntos entre este mes y el anterior (null sin datos)
    acceptanceRate: {
      value: tasa ?? 0,
      changeThisMonth: tasaMes !== null && tasaMesAnterior !== null ? redondear(tasaMes - tasaMesAnterior) : null,
    },
    // reportes sin resolver · reportes recibidos este mes
    openReports: { value: abiertos, changeThisMonth: reportesMes },
    updatedAt: new Date(),
  };
}

let cache: Awaited<ReturnType<typeof calcular>> | undefined;

export async function metricas() {
  try {
    cache = await calcular();
    return { ...cache, stale: false };
  } catch (err) {
    console.error("[admin] no se pudieron calcular las métricas", err);
    if (cache) return { ...cache, stale: true };
    throw new HttpError(503, "METRICS_UNAVAILABLE", "No se pudieron calcular las métricas");
  }
}
