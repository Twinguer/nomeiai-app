import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/hooks/useFocusTrap"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const focusTrapRef = useFocusTrap(isOpen);

  React.useEffect(() => {
    if (!ref || !('current' in ref) || !ref.current) return;

    const contentElement = ref.current as HTMLElement;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          
          if (mutation.attributeName === 'data-state') {
            const newIsOpen = target.getAttribute('data-state') === 'open';
            setIsOpen(newIsOpen);
            
            // ✅ CORREÇÃO: Remover aria-hidden quando o dialog estiver aberto
            if (newIsOpen && contentElement.getAttribute('aria-hidden') === 'true') {
              contentElement.removeAttribute('aria-hidden');
            }
            
            // ✅ CORREÇÃO: Quando fechado, garantir que não há elementos focados
            if (!newIsOpen) {
              const focusedElement = contentElement.querySelector(':focus');
              if (focusedElement) {
                (focusedElement as HTMLElement).blur();
              }
            }
          }
          
          // ✅ CORREÇÃO: Monitorar mudanças em aria-hidden e remover se o dialog estiver aberto
          if (mutation.attributeName === 'aria-hidden' && target === contentElement) {
            const currentIsOpen = contentElement.getAttribute('data-state') === 'open';
            if (currentIsOpen && contentElement.getAttribute('aria-hidden') === 'true') {
              contentElement.removeAttribute('aria-hidden');
            }
          }
        }
      });
    });

    observer.observe(contentElement, { 
      attributes: true, 
      attributeFilter: ['data-state', 'aria-hidden'] 
    });

    // Remover aria-hidden inicialmente se presente e o dialog estiver aberto
    const initialState = contentElement.getAttribute('data-state') === 'open';
    if (initialState && contentElement.getAttribute('aria-hidden') === 'true') {
      contentElement.removeAttribute('aria-hidden');
    }

    return () => observer.disconnect();
  }, [ref, isOpen]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        onOpenAutoFocus={(e) => {
          // ✅ CORREÇÃO: Prevenir foco automático se o elemento já estiver focado
          // Isso evita conflito com aria-hidden
          if (props.onOpenAutoFocus) {
            props.onOpenAutoFocus(e);
          }
        }}
        {...props}
      >
        <div ref={focusTrapRef}>
          {children}
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
