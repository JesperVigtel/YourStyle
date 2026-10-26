"use client";

import { useState } from "react";
import { Button, ErrorNote, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";

/**
 * Email sign-in. The email contains a link and a 6-digit code: on the installed iPhone app use
 * the code (links open in Safari, which doesn't share the home-screen app's session).
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/otp", {
        method: "POST",
        json: { email: email.trim() },
      });
      setStage("code");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/verify", {
        method: "POST",
        json: { email: email.trim(), token: code.trim() },
      });
      // Full reload so the new session cookie applies to every request.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/today";
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pt-safe px-safe mx-auto flex min-h-screen max-w-sm flex-col justify-center pb-16">
      <h1 className="text-3xl font-semibold">Wardrobe</h1>
      <p className="mt-1 text-sm text-muted">Your personal style & shopping assistant.</p>
      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (stage === "email") send();
          else verify();
        }}
      >
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="you@example.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={stage === "code"}
          required
        />
        {stage === "code" && (
          <>
            <p className="text-sm text-muted">
              Check your email. Enter the code here, or open the link on this device.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputClass} tracking-[0.4em]`}
              placeholder="123456"
              aria-label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : stage === "email" ? "Email me a code" : "Sign in"}
        </Button>
        {stage === "code" && (
          <button type="button" className="h-11 w-full text-sm text-muted underline" onClick={() => setStage("email")}>
            Use a different email
          </button>
        )}
      </form>
    </main>
  );
}
