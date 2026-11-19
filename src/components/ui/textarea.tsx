
import * as React from "react"
import DOMPurify from "dompurify"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  sanitize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, sanitize = true, ...props }, ref) => {
    // Handle sanitized input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (sanitize && onChange) {
        // Create a new synthetic event with sanitized value
        const sanitizedEvent = {
          ...e,
          target: {
            ...e.target,
            value: DOMPurify.sanitize(e.target.value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
          }
        } as React.ChangeEvent<HTMLTextAreaElement>;
        
        onChange(sanitizedEvent);
      } else if (onChange) {
        onChange(e);
      }
    };
    
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        value={value}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
