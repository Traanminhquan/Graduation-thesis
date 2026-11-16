import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Consistent page gutter + max width used by every section. */
export function Container({
  children,
  className,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Single-column reading width, used by result pages. */
  narrow?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", narrow ? "max-w-4xl" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
