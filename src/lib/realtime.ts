import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { verifyAccessToken } from "../middlewares/auth.js";

// ---------------------------------------------------------------------------
// WebSocket /ws?token=<jwt>
// El servidor envía eventos JSON { type, data }:
//   message:new       { conversationId, message }
//   message:read      { conversationId, userId, readAt }
//   notification:new  { notification }            (Sprint 7)
// El cliente no necesita enviar nada; el polling REST sigue funcionando como respaldo.
// ---------------------------------------------------------------------------

export type RealtimeEvent = "message:new" | "message:read" | "notification:new";

const sockets = new Map<string, Set<WebSocket>>();
const vivos = new WeakSet<WebSocket>();
let wss: WebSocketServer | undefined;

export function emitToUsers(userIds: Iterable<bigint | string>, type: RealtimeEvent, data: unknown) {
  if (!wss) return;
  const payload = JSON.stringify({ type, data });
  for (const id of new Set([...userIds].map(String))) {
    for (const ws of sockets.get(id) ?? []) if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

export function attachRealtime(server: Server) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return socket.destroy();
    let userId: string;
    try {
      userId = (await verifyAccessToken(url.searchParams.get("token") ?? "")).sub;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return socket.destroy();
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      const set = sockets.get(userId) ?? new Set();
      set.add(ws);
      sockets.set(userId, set);
      vivos.add(ws);
      ws.on("pong", () => vivos.add(ws));
      ws.on("close", () => {
        set.delete(ws);
        if (!set.size) sockets.delete(userId);
      });
      ws.send(JSON.stringify({ type: "ready", data: { userId } }));
    });
  });

  // Heartbeat: corta conexiones muertas y mantiene viva la conexión detrás de proxies (Render)
  const timer = setInterval(() => {
    for (const set of sockets.values()) {
      for (const ws of set) {
        if (!vivos.has(ws)) {
          ws.terminate();
          continue;
        }
        vivos.delete(ws);
        ws.ping();
      }
    }
  }, 30_000);
  timer.unref();

  server.on("close", () => {
    clearInterval(timer);
    wss?.clients.forEach((ws) => ws.terminate());
    wss?.close();
  });
}
