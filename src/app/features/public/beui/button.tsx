// Adapted from beUI components/motion/button/base.tsx. See LICENSE and NOTICE.md.
import { forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
export const Button = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button"> & { variant?: "primary" | "outline" | "ghost" }
>(function Button(
  { variant = "primary", className = "", children, ...props },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${variant === "primary" ? "bg-primary text-primary-foreground" : variant === "outline" ? "border border-border bg-card text-foreground" : "text-foreground hover:bg-muted"} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
});
