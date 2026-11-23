import type { PoolConfig } from "pg";

// ---------------------------------------------------------------------------
// Configuración de la conexión de node-postgres a partir de DATABASE_URL.
//
// node-postgres trata `sslmode=require` como `verify-full` (valida la CA). Con
// Supabase eso falla ("self-signed certificate in certificate chain") porque su
// CA no está en Node. Aquí se interpreta `sslmode` como lo hacen psql y la CLI
// de Prisma, que usa la MISMA DATABASE_URL para las migraciones:
//
//   sin sslmode / disable  -> sin SSL (PostgreSQL local o Docker)
//   require / prefer       -> SSL cifrado, sin validar el certificado
//   verify-ca              -> valida la cadena del certificado (no el nombre del host)
//   verify-full            -> valida la cadena y el nombre del host
//
// Con DATABASE_CA_CERT (PEM, p. ej. el certificado de Supabase) la cadena se valida
// contra ese CA; con `require` se comporta como `verify-ca`, igual que libpq.
// ---------------------------------------------------------------------------

const PARAMS_SSL = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];

export function pgConfig(databaseUrl: string, caCert?: string): PoolConfig {
  const url = new URL(databaseUrl);
  const modo = url.searchParams.get("sslmode")?.toLowerCase();
  for (const p of PARAMS_SSL) url.searchParams.delete(p);

  // En variables de entorno de una sola línea el PEM suele venir con "\n" literales
  const ca = caCert?.trim() ? caCert.replace(/\\n/g, "\n") : undefined;

  let ssl: PoolConfig["ssl"];
  if (modo === "disable" || modo === "allow" || (!modo && !ca)) {
    ssl = false;
  } else if (modo === "verify-full") {
    ssl = { rejectUnauthorized: true, ...(ca && { ca }) };
  } else if (modo === "verify-ca" || ca) {
    // valida la cadena pero no el nombre del host
    ssl = { rejectUnauthorized: true, ...(ca && { ca }), checkServerIdentity: () => undefined };
  } else {
    ssl = { rejectUnauthorized: false }; // require, prefer, no-verify
  }
  return { connectionString: url.toString(), ssl };
}
