import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm transition-all duration-150 active:scale-[0.98]",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm transition-all duration-150 active:scale-[0.98]",
    outline: "border border-border bg-background text-foreground hover:bg-muted transition-colors duration-150",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-150",
    ghost: "text-foreground hover:bg-muted/60 transition-colors duration-150",
    link: "text-primary underline-offset-4 hover:underline transition-colors duration-150",
  }
  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-6",
    icon: "h-9 w-9",
  }
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
