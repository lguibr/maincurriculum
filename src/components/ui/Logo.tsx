import { cn } from "@/lib/utils";
import React from "react";

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  speed?: string;
}

export function Logo({ className, speed = "6s", alt = "Logo", style, ...props }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={cn("animate-spin", className)}
      style={{ animationDuration: speed, ...style }}
      {...props}
    />
  );
}
