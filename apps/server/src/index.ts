import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import type { ClientToServerEvents, ServerToClientEvents } from "@musicapp/shared";
import { env } from "./lib/env";
import { HttpError } from "./lib/http-error";
import { logger } from "./lib/logger";
import { createRoomsRouter } from "./routes/rooms";
import { createQueueRouter } from "./routes/queue";
import { registerSocketHandlers } from "./socket";
import type { SocketData } from "./types/socket";

const app = express();
// Behind Railway's (or any) reverse proxy, this is needed for correct protocol/IP detection.
app.set("trust proxy", 1);
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: env.clientOrigins },
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/rooms", createRoomsRouter(io));
app.use("/api/rooms", createQueueRouter(io));

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  // Malformed JSON body from express.json().
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ message: "Not found" });
    return;
  }

  logger.error("http", `Unhandled error on ${req.method} ${req.path}`, err);
  res.status(500).json({ message: "Internal server error" });
};
app.use(errorHandler);

registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  logger.info("startup", `musicapp server listening on http://localhost:${env.port}`);
});
