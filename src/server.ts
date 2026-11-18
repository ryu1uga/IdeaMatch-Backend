import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { attachRealtime } from "./lib/realtime.js";

const server = app.listen(env.PORT, () => {
  console.log(`IdeaMatch API escuchando en http://localhost:${env.PORT}`);
});
attachRealtime(server); // WebSocket en /ws?token=<jwt>

async function shutdown(signal: string) {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
