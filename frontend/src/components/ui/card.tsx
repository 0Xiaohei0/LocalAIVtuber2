import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "flex flex-col gap-6 rounded-xl border py-6 shadow-sm transition-all",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        // Sci-Fi themed variants
        scifi: 
          "bg-gradient-to-br from-cyan-400/10 to-blue-600/5 border-cyan-400/30 text-cyan-100 backdrop-blur-md hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-400/20 hover:-translate-y-1",
        scifiGlass:
          "bg-black/20 border-cyan-400/20 text-cyan-100 backdrop-blur-lg hover:bg-black/30 hover:border-cyan-400/40 hover:shadow-md hover:shadow-cyan-400/10",
        scifiSolid:
          "bg-gradient-to-br from-slate-900 to-blue-900/50 border-cyan-400/50 text-cyan-100 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/30",
        scifiNeon:
          "bg-black/40 border-cyan-400 text-cyan-100 shadow-md shadow-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/50",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {
  animated?: boolean
}

function Card({ className, variant, animated = false, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        cardVariants({ variant }),
        animated && variant?.startsWith('scifi') && "group relative overflow-hidden hover:scale-[1.02]",
        className
      )}
      {...props}
    >
      {/* Animated border gradient effect for sci-fi variants */}
      {animated && variant?.startsWith('scifi') && (
        <>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10" />
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </>
      )}
      {props.children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}

export type { CardProps }
