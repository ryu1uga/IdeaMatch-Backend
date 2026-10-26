// Las PK son BIGSERIAL -> Prisma las devuelve como BigInt, y JSON.stringify
// no sabe serializar BigInt. Este parche las envía como string en las respuestas.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
