"use client";

export function ExpectedReturnBadge({ pricePerToken }: { pricePerToken: number }) {
  const ret = ((1 / pricePerToken) - 1) * 100;
  if (ret <= 0) return null;
  return (
    <span className="text-success font-semibold text-sm">
      +{ret.toFixed(1)}%
    </span>
  );
}
