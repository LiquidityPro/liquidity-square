import { Router, Response } from "express";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { filingWindow, listFilings, markFilingsSeen, syncDisclosures, sweepDisclosures } from "../lib/disclosures";
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

// GET /api/disclosures?days=7|30|183 — stored filings for the Notifications tab
disclosuresRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const days = filingWindow(req.query.days);
    const filings = await listFilings(days);
    res.status(200).json({
      filings: filings.map((filing) => ({ ...filing, filedAt: filing.filedAt.toISOString() })),
    });
  } catch (error) {
    console.error("List filings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/disclosures/seen — opening Filings clears the unread pile
disclosuresRouter.post("/seen", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await markFilingsSeen(req.userId!);
    res.status(204).end();
  } catch (error) {
    console.error("Mark filings seen error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/disclosures/sync — store the catalog. Individual filings are not notified.
disclosuresRouter.post("/sync", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await syncDisclosures(req.userId!);
    res.status(200).json(result);
  } catch (error) {
    console.error("Sync disclosures error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
