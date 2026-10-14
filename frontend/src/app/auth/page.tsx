"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { LuEye as Eye, LuEyeOff as EyeOff, LuLoader as Loader2 } from "react-icons/lu";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstallAppButton } from "@/components/pwa/install-button";

const fieldClass =
  "h-12 rounded-[10px] border-[#0F5A3D]/20 bg-white px-3.5 text-base text-[#14241C] shadow-none placeholder:text-[#8A9690] focus-visible:border-[#0F5A3D] focus-visible:ring-1 focus-visible:ring-[#0F5A3D] md:text-base os-dark:border-white/15 os-dark:bg-[#121C18] os-dark:text-[#F2F5F0] os-dark:placeholder:text-[#8A9A92] os-dark:focus-visible:border-[#D4FF5A] os-dark:focus-visible:ring-[#D4FF5A]";

const labelClass = "text-sm font-medium text-[#14241C] os-dark:text-[#F2F5F0]";

const authFont = {
  fontFamily: "var(--font-auth), Inter, ui-sans-serif, system-ui, sans-serif",
} as const;

function Wordmark() {
  return (
    <>
      <Image
        src="/liquidity_square_light_combined.svg"
        alt="Liquidity Square"
        width={645}
        height={220}
        priority
        className="h-auto w-36 os-dark:hidden sm:w-40"
      />
      <Image
        src="/liquidity_square_dark_combined.svg"
        alt=""
        width={645}
        height={220}
        priority
        aria-hidden
        className="hidden h-auto w-36 os-dark:block sm:w-40"
      />
    </>
  );
}

function Editorial() {
  return (
    <div className="relative hidden md:block">
      <aside className="sticky top-0 h-dvh overflow-hidden bg-[#F4F7F2] os-dark:bg-[#0B1210]">
        <Image
          src="/auth-panel.jpg"
          alt=""
          fill
          priority
          unoptimized
          sizes="50vw"
          className="object-cover object-center os-dark:brightness-[0.42] os-dark:saturate-125"
        />
        <div className="pointer-events-none absolute inset-0 bg-[#04110c]/0 os-dark:bg-[#04110c]/45" />
        <div className="absolute left-7 top-14 z-10 lg:left-9 lg:top-16">
          <Wordmark />
        </div>
      </aside>
    </div>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/square";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetErrors = () => setError(null);

  const handleModeSwitch = (newMode: "signin" | "signup") => {
    setMode(newMode);
    resetErrors();
    setShowPassword(false);
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

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
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (loginRes?.error) {
        setMode("signin");
        setError("Account created! Please sign in with your credentials.");
        setLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to server. Please try again.");
      setLoading(false);
    }
  };

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
    } catch {
      setError("Failed to initiate Google authentication.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px]" style={authFont}>
      <div className="mb-8 md:hidden">
        <Wordmark />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <h1 className="text-[1.85rem] font-extrabold uppercase leading-none tracking-[-0.03em] text-[#14241C] os-dark:text-[#F2F5F0] sm:text-[2rem]">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-3 text-[15px] text-[#5C6B64] os-dark:text-[#A9B8B0]">
            {mode === "signin"
              ? "Welcome back! Please enter your details."
              : "Create your account. Please enter your details."}
          </p>

          {error && (
            <p role="alert" className="mt-4 text-sm leading-relaxed text-[#9F2D2D] os-dark:text-[#FF9B8E]">
              {error}
            </p>
          )}

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="mt-8">
              <div className="space-y-5">
                <Field label="Email" htmlFor="signin-email">
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={fieldClass}
                  />
                </Field>
                <Field label="Password" htmlFor="signin-password">
                  <PasswordField
                    id="signin-password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    shown={showPassword}
                    onChange={setPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </Field>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5C6B64] os-dark:text-[#A9B8B0]">
                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border border-[#0F5A3D]/30 accent-[#0F5A3D] os-dark:border-white/25 os-dark:accent-[#D4FF5A]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setError("Password reset isn’t available yet. Sign in with your email, or continue with Google.")
                  }
                  className="shrink-0 hover:text-[#14241C] os-dark:hover:text-[#F2F5F0]"
                >
                  Forgot password
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <SubmitButton loading={loading} disabled={loading || googleLoading}>
                  Sign in
                </SubmitButton>
                <GoogleButton
                  loading={googleLoading}
                  disabled={loading || googleLoading}
                  onClick={handleGoogleSignIn}
                  label="Sign in with Google"
                />
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="mt-8">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2">
                  <Field label="First name" htmlFor="signup-firstname">
                    <Input
                      id="signup-firstname"
                      name="given-name"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Enter your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Last name" htmlFor="signup-lastname">
                    <Input
                      id="signup-lastname"
                      name="family-name"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Enter your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className={fieldClass}
                    />
                  </Field>
                </div>

                <Field label="Email" htmlFor="signup-email">
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={fieldClass}
                  />
                </Field>

                <Field label="Password" htmlFor="signup-password">
                  <PasswordField
                    id="signup-password"
                    name="new-password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    shown={showPassword}
                    onChange={setPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </Field>

                <Field label="Confirm password" htmlFor="signup-confirmpassword">
                  <Input
                    id="signup-confirmpassword"
                    name="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="mt-5 space-y-3">
                <SubmitButton loading={loading} disabled={loading || googleLoading}>
                  Sign up
                </SubmitButton>
                <GoogleButton
                  loading={googleLoading}
                  disabled={loading || googleLoading}
                  onClick={handleGoogleSignIn}
                  label="Sign up with Google"
                />
              </div>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-[#5C6B64] os-dark:text-[#A9B8B0]">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signup")}
                  className="font-medium text-[#0F5A3D] hover:underline os-dark:text-[#D4FF5A]"
                >
                  Sign up for free!
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signin")}
                  className="font-medium text-[#0F5A3D] hover:underline os-dark:text-[#D4FF5A]"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </motion.div>
      </AnimatePresence>
      <InstallAppButton variant="quiet" />
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className={labelClass}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function PasswordField({
  id,
  name,
  autoComplete,
  placeholder,
  value,
  shown,
  onChange,
  onToggle,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder: string;
  value: string;
  shown: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className={`${fieldClass} pr-11`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-[#6B7872] hover:text-[#14241C] os-dark:text-[#A9B8B0] os-dark:hover:text-[#F2F5F0]"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SubmitButton({
  children,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center rounded-[10px] bg-[#0F5A3D] text-[15px] font-semibold text-[#D4FF5A] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 os-dark:bg-[#D4FF5A] os-dark:text-[#0F5A3D]"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function GoogleButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#0F5A3D]/20 bg-white text-[15px] font-semibold text-[#14241C] transition-colors hover:bg-[#F3F6F1] disabled:cursor-not-allowed disabled:opacity-60 os-dark:border-white/15 os-dark:bg-[#121C18] os-dark:text-[#F2F5F0] os-dark:hover:bg-[#18241e]"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#6B7872]" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

function FormFallback() {
  return (
    <div className="flex min-h-dvh items-center px-6">
      <Loader2 className="h-5 w-5 animate-spin text-[#6B7872]" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-dvh bg-[#F4F7F2] text-[#14241C] os-dark:bg-[#0B1210] os-dark:text-[#F2F5F0]" style={{ colorScheme: "light dark" }}>
      <div className="md:grid md:grid-cols-2 md:items-stretch">
        <Editorial />
        <div className="relative flex min-h-dvh flex-col justify-center px-5 py-12 sm:px-8 md:px-10 lg:px-14">
          <Suspense fallback={<FormFallback />}>
            <div className="mx-auto w-full max-w-[420px]">
              <AuthForm />
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
