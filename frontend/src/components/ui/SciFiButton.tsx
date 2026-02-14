import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sciFiButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none relative overflow-hidden uppercase tracking-wider",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-br from-cyan-400 to-blue-600 text-black border-2 border-cyan-400 hover:from-cyan-300 hover:to-blue-500 hover:shadow-cyan-400/50 hover:shadow-lg hover:border-cyan-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner active:shadow-cyan-400/30",
        secondary:
          "bg-gradient-to-br from-blue-600 to-blue-900 text-white border-2 border-blue-400 hover:from-blue-500 hover:to-blue-800 hover:shadow-blue-400/50 hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 active:translate-y-0",
        danger:
          "bg-gradient-to-br from-red-500 to-red-700 text-white border-2 border-red-400 hover:from-red-400 hover:to-red-600 hover:shadow-red-400/50 hover:shadow-lg hover:border-red-300 hover:-translate-y-0.5 active:translate-y-0",
        ghost:
          "bg-transparent text-cyan-400 border-2 border-cyan-400/50 hover:bg-cyan-400/10 hover:border-cyan-400 hover:shadow-cyan-400/30 hover:shadow-md backdrop-blur-sm",
        outline:
          "bg-black/20 text-cyan-400 border-2 border-cyan-400/70 hover:bg-cyan-400/10 hover:border-cyan-400 hover:shadow-cyan-400/30 hover:shadow-md backdrop-blur-sm",
        neon:
          "bg-black text-cyan-400 border-2 border-cyan-400 shadow-cyan-400/50 shadow-md animate-pulse hover:shadow-cyan-400/70 hover:shadow-lg hover:text-white hover:bg-cyan-400/10",
        scifiGhost:
          "bg-transparent text-cyan-400 border-2 border-cyan-400/50 hover:bg-cyan-400/10 hover:border-cyan-400 hover:shadow-cyan-400/30 hover:shadow-md backdrop-blur-sm",
      },
      size: {
        default: "h-10 px-6 py-2 text-sm",
        sm: "h-8 rounded-md gap-1.5 px-4 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "size-10",
      },
      glow: {
        none: "",
        subtle: "shadow-sm",
        medium: "shadow-md shadow-cyan-400/30",
        strong: "shadow-lg shadow-cyan-400/50",
        intense: "shadow-xl shadow-cyan-400/70",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      glow: "medium",
    },
  }
)

interface SciFiButtonProps 
  extends React.ComponentProps<"button">,
    VariantProps<typeof sciFiButtonVariants> {
  asChild?: boolean
  pulse?: boolean
  neonBorder?: boolean
}

const SciFiButton = React.forwardRef<HTMLButtonElement, SciFiButtonProps>(
  ({ className, variant, size, glow, asChild = false, pulse = false, neonBorder = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const buttonClasses = cn(
      sciFiButtonVariants({ variant, size, glow, className }),
      pulse && "animate-pulse",
      neonBorder && "animate-[scifi-neon-border_3s_infinite]"
    )

    return (
      <Comp
        className={buttonClasses}
        ref={ref}
        {...props}
      >
        {/* Shimmer effect overlay */}
        <span className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </Comp>
    )
  }
)

SciFiButton.displayName = "SciFiButton"

// Enhanced variant for critical actions
const SciFiCriticalButton = React.forwardRef<HTMLButtonElement, SciFiButtonProps>(
  ({ className, children, ...props }, ref) => (
    <SciFiButton
      ref={ref}
      variant="primary"
      size="lg"
      glow="intense"
      pulse
      className={cn("font-extrabold text-base tracking-widest", className)}
      {...props}
    >
      <span className="mr-2">⚡</span>
      {children}
      <span className="ml-2">⚡</span>
    </SciFiButton>
  )
)

SciFiCriticalButton.displayName = "SciFiCriticalButton"

// Neon glowing variant
const SciFiNeonButton = React.forwardRef<HTMLButtonElement, SciFiButtonProps>(
  ({ className, children, ...props }, ref) => (
    <SciFiButton
      ref={ref}
      variant="neon"
      neonBorder
      glow="strong"
      className={cn("font-mono", className)}
      {...props}
    >
      {children}
    </SciFiButton>
  )
)

SciFiNeonButton.displayName = "SciFiNeonButton"

export { SciFiButton, SciFiCriticalButton, SciFiNeonButton, sciFiButtonVariants }
export type { SciFiButtonProps }