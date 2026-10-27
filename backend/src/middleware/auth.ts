import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { promoteListedStaff, staffEmailSet } from "../lib/staff";

export interface AuthenticatedRequest<P = Request["params"]> extends Request<P> {
  userId?: string;
  staff?: boolean;
}

export async function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const account = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, staff: true, suspendedAt: true },
    });
    if (!account || account.suspendedAt) {
      res.status(401).json({
        error: account?.suspendedAt ? "This account has been taken down" : "Invalid or expired token",
      });
      return;
    }
    let staff = account.staff;
    if (!staff && staffEmailSet().has(account.email.toLowerCase())) {
      staff = (await promoteListedStaff(account)) || account.staff;
    }
    req.userId = account.id;
    req.staff = staff;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    console.error("Auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireStaff(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.staff) {
    res.status(403).json({ error: "Staff only" });
    return;
  }
  next();
}
