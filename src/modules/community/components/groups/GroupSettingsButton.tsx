import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { GroupSettingsModal } from './GroupSettingsModal';
import type { StudyGroup } from '../../domain/types';

interface GroupSettingsButtonProps {
  group: StudyGroup;
  onGroupUpdated?: () => void;
}

export const GroupSettingsButton: React.FC<GroupSettingsButtonProps> = ({ group, onGroupUpdated }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <Settings className="h-4 w-4 mr-2" />
        Configurações
      </Button>
      <GroupSettingsModal
        open={isOpen}
        onOpenChange={setIsOpen}
        group={group}
        onGroupUpdated={onGroupUpdated}
      />
    </>
  );
};

