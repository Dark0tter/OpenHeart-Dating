import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50",
        variant === "primary" &&
          "bg-coral text-cream hover:bg-coral-deep rounded-md",
        variant === "secondary" &&
          "bg-forest text-cream hover:bg-ink rounded-md",
        variant === "ghost" &&
          "bg-transparent text-forest hover:bg-mist/80 rounded-md",
        variant === "danger" &&
          "bg-coral-deep text-cream hover:bg-ink rounded-md",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-base",
        className,
      )}
      {...props}
    />
  );
}
