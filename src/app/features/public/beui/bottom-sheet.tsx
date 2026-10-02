// Adapted from beUI components/motion/bottom-sheet.tsx. See LICENSE and NOTICE.md.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { siteConfig } from "../../../site";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
          ) ?? [],
        );
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open, onOpenChange]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-2xl flex-col rounded-t-2xl border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600)
                onOpenChange(false);
            }}
            initial={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
            transition={{ duration: reduce ? 0.12 : 0.22 }}
          >
            <div
              className="mx-auto flex h-8 w-20 touch-none cursor-grab items-center justify-center"
              onPointerDown={(event) => controls.start(event)}
              aria-hidden="true"
            >
              <div className="h-1 w-10 rounded-full bg-muted-foreground" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <h2 id={id} className="text-lg font-semibold">
                {title}
              </h2>
              <button
                type="button"
                className="min-h-11 px-3"
                onClick={() => onOpenChange(false)}
              >
                {siteConfig.language === "zh-CN" ? "关闭" : "Close"}
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
