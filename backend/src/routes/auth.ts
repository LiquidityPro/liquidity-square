import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: "First name, last name, email, and password are required" });
      return;
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const trimmedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.password) {
      res.status(400).json({
        error: "This account was registered with Google. Please use Google Sign In.",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.suspendedAt) {
      res.status(403).json({ error: "This account has been taken down" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google
authRouter.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, firstName, lastName, image, googleId } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required for Google authentication" });
      return;
    }

    const trimmedEmail = email.toLowerCase().trim();
    console.log("➡️ [Backend] Processing Google OAuth sync for:", trimmedEmail);

    const user = await prisma.user.upsert({
      where: { email: trimmedEmail },
      update: {
        googleId: googleId || undefined,
        image: image || undefined,
      },
      create: {
        email: trimmedEmail,
        firstName: firstName || "User",
        lastName: lastName || "",
        googleId,
        image,
      },
    });

    console.log("✅ [Backend] Successfully synced user into Supabase:", user.id, user.email);

    if (user.suspendedAt) {
      res.status(403).json({ error: "This account has been taken down" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(200).json({
      message: "Google login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
authRouter.get("/me", authenticateJwt, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        image: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
