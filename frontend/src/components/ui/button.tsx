import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Sci-Fi themed variants
        scifi:
          "bg-gradient-to-br from-cyan-400 to-blue-600 text-black border-2 border-cyan-400 font-bold uppercase tracking-wider hover:from-cyan-300 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-400/50 hover:border-cyan-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300",
        scifiGhost:
          "bg-transparent text-cyan-400 border-2 border-cyan-400/50 font-bold uppercase tracking-wider hover:bg-cyan-400/10 hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-400/30 backdrop-blur-sm transition-all duration-300",
        scifiDanger:
          "bg-gradient-to-br from-red-500 to-red-700 text-white border-2 border-red-400 font-bold uppercase tracking-wider hover:from-red-400 hover:to-red-600 hover:shadow-lg hover:shadow-red-400/50 hover:border-red-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300",
        scifiNeon:
          "bg-black text-cyan-400 border-2 border-cyan-400 font-bold uppercase tracking-wider shadow-md shadow-cyan-400/50 animate-pulse hover:shadow-lg hover:shadow-cyan-400/70 hover:text-white hover:bg-cyan-400/10 transition-all duration-300",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-lg px-8 text-base has-[>svg]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
