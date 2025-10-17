"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

function Progress({ className, value = 0, max = 100, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface border border-border",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-gradient-to-r from-accent to-blue-accent transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export { Progress }
