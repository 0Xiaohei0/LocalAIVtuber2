import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sciFiCardVariants = cva(
  "rounded-xl border backdrop-blur-md transition-all relative overflow-hidden group",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-cyan-400/10 to-blue-600/5 border-cyan-400/30 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-400/20 hover:-translate-y-1",
        glass:
          "bg-black/20 border-cyan-400/20 backdrop-blur-lg hover:bg-black/30 hover:border-cyan-400/40 hover:shadow-md hover:shadow-cyan-400/10",
        solid:
          "bg-gradient-to-br from-slate-900 to-blue-900/50 border-cyan-400/50 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/30",
        neon:
          "bg-black/40 border-cyan-400 shadow-md shadow-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/50",
        danger:
          "bg-gradient-to-br from-red-900/20 to-red-600/10 border-red-400/30 hover:border-red-400/60 hover:shadow-lg hover:shadow-red-400/20",
        success:
          "bg-gradient-to-br from-green-900/20 to-green-600/10 border-green-400/30 hover:border-green-400/60 hover:shadow-lg hover:shadow-green-400/20",
        scifiGlass:
          "bg-black/20 border-cyan-400/20 backdrop-blur-lg hover:bg-black/30 hover:border-cyan-400/40 hover:shadow-md hover:shadow-cyan-400/10",
        scifiSolid:
          "bg-gradient-to-br from-slate-900 to-blue-900/50 border-cyan-400/50 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/30",
        scifiNeon:
          "bg-black/40 border-cyan-400 shadow-md shadow-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/50",
      },
      size: {
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
      glow: {
        none: "",
        subtle: "shadow-sm",
        medium: "shadow-md shadow-cyan-400/20",
        strong: "shadow-lg shadow-cyan-400/40",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: "medium",
    },
  }
)

interface SciFiCardProps 
  extends React.ComponentProps<"div">,
    VariantProps<typeof sciFiCardVariants> {
  animated?: boolean
  neonBorder?: boolean
}

const SciFiCard = React.forwardRef<HTMLDivElement, SciFiCardProps>(
  ({ className, variant, size, glow, animated = false, neonBorder = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          sciFiCardVariants({ variant, size, glow }),
          animated && "hover:scale-[1.02] transition-transform duration-300",
          neonBorder && "animate-[scifi-neon-border_4s_infinite]",
          className
        )}
        {...props}
      >
        {/* Animated border gradient effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10" />
        
        {/* Shimmer effect */}
        {animated && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        )}
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)

SciFiCard.displayName = "SciFiCard"

// Header component for sci-fi cards
const SciFiCardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between pb-4 mb-4 border-b border-cyan-400/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

SciFiCardHeader.displayName = "SciFiCardHeader"

// Title component with glow effect
const SciFiCardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<"h3">>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-bold text-cyan-400 tracking-wide uppercase",
        "text-shadow-sm text-shadow-cyan-400/50",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
)

SciFiCardTitle.displayName = "SciFiCardTitle"

// Description component
const SciFiCardDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-sm text-cyan-300/80 leading-relaxed",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
)

SciFiCardDescription.displayName = "SciFiCardDescription"

// Content wrapper
const SciFiCardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("space-y-4", className)}
      {...props}
    >
      {children}
    </div>
  )
)

SciFiCardContent.displayName = "SciFiCardContent"

// Footer with actions
const SciFiCardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-3 pt-4 mt-4 border-t border-cyan-400/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

SciFiCardFooter.displayName = "SciFiCardFooter"

// Status indicator component
interface SciFiCardStatusProps extends React.ComponentProps<"div"> {
  status: "online" | "offline" | "warning" | "error" | "processing"
}

const SciFiCardStatus = React.forwardRef<HTMLDivElement, SciFiCardStatusProps>(
  ({ className, status, children, ...props }, ref) => {
    const statusColors = {
      online: "bg-green-400 shadow-green-400/50",
      offline: "bg-gray-400 shadow-gray-400/50", 
      warning: "bg-yellow-400 shadow-yellow-400/50",
      error: "bg-red-400 shadow-red-400/50",
      processing: "bg-cyan-400 shadow-cyan-400/50 animate-pulse"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 text-xs font-mono uppercase tracking-wider",
          className
        )}
        {...props}
      >
        <div 
          className={cn(
            "w-2 h-2 rounded-full shadow-md",
            statusColors[status]
          )} 
        />
        <span className="text-cyan-300">
          {children || status}
        </span>
      </div>
    )
  }
)

SciFiCardStatus.displayName = "SciFiCardStatus"

export {
  SciFiCard,
  SciFiCardHeader,
  SciFiCardTitle,
  SciFiCardDescription,
  SciFiCardContent,
  SciFiCardFooter,
  SciFiCardStatus,
  sciFiCardVariants
}

export type { SciFiCardProps }