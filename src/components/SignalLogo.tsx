interface TokeruLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Tokeru logo — the letter T melting into a droplet.
 * Represents frozen contracts becoming liquid assets.
 * SVG, works at any size, transparent background.
 */
export function TokeruLogo({ size = 32, className, color = "currentColor" }: TokeruLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Tokeru"
    >
      {/* T crossbar with rounded corners */}
      <rect x="4" y="2" width="92" height="22" rx="6" fill={color} />
      {/* T stem melting into a smooth rounded droplet */}
      <path
        d="M36 2 h28 v48 c0 8 -1 18 8 36 c6 12 12 20 12 30 c0 8 -6 14 -16 18 c-6 2 -12 3 -18 3 s-12 -1 -18 -3 c-10 -4 -16 -10 -16 -18 c0 -10 6 -18 12 -30 c9 -18 8 -28 8 -36 V2z"
        fill={color}
      />
    </svg>
  );
}
