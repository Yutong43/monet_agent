"use client";

import { useState, useEffect } from "react";
import { Mail, TrendingUp, BookOpen, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmailSubscribeForm } from "@/components/subscription/email-subscribe-form";
import { cn } from "@/lib/utils";

type SubscribeModalProps = {
  source: "landing" | "app";
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "ghost" | "link" | "outline";
  triggerSize?: "default" | "sm" | "lg";
  showIcon?: boolean;
  /** If set, auto-opens the modal after this many ms on first visit (uses localStorage to fire only once). */
  autoOpenAfterMs?: number;
};

const WHAT_YOU_GET = [
  {
    icon: TrendingUp,
    label: "Portfolio equity, daily P&L, and return vs SPY",
  },
  {
    icon: BookOpen,
    label: "Monet's executive summary of the trading day",
  },
  {
    icon: ArrowRightLeft,
    label: "Every trade placed, with the factor score behind it",
  },
];

const POPUP_KEY = "monet_recap_popup_shown";

export function SubscribeModal({
  source,
  triggerLabel = "Daily Recap",
  triggerClassName,
  triggerVariant = "ghost",
  triggerSize = "default",
  showIcon = true,
  autoOpenAfterMs,
}: SubscribeModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpenAfterMs) return;
    if (localStorage.getItem(POPUP_KEY)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      localStorage.setItem(POPUP_KEY, "1");
    }, autoOpenAfterMs);
    return () => clearTimeout(timer);
  }, [autoOpenAfterMs]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn(triggerClassName)}
        >
          {showIcon && <Mail className="size-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        {/* Header band */}
        <div className="bg-[#111827] px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mail className="size-4 opacity-70" />
              Monet Daily Recap
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-white/60 leading-relaxed">
            Delivered to your inbox every weekday at market close.
          </p>
        </div>

        {/* What's included */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            What&apos;s included
          </p>
          {WHAT_YOU_GET.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-3 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{label}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Subscribe form */}
        <div className="px-6 py-4">
          <EmailSubscribeForm
            source={source}
            variant="bare"
            onSuccess={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
