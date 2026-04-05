import Image from "next/image";

interface TokeruLogoProps {
  size?: number;
  className?: string;
}

export function TokeruLogo({ size = 32, className }: TokeruLogoProps) {
  return (
    <Image
      src="/signal-logo.jpeg"
      alt="Tokeru"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
