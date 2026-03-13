import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { db } from "./config/db";
import { redisClient } from "./config/redis";
import shipmentRoutes from "./routes/shipmentRoutes";
import capacityRoutes from "./routes/capacityRoutes";
import authRoutes from "./routes/authRoutes";
import profileRoutes from "./routes/profileRoutes";
import fleetRoutes from "./routes/fleetRoutes";
import documentsRoutes from "./routes/documentsRoutes";
import { startMatchingWorker } from "./workers/matchingJob";
import integrationsRoutes from "./routes/integrationsRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import ratingsRoutes from "./routes/ratingsRoutes";
import companyRoutes from "./routes/companyRoutes";

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/capacity", capacityRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/companies", companyRoutes);
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "VECTRA backend running" });
});

// WebSocket connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 8080;

async function bootstrap() {
  try {
    // Connect to database
    await db.query("SELECT 1");
    console.log("PostgreSQL connected");

    // Connect to Redis
    await redisClient.connect();
    console.log("Redis connected");

    // Start background worker
    startMatchingWorker();

    server.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();
