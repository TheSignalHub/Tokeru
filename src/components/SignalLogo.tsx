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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 360"
      width={size}
      height={size * 1.6}
      className={className}
      aria-label="Tokeru"
    >
      <path
        d="M 30 40
           L 170 40
           A 10 10 0 0 1 180 50
           L 180 70
           A 10 10 0 0 1 170 80
           L 125 80
           A 5 5 0 0 0 120 85
           L 120 200
           C 120 260, 155 260, 155 305
           A 55 55 0 0 1 45 305
           C 45 260, 80 260, 80 200
           L 80 85
           A 5 5 0 0 0 75 80
           L 30 80
           A 10 10 0 0 1 20 70
           L 20 50
           A 10 10 0 0 1 30 40
           Z"
        fill={color}
      />
    </svg>
  );
}
