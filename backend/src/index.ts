import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middlewares
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth Routes
app.use("/api/auth", authRouter);

// Start server (only in local / non-Vercel environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Liquidity Square Backend running at http://localhost:${PORT}`);
  });
}

export default app;
// @ts-ignore
if (typeof module !== "undefined" && module.exports) {
  module.exports = app;
  module.exports.default = app;
}
