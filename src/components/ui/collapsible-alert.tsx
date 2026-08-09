import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "amber";

const variantStyles: Record<
  AlertVariant,
  { border: string; bg: string; iconColor: string; titleColor: string; pillBg: string }
> = {
  info: {
    border: "border-teal-500/40",
    bg: "bg-teal-500/5",
    iconColor: "text-teal-500",
    titleColor: "text-teal-600 dark:text-teal-400",
    pillBg: "bg-teal-500/10 hover:bg-teal-500/20",
  },
  success: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-600 dark:text-emerald-400",
    pillBg: "bg-emerald-500/10 hover:bg-emerald-500/20",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    iconColor: "text-amber-500",
    titleColor: "text-amber-600 dark:text-amber-400",
    pillBg: "bg-amber-500/10 hover:bg-amber-500/20",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    iconColor: "text-amber-500",
    titleColor: "text-amber-600 dark:text-amber-400",
    pillBg: "bg-amber-500/10 hover:bg-amber-500/20",
  },
};

interface CollapsibleAlertProps {
  variant?: AlertVariant;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleAlert({
  variant = "info",
  icon,
  title,
  children,
  defaultOpen = false,
  className,
}: CollapsibleAlertProps) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-all duration-200",
        styles.border,
        open ? styles.bg : "bg-transparent",
        className
      )}
    >
      {/* Header / pill row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
          !open && styles.pillBg
        )}
      >
        <span className={cn("h-3.5 w-3.5 shrink-0 flex items-center", styles.iconColor)}>
          {icon}
        </span>
        <span className={cn("flex-1 text-xs font-medium", styles.titleColor)}>
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            styles.iconColor,
            open && "rotate-180"
          )}
        />
      </button>

      {/* Expandable body */}
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground border-t border-inherit">
          {children}
        </div>
      )}
    </div>
  );
}
