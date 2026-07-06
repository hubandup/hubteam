import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Copy, RefreshCw, Send, Loader2, Check } from "lucide-react";

/**
 * AssistantCard — recurring AI motif for Hub+Up.
 * Navy gradient tile with lime sparkle badge, states: empty → loading → result.
 *
 * @example
 * <AssistantCard
 *   title="Assistant de relance"
 *   subtitle="Génère un message de relance personnalisé pour ce contact"
 *   state={loading ? "loading" : result ? "result" : "empty"}
 *   result={result}
 *   emptyMessage="Aucune relance générée pour l'instant."
 *   primaryAction={{ label: "Générer une relance", onClick: handleGenerate }}
 *   onCopy={() => navigator.clipboard.writeText(result)}
 *   onSend={handleSend}
 *   onRegenerate={handleGenerate}
 * />
 */
export type AssistantState = "empty" | "loading" | "result";

export interface AssistantCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  state: AssistantState;
  result?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  primaryAction?: { label: React.ReactNode; onClick: () => void };
  onCopy?: () => void;
  onSend?: () => void;
  onRegenerate?: () => void;
  className?: string;
  footer?: React.ReactNode;
}

export function AssistantCard({
  title,
  subtitle,
  state,
  result,
  emptyMessage,
  primaryAction,
  onCopy,
  onSend,
  onRegenerate,
  footer,
  className,
}: AssistantCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!onCopy) return;
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className={cn("bg-card border border-border overflow-hidden", className)}
      style={{ borderRadius: 18 }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-6 pt-5">
        <span
          className="inline-flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, hsl(var(--navy)), hsl(var(--navy-hover)))",
          }}
        >
          <Sparkles size={18} style={{ color: "hsl(var(--lime))" }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="display font-bold text-ink" style={{ fontSize: 17, lineHeight: 1.2 }}>
              {title}
            </h3>
            <span
              className="inline-flex items-center font-bold tracking-wider uppercase"
              style={{
                background: "hsl(var(--lime))",
                color: "hsl(var(--lime-foreground))",
                padding: "2px 6px",
                fontSize: 9,
                borderRadius: 4,
              }}
            >
              IA
            </span>
          </div>
          {subtitle && (
            <p className="text-muted-foreground" style={{ fontSize: 12.5, marginTop: 2 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pt-5 pb-6">
        {state === "empty" && (
          <div className="text-center space-y-4">
            {emptyMessage && (
              <p
                className="text-muted-foreground mx-auto"
                style={{ fontSize: 13, maxWidth: 480 }}
              >
                {emptyMessage}
              </p>
            )}
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-2 font-semibold hover:opacity-90 transition-opacity"
                style={{
                  background: "hsl(var(--lime))",
                  color: "hsl(var(--lime-foreground))",
                  padding: "10px 20px",
                  fontSize: 13,
                  borderRadius: 9999,
                }}
              >
                <Sparkles size={14} strokeWidth={2.5} />
                {primaryAction.label}
              </button>
            )}
          </div>
        )}

        {state === "loading" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" />
              Génération en cours…
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-full animate-pulse w-11/12" />
              <div className="h-3 bg-muted rounded-full animate-pulse w-full" />
              <div className="h-3 bg-muted rounded-full animate-pulse w-4/5" />
            </div>
          </div>
        )}

        {state === "result" && (
          <div className="space-y-3">
            <div
              className="text-foreground whitespace-pre-wrap"
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                background: "hsl(var(--muted))",
                borderRadius: 12,
                padding: 16,
              }}
            >
              {result}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onCopy && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium border transition-colors",
                    copied
                      ? "border-pill-success bg-pill-success-bg text-pill-success"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                  style={{ padding: "6px 12px", fontSize: 12, borderRadius: 9999 }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copié" : "Copier"}
                </button>
              )}
              {onSend && (
                <button
                  type="button"
                  onClick={onSend}
                  className="inline-flex items-center gap-1.5 font-medium border border-border text-foreground hover:bg-muted transition-colors"
                  style={{ padding: "6px 12px", fontSize: 12, borderRadius: 9999 }}
                >
                  <Send size={12} /> Envoyer
                </button>
              )}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1.5 font-medium border border-border text-foreground hover:bg-muted transition-colors"
                  style={{ padding: "6px 12px", fontSize: 12, borderRadius: 9999 }}
                >
                  <RefreshCw size={12} /> Régénérer
                </button>
              )}
            </div>
          </div>
        )}

        {footer && <div className="mt-4 pt-4 border-t border-border">{footer}</div>}
      </div>
    </section>
  );
}
