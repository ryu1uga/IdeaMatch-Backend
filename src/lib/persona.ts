// Datos públicos mínimos de una persona (autor de mensaje, miembro de equipo, etc.)

export const personaSelect = { id: true, nombres: true, apellidos: true, perfil: { select: { fotoUrl: true } } } as const;

export interface PersonaRow {
  id: bigint;
  nombres: string;
  apellidos: string;
  perfil: { fotoUrl: string | null } | null;
}

export const nombreCompleto = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`.trim();
export const iniciales = (u: { nombres: string; apellidos: string }) =>
  `${u.nombres.trim().charAt(0)}${u.apellidos.trim().charAt(0)}`.toUpperCase();

export const toPersona = (u: PersonaRow) => ({
  id: u.id,
  name: nombreCompleto(u),
  initials: iniciales(u),
  photoUrl: u.perfil?.fotoUrl ?? null,
});

/** Iniciales de un proyecto: primeras letras de las dos primeras palabras */
export const inicialesProyecto = (titulo: string) =>
  titulo
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
