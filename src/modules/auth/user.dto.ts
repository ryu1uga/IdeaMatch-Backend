// Objeto `user` del contrato: { id, firstName, lastName, email, isAdmin, createdAt }.
// Nunca incluye la contraseña.

export const userSelect = {
  id: true,
  nombres: true,
  apellidos: true,
  email: true,
  esAdmin: true,
  fechaRegistro: true,
} as const;

export interface UserRow {
  id: bigint;
  nombres: string;
  apellidos: string;
  email: string;
  esAdmin: boolean;
  fechaRegistro: Date;
}

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    firstName: u.nombres,
    lastName: u.apellidos,
    email: u.email,
    isAdmin: u.esAdmin,
    createdAt: u.fechaRegistro,
  };
}
