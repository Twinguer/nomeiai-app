import React, { useEffect } from 'react';
import { useStudyProAccess } from '@/modules/study';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showProRequiredToast } from '@/utils/planRestrictions';

interface ProFeatureGuardProps {
  children?: React.ReactNode;
  featureName: string;
}

export const ProFeatureGuard = ({ 
  children, 
  featureName
}: ProFeatureGuardProps) => {
  const { canAccessStudyPro, isLoading } = useStudyProAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !canAccessStudyPro) {
      showProRequiredToast(navigate, featureName);
    }
  }, [canAccessStudyPro, isLoading, navigate, featureName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessStudyPro) {
    // Retornar null pois o toast já redireciona
    return null;
  }

  return <>{children}</>;
};

