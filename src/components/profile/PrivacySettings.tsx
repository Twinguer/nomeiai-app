import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeOff } from 'lucide-react';
import type { ProfilePrivacySettings } from '@/utils/profilePrivacySettings';

interface PrivacySettingsProps {
  settings: ProfilePrivacySettings;
  onSettingChange: (key: keyof ProfilePrivacySettings, value: boolean) => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  settings,
  onSettingChange,
}) => {
  const items: {
    key: keyof ProfilePrivacySettings;
    label: string;
    description: string;
    disabled?: boolean;
  }[] = [
    {
      key: 'showPublicRankings',
      label: 'Rankings no perfil público',
      description: 'Outros usuários podem ver em quais rankings você participa.',
    },
    {
      key: 'showPublicRankingPosition',
      label: 'Colocação e pontuação',
      description: 'Exibe posição, pontos e status (classificado/eliminado) nos rankings.',
      disabled: !settings.showPublicRankings,
    },
    {
      key: 'showPublicStudyStats',
      label: 'Estatísticas de estudo',
      description: 'Horas, questões respondidas e taxa de acerto no perfil público.',
    },
    {
      key: 'showPublicAboutInfo',
      label: 'Sobre mim e rotina',
      description: 'Estado, formação, cargo, área de estudos, curso preparatório e rotina.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <EyeOff className="h-5 w-5" />
          Privacidade do perfil público
        </CardTitle>
        <CardDescription>
          Por padrão, tudo fica oculto no perfil público. As alterações são salvas automaticamente ao
          alternar cada opção.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between space-x-2 ${item.disabled ? 'opacity-50' : ''}`}
          >
            <div className="flex flex-col flex-1">
              <Label htmlFor={item.key} className="text-sm font-medium">
                {item.label}
              </Label>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              id={item.key}
              checked={settings[item.key]}
              disabled={item.disabled}
              onCheckedChange={(checked) => onSettingChange(item.key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
