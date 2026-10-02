// Adapted from beUI components/motion/tabs.tsx. See LICENSE and NOTICE.md.
import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
export function Tabs({
  value,
  onValueChange,
  items,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex gap-1 rounded-xl bg-muted p-1"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const current = items.findIndex((item) => item.value === value);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (current +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  items.length) %
                items.length;
        onValueChange(items[next].value);
        event.currentTarget
          .querySelectorAll<HTMLButtonElement>("[role=tab]")
          [next].focus();
      }}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onValueChange(item.value)}
          className="relative min-h-11 rounded-lg px-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {value === item.value && (
            <motion.span
              layoutId={id}
              className="absolute inset-0 rounded-lg bg-primary"
              transition={{ duration: reduce ? 0 : 0.18 }}
            />
          )}
          <span
            className={`relative ${value === item.value ? "text-primary-foreground" : "text-foreground"}`}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
