import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className
}) => {
  const calculateStrength = (pwd: string): number => {
    let strength = 0;
    
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 10;
    
    if (/[a-z]/.test(pwd)) strength += 15;
    if (/[A-Z]/.test(pwd)) strength += 15;
    if (/\d/.test(pwd)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 20;
    
    return Math.min(strength, 100);
  };

  const getStrengthInfo = (strength: number) => {
    if (strength < 30) return { label: 'Fraca', color: 'bg-destructive' };
    if (strength < 60) return { label: 'Média', color: 'bg-orange-500' };
    if (strength < 80) return { label: 'Boa', color: 'bg-yellow-500' };
    return { label: 'Forte', color: 'bg-green-500' };
  };

  const strength = calculateStrength(password);
  const strengthInfo = getStrengthInfo(strength);

  if (!password) return null;

  return (
    <div className={cn("space-y-2 animate-in fade-in duration-300", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Força da senha:</span>
        <span className={cn(
          "font-medium",
          strength < 30 && "text-destructive",
          strength >= 30 && strength < 60 && "text-orange-500",
          strength >= 60 && strength < 80 && "text-yellow-600",
          strength >= 80 && "text-green-600"
        )}>
          {strengthInfo.label}
        </span>
      </div>
      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            strengthInfo.color,
            "animate-in slide-in-from-left"
          )}
          style={{ width: `${strength}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="grid grid-cols-2 gap-2">
          <div className={cn("flex items-center gap-1", password.length >= 8 ? "text-green-600" : "text-muted-foreground")}>
            <span className={cn("w-1 h-1 rounded-full", password.length >= 8 ? "bg-green-600" : "bg-muted-foreground")} />
            8+ caracteres
          </div>
          <div className={cn("flex items-center gap-1", /[A-Z]/.test(password) ? "text-green-600" : "text-muted-foreground")}>
            <span className={cn("w-1 h-1 rounded-full", /[A-Z]/.test(password) ? "bg-green-600" : "bg-muted-foreground")} />
            Maiúscula
          </div>
          <div className={cn("flex items-center gap-1", /[a-z]/.test(password) ? "text-green-600" : "text-muted-foreground")}>
            <span className={cn("w-1 h-1 rounded-full", /[a-z]/.test(password) ? "bg-green-600" : "bg-muted-foreground")} />
            Minúscula
          </div>
          <div className={cn("flex items-center gap-1", /\d/.test(password) ? "text-green-600" : "text-muted-foreground")}>
            <span className={cn("w-1 h-1 rounded-full", /\d/.test(password) ? "bg-green-600" : "bg-muted-foreground")} />
            Número
          </div>
        </div>
      </div>
    </div>
  );
};