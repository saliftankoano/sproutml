import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-bg shadow-[0_2px_8px_rgba(34,197,94,0.3)] hover:bg-accent/90 hover:shadow-[0_4px_12px_rgba(34,197,94,0.4)] hover:scale-[1.02]",
        destructive:
          "bg-destructive text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)] hover:bg-destructive/90 hover:scale-[1.02]",
        outline:
          "border border-border bg-surface/50 text-text shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:bg-surface hover:scale-[1.02]",
        secondary:
          "bg-secondary text-text shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:bg-secondary/80 hover:scale-[1.02]",
        ghost:
          "hover:bg-surface/50 text-text",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-lg gap-1.5 px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "size-10",
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
