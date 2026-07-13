import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { db } from "./core/db";
import { redisClient } from "./core/db/redis";
import shipmentRoutes from "./routes/shipmentRoutes";
import capacityRoutes from "./routes/capacityRoutes";
import authRoutes from "./routes/authRoutes";
import profileRoutes from "./routes/profileRoutes";
import domainRouter from "./domains/index";
import { errorHandler } from "./core/errors/errorHandler";
import documentsRoutes from "./routes/documentsRoutes";
import { startMatchingWorker } from "./workers/matchingJob";
import { startEmailWorker, scheduleEmailSync } from "./workers/email.worker";
import integrationsRoutes from "./routes/integrationsRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import podPublicRoutes from "./domains/pod/pod.public.routes";
import ratingsRoutes from "./routes/ratingsRoutes";
import companyRoutes from "./routes/companyRoutes";
import { configureSocket } from "./core/realtime/socket";
import { validateSecretsOrExit, validateDeploymentModeOrExit } from "./core/config/secrets";
import { getVersion } from "./core/config/version";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Domain routes (DDD) — new canonical URLs
app.use("/api/v1", domainRouter);

// Legacy aliases — kept for zero-downtime; remove after frontend migrates
app.use("/api/fleet", domainRouter);

// Legacy monolithic routes (migrate domain-by-domain; remove when done)
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/capacity", capacityRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/pod", podPublicRoutes); // public, token-scoped driver POD uploads
app.use("/api/ratings", ratingsRoutes);
app.use("/api/companies", companyRoutes);
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running", version: getVersion() });
});

// Global error handler — must be last
app.use(errorHandler);

// WebSocket: auth + room management. The bus module exposes emitToUser/emitToRoom
// to services so they can publish without importing the Server directly.
configureSocket(io);

const PORT = process.env.PORT || 8080;

async function bootstrap() {
  try {
    // Fail fast on missing/default secrets before any DB/Redis I/O (SEC-01/SEC-02)
    validateSecretsOrExit();

    // Fail fast on missing/invalid DEPLOYMENT_MODE before any DB/Redis I/O (DEP-02)
    validateDeploymentModeOrExit();

    // Connect to database
    await db.query("SELECT 1");
    console.log("PostgreSQL connected");

    // Connect to Redis
    await redisClient.connect();
    console.log("Redis connected");

    // Start background worker
    startMatchingWorker();
    startEmailWorker();
    await scheduleEmailSync();

    server.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

export { app };
