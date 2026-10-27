import "./lib/net-defaults";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth";
import { postsRouter } from "./routes/posts";
import { tickersRouter } from "./routes/tickers";
import { usersRouter } from "./routes/users";
import { searchRouter } from "./routes/search";
import { notificationsRouter } from "./routes/notifications";
import { liveRouter } from "./routes/live";
import { pushRouter } from "./routes/push";
import { messagesRouter } from "./routes/messages";
import { alertsRouter } from "./routes/alerts";
import { safetyRouter } from "./routes/safety";
import { disclosuresRouter } from "./routes/disclosures";
import { ensureListedTickers } from "./lib/listed-tickers";
import { startDisclosurePoller } from "./lib/disclosures";
import { startDraftPoller } from "./lib/drafts";
import { draftsRouter } from "./routes/drafts";
import { adminRouter } from "./routes/admin";

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001";

// Middlewares
app.use(
  cors({
    origin: [FRONTEND_URL, ADMIN_URL, "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    credentials: true,
  })
);
app.use(express.json({ limit: "300kb" }));

// Vercel's /api/server/* rewrite forwards the original path, so strip the prefix before routing.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/server/")) {
    req.url = "/api" + req.url.slice("/api/server".length);
  }
  next();
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth Routes
app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/users", usersRouter);
app.use("/api/tickers", tickersRouter);
app.use("/api/search", searchRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/live", liveRouter);
app.use("/api/push", pushRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/safety", safetyRouter);
app.use("/api/disclosures", disclosuresRouter);
app.use("/api/drafts", draftsRouter);
app.use("/api/admin", adminRouter);

void ensureListedTickers().catch((error) => console.error("Listed ticker sync failed", error));
if (!process.env.VERCEL) {
  startDisclosurePoller();
  startDraftPoller();
}

// Start server (only in local / non-Vercel environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Liquidity Square Backend running at http://localhost:${PORT}`);
  });
}

export default app;
