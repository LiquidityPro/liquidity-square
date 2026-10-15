import { Router, Response } from "express";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { syncDisclosures, sweepDisclosures } from "../lib/disclosures";
import { getFilings, noticesFromBody } from "../lib/ngx-filings";

export const disclosuresRouter = Router();

function sweepAllowed(req: AuthenticatedRequest) {
  const secret = process.env.ALERT_SWEEP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.get("x-sweep-key") === secret;
}

// POST /api/disclosures/sweep — newer filings for people who already caught up
disclosuresRouter.post("/sweep", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!sweepAllowed(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const supplied = noticesFromBody(req.body?.filings);
    const filings = supplied.length > 0 ? supplied : await getFilings();
    const result = await sweepDisclosures(filings);
    res.status(200).json(result);
  } catch (error) {
    console.error("Sweep disclosures error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

disclosuresRouter.use(authenticateJwt);

// POST /api/disclosures/sync — last five on the first sign-in, then only newer filings
disclosuresRouter.post("/sync", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await syncDisclosures(req.userId!);
    res.status(200).json(result);
  } catch (error) {
    console.error("Sync disclosures error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
