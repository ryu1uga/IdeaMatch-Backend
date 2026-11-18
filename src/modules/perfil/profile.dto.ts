// Objeto `profile` del contrato:
// { id, firstName, lastName, photoUrl, headline, location, bio, links, hoursPerWeek, skills[], interests[] }

export const profileSelect = {
  id: true,
  nombres: true,
  apellidos: true,
  perfil: {
    select: {
      fotoUrl: true,
      titular: true,
      ubicacion: true,
      biografia: true,
      linkPortafolio: true,
      linkLinkedin: true,
      linkGithub: true,
      disponibilidadHorasSem: true,
    },
  },
  habilidades: { select: { habilidad: { select: { id: true, nombre: true } } }, orderBy: { habilidad: { nombre: "asc" } } },
  intereses: { select: { categoria: { select: { id: true, nombre: true } } }, orderBy: { categoria: { nombre: "asc" } } },
} as const;

interface ProfileRow {
  id: bigint;
  nombres: string;
  apellidos: string;
  perfil: {
    fotoUrl: string | null;
    titular: string | null;
    ubicacion: string | null;
    biografia: string | null;
    linkPortafolio: string | null;
    linkLinkedin: string | null;
    linkGithub: string | null;
    disponibilidadHorasSem: number | null;
  } | null;
  habilidades: { habilidad: { id: bigint; nombre: string } }[];
  intereses: { categoria: { id: bigint; nombre: string } }[];
}

export const toNamed = (x: { id: bigint; nombre: string }) => ({ id: x.id, name: x.nombre });

export function toProfileDto(u: ProfileRow) {
  const p = u.perfil;
  return {
    id: u.id,
    firstName: u.nombres,
    lastName: u.apellidos,
    photoUrl: p?.fotoUrl ?? null,
    headline: p?.titular ?? null,
    location: p?.ubicacion ?? null,
    bio: p?.biografia ?? null,
    links: {
      portfolio: p?.linkPortafolio ?? null,
      linkedin: p?.linkLinkedin ?? null,
      github: p?.linkGithub ?? null,
    },
    hoursPerWeek: p?.disponibilidadHorasSem ?? null,
    skills: u.habilidades.map((h) => toNamed(h.habilidad)),
    interests: u.intereses.map((i) => toNamed(i.categoria)),
  };
}
