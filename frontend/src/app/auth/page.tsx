"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LuLock as Lock,
  LuMail as Mail,
  LuUser as User,
  LuArrowRight as ArrowRight,
  LuEye as Eye,
  LuEyeOff as EyeOff,
  LuCircleAlert as AlertCircle,
  LuLoader as Loader2,
  LuTrendingUp as TrendingUp,
  LuShieldCheck as ShieldCheck,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/square";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authError = searchParams.get("error");
    if (!authError) return;

    if (authError === "OAuthSignin") {
      setError(
        "Google Sign-In is not configured yet. Please provide GOOGLE_CLIENT_ID in frontend/.env.local or sign in with your email and password."
      );
    } else if (authError === "AccessDenied") {
      setError(
        "Google sign-in could not finish setting up your account. Please try again. If this continues, check the backend logs for the account sync error."
      );
    } else {
      setError("Authentication error: " + authError);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const query = params.toString();
    router.replace(query ? `/auth?${query}` : "/auth", { scroll: false });
  }, [router, searchParams]);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetErrors = () => {
    setError(null);
  };

  const handleModeSwitch = (newMode: "signin" | "signup") => {
    setMode(newMode);
    resetErrors();
  };

  // Sign in handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

  // Sign up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (!firstName || !lastName || !email || !password) {
      setError("All fields are required to create an account.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      // Automatically sign in the newly registered user
      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (loginRes?.error) {
        // If auto login fails, switch to sign in mode
        setMode("signin");
        setError("Account created! Please sign in with your credentials.");
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Error connecting to server. Please try again.");
      setLoading(false);
    }
  };

  // Google sign in handler
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    resetErrors();
    try {
      const providers = await getProviders();
      if (!providers?.google) {
        setError(
          "Google Sign-In is not active because GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are empty in frontend/.env.local. Please add your Google OAuth credentials or sign in with Email & Password."
        );
        setGoogleLoading(false);
        return;
      }
      await signIn("google", { callbackUrl });
    } catch (err: any) {
      setError("Failed to initiate Google authentication.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Glow highlight */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/15" />

      {/* Header */}
      <div className="relative mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Liquidity Square
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {mode === "signin"
            ? "Sign in to access markets, news, and the Square stream."
            : "Create your account to unlock terminal insights & trades."}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="relative mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs font-semibold sm:text-sm">
        <button
          type="button"
          onClick={() => handleModeSwitch("signin")}
          className={`relative rounded-lg py-2 transition-all duration-200 ${
            mode === "signin"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch("signup")}
          className={`relative rounded-lg py-2 transition-all duration-200 ${
            mode === "signup"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive dark:border-destructive/40 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Sign In Button */}
      <div className="mb-5">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="relative flex w-full items-center justify-center gap-3 border-border/80 bg-background/50 py-5 text-xs font-medium hover:bg-accent sm:text-sm"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </Button>
      </div>

      {/* Divider */}
      <div className="relative mb-5 flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="bg-card px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          or with email
        </span>
        <div className="w-full border-t border-border" />
      </div>

      {/* Auth Forms */}
      {mode === "signin" ? (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signin-email" className="text-xs font-medium">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signin-email"
                type="email"
                placeholder="trader@liquidity.pro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password" className="text-xs font-medium">
                Password
              </Label>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 pr-9 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-2 w-full gap-2 bg-emerald-600 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Enter Square</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-3.5">
          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signup-firstname" className="text-xs font-medium">
                First Name
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="signup-firstname"
                  type="text"
                  placeholder="Alex"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="pl-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-lastname" className="text-xs font-medium">
                Last Name
              </Label>
              <Input
                id="signup-lastname"
                type="text"
                placeholder="Morgan"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-email" className="text-xs font-medium">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-email"
                type="email"
                placeholder="trader@liquidity.pro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-password" className="text-xs font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 pr-9 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirmpassword" className="text-xs font-medium">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-confirmpassword"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-2 w-full gap-2 bg-emerald-600 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Create Account & Continue</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* Security note */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>Protected with NextAuth & PostgreSQL encryption</span>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      {/* Background radial gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        }
      >
        <AuthForm />
      </Suspense>
    </div>
  );
}
