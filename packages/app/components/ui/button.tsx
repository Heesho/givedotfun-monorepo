import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border-0 font-display text-xs font-semibold uppercase tracking-[0.16em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-slab hover:-translate-x-px hover:-translate-y-px hover:bg-primary/95 hover:shadow-[6px_6px_0_hsl(var(--primary-container))]",
        destructive:
          "bg-loss text-loss-foreground shadow-slab-loss hover:-translate-x-px hover:-translate-y-px hover:bg-loss/90 hover:shadow-[6px_6px_0_hsl(var(--surface-container-high))]",
        outline:
          "bg-muted text-foreground shadow-none ghost-border hover:bg-surface-high hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground ghost-border hover:bg-surface-high",
        ghost: "bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-[11px]",
        lg: "h-12 px-8 text-[12px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
