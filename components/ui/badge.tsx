import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent/10 text-accent hover:bg-accent/20 border-accent/20",
        secondary:
          "border-transparent bg-surface text-foreground hover:bg-surface/80",
        destructive:
          "border-transparent bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20",
        outline: "text-foreground border-border/40",
        blue: "border-transparent bg-blue-accent/10 text-blue-accent hover:bg-blue-accent/20 border-blue-accent/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
