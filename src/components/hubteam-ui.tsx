import React from "react";

export const SectionTitle = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      fontFamily: "'Instrument Sans', sans-serif",
      fontWeight: 700,
      fontSize: 14,
      color: "hsl(var(--foreground))",
      letterSpacing: "-0.01em",
      marginBottom: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Widget = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
      background: "hsl(var(--card))",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    {children}
  </div>
);

export const SeeMore = ({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      marginTop: 10,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Instrument Sans', sans-serif",
      fontWeight: 600,
      fontSize: 11,
      color: "hsl(var(--muted-foreground))",
      letterSpacing: "0.04em",
      textAlign: "left",
      padding: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    +{count} de plus →
  </button>
);
