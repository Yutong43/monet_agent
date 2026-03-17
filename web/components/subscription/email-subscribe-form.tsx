"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type EmailSubscribeFormProps = {
  source: "landing" | "app";
  initialEmail?: string;
  title?: string;
  description?: string;
  variant?: "card" | "compact" | "bare";
  onSuccess?: () => void;
};

export function EmailSubscribeForm({
  source,
  initialEmail = "",
  title = "Subscribe to Monet's Daily Recap",
  description = "Get a concise executive summary of the day delivered to your inbox.",
  variant = "card",
  onSuccess,
}: EmailSubscribeFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source !== "app" || initialEmail) {
      return;
    }

    async function loadUserEmail() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail((current) => current || data.user?.email || "");
      }
    }

    loadUserEmail();
  }, [initialEmail, source]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          source,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Could not subscribe right now.");
      }

      setMessage(data?.message ?? "You're subscribed.");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not subscribe right now.");
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          required
          aria-label="Email address"
          className={variant === "compact" ? "bg-background" : undefined}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Subscribe"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </form>
  );

  if (variant === "bare") {
    return form;
  }

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border bg-card/60 p-5 backdrop-blur">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" />
          {title}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        {form}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
