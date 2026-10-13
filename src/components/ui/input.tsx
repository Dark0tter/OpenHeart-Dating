import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm text-ink placeholder:text-ink/40 focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/40",
        className,
      )}
      {...props}
    />
  );
}
