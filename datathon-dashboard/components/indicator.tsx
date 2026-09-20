import { cn } from "@/lib/utils"

interface IndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Determines if the indicator should have a pulsing animation. Defaults to true. */
  pulse?: boolean;
}

// Just changed the name here to StatusIndicator
export function StatusIndicator({ className, pulse = true, ...props }: IndicatorProps) {
  return (
    <span className={cn("relative flex h-3 w-3", className)} {...props}>
      {pulse && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      )}
      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
    </span>
  )
}