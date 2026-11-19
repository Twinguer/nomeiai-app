import React from 'react';
export interface CommunitySectionHeaderProps {
  title?: string;
  description?: string;
  showDemoUsers?: boolean;
  icon?: React.ReactNode;
}
export const CommunitySectionHeader: React.FC<CommunitySectionHeaderProps> = ({
  title = "Comunidade",
  description = "Conecte-se com outros concurseiros e acompanhe seus progressos",
  showDemoUsers = false,
  icon
}) => {
  return <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        
      </div>
      {description}
    </div>;
};