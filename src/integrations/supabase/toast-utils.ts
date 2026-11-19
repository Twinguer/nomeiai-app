
import { toast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

// Sanitize input to prevent XSS attacks
const sanitize = (content: string | undefined): string | undefined => {
  if (!content) return content;
  return DOMPurify.sanitize(content);
};

// Common toast function with consistent styling, duration and sanitization
export const showSuccessToast = (title: string, description?: string) => {
  toast({
    title: sanitize(title),
    description: sanitize(description),
    duration: 1500,
  });
};

export const showErrorToast = (title: string, description?: string) => {
  toast({
    title: sanitize(title),
    description: sanitize(description),
    variant: 'destructive',
    duration: 1500,
  });
};

export const showWarningToast = (title: string, description?: string) => {
  toast({
    title: sanitize(title),
    description: sanitize(description),
    variant: 'default',
    duration: 1500,
    className: 'bg-yellow-50 border-yellow-200',
  });
};
