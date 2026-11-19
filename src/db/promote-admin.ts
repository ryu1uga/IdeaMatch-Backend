import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Da (o quita) el rol de administrador a una cuenta existente.
//   npm run admin:promote -- correo@ejemplo.com
//   npm run admin:promote -- correo@ejemplo.com --remove
// En el contenedor de producción: node dist/db/promote-admin.js correo@ejemplo.com

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Uso: npm run admin:promote -- <correo> [--remove]");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const esAdmin = flag !== "--remove";

prisma.usuario
  .update({ where: { email: email.toLowerCase() }, data: { esAdmin }, select: { email: true } })
  .then((u) => console.log(`${u.email} ${esAdmin ? "ahora es administrador" : "ya no es administrador"}`))
  .catch(() => {
    console.error(`No existe una cuenta con el correo ${email}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
