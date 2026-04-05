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
export function TokeruLogo({ size = 24, className, color = "currentColor" }: TokeruLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 300"
      width={size}
      height={size * 1.5}
      className={className}
      aria-label="Tokeru"
    >
      <path
        d="M 25 20
           L 175 20
           A 8 8 0 0 1 183 28
           L 183 42
           A 8 8 0 0 1 175 50
           L 122 50
           A 5 5 0 0 0 117 55
           L 117 155
           C 117 205, 150 215, 150 250
           A 50 50 0 0 1 50 250
           C 50 215, 83 205, 83 155
           L 83 55
           A 5 5 0 0 0 78 50
           L 25 50
           A 8 8 0 0 1 17 42
           L 17 28
           A 8 8 0 0 1 25 20
           Z"
        fill={color}
      />
    </svg>
  );
}
