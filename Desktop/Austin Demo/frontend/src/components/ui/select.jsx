import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext(undefined)

const Select = ({ children, value, onValueChange, ...props }) => {
  const [open, setOpen] = React.useState(false)
  const [selectedValue, setSelectedValue] = React.useState(value || '')
  const triggerRef = React.useRef(null)

  const handleValueChange = (newValue) => {
    setSelectedValue(newValue)
    setOpen(false)
    onValueChange?.(newValue)
  }

  React.useEffect(() => {
    setSelectedValue(value || '')
  }, [value])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event) => {
      const selectContent = document.querySelector('[data-select-content]')
      if (
        triggerRef.current && 
        !triggerRef.current.contains(event.target) &&
        (!selectContent || !selectContent.contains(event.target))
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <SelectContext.Provider value={{ open, setOpen, selectedValue, handleValueChange, triggerRef }}>
      <div className="relative" {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within Select')
  const triggerRef = React.useRef(null)
  
  React.useImperativeHandle(ref, () => triggerRef.current)

  React.useEffect(() => {
    if (triggerRef.current && context.triggerRef) {
      context.triggerRef.current = triggerRef.current
    }
  }, [context])

  return (
    <button
      ref={triggerRef}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border-2 border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-primary/50 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => context.setOpen(!context.open)}
      {...props}
    >
      {children}
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, ...props }) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  return (
    <span {...props}>
      {context.selectedValue || placeholder}
    </span>
  )
}

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0, visible: false })
  const contentRef = React.useRef(null)

  React.useLayoutEffect(() => {
    const updatePosition = () => {
      if (context.triggerRef?.current) {
        const rect = context.triggerRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        
        // Estimate dropdown height (approximately 40px per item + padding)
        const estimatedHeight = 200 // Conservative estimate
        const spaceBelow = viewportHeight - rect.bottom
        const spaceAbove = rect.top
        
        // Position above if not enough space below, but enough space above
        const positionAbove = spaceBelow < estimatedHeight && spaceAbove > estimatedHeight
        
        // Calculate horizontal position (ensure it doesn't overflow right edge)
        let left = rect.left
        const estimatedWidth = rect.width
        if (left + estimatedWidth > viewportWidth) {
          left = Math.max(0, viewportWidth - estimatedWidth)
        }
        
        setPosition({
          top: positionAbove ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
          left: left,
          width: rect.width,
          visible: true,
        })
      }
    }

    if (context.open) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updatePosition()
      })
      
      // After first render, measure actual height and adjust
      const measureAndAdjust = () => {
        if (contentRef.current && context.triggerRef?.current) {
          const contentRect = contentRef.current.getBoundingClientRect()
          const triggerRect = context.triggerRef.current.getBoundingClientRect()
          const viewportHeight = window.innerHeight
          
          const spaceBelow = viewportHeight - triggerRect.bottom
          const spaceAbove = triggerRect.top
          
          // If dropdown would overflow bottom, position above
          if (contentRect.height > spaceBelow && spaceAbove > contentRect.height) {
            setPosition(prev => ({
              ...prev,
              top: triggerRect.top - contentRect.height - 4,
            }))
          }
        }
      }
      
      // Measure after a short delay to allow content to render
      const timeoutId = setTimeout(measureAndAdjust, 0)
      
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    } else {
      setPosition(prev => ({ ...prev, visible: false }))
    }
  }, [context.open, context.triggerRef])

  if (!context.open || !position.visible) return null

  const content = (
    <div
      ref={(node) => {
        contentRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }}
      data-select-content
      className={cn(
        "fixed z-[9999] min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md max-h-[300px] overflow-y-auto",
        className
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: position.width > 0 ? `${position.width}px` : 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground",
        className
      )}
      onClick={() => context.handleValueChange(value)}
      {...props}
    >
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
