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
      {/* T crossbar */}
      <rect x="4" y="4" width="92" height="22" rx="6" fill={color} />
      {/* T stem melting into droplet */}
      <path
        d="M36 4 h28 v50 c0 0 0 12 6 24 c6 12 14 22 14 34 c0 18 -16 22 -34 22 s-34 -4 -34 -22 c0 -12 8 -22 14 -34 c6 -12 6 -24 6 -24 V4z"
        fill={color}
      />
    </svg>
  );
}
