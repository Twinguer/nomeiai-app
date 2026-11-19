import React, { useRef } from 'react';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TurnstileCaptchaProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  siteKey: string;
  className?: string;
}

export const TurnstileCaptcha: React.FC<TurnstileCaptchaProps> = ({
  onSuccess,
  onError,
  siteKey,
  className = '',
}) => {
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleSuccess = (token: string) => {
    onSuccess(token);
  };

  const handleError = () => {
    if (onError) {
      onError();
    }
  };

  const handleExpire = () => {
    // Token expirou, resetar
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  if (!siteKey) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Chave do Turnstile não configurada. Entre em contato com o suporte.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
        options={{
          theme: 'light',
          size: 'normal',
        }}
      />
    </div>
  );
};

