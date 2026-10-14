import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { vapidPublicKey } from "../lib/push";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const pushRouter = Router();

pushRouter.use(authenticateJwt);

// GET /api/push/vapid-public-key
pushRouter.get("/vapid-public-key", (_req: AuthenticatedRequest, res: Response): void => {
  const publicKey = vapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: "Push notifications are not configured" });
    return;
  }
  res.status(200).json({ publicKey });
});

// PUT /api/push/subscription — save this browser or phone
pushRouter.put("/subscription", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
    const p256dh = typeof req.body?.keys?.p256dh === "string" ? req.body.keys.p256dh : "";
    const auth = typeof req.body?.keys?.auth === "string" ? req.body.keys.auth : "";

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: "A push subscription endpoint and keys are required" });
      return;
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: req.userId!, endpoint, p256dh, auth },
      update: { userId: req.userId!, p256dh, auth },
    });
    res.status(204).end();
  } catch (error) {
    console.error("Save push subscription error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/push/subscription
pushRouter.delete("/subscription", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
    if (!endpoint) {
      res.status(400).json({ error: "A push subscription endpoint is required" });
      return;
    }
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
    res.status(204).end();
  } catch (error) {
    console.error("Delete push subscription error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
