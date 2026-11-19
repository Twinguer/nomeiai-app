
import React from 'react';
import { Label } from '@/components/ui/label';

interface StatusSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="status-concurseiro">Status de concurseiro</Label>
      <select
        id="status-concurseiro"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
      >
        <option value="Na Ativa">Na Ativa</option>
        <option value="Aposentado">Aposentado</option>
        <option value="Estudando">Estudando</option>
        <option value="Esperando Nomeação">Esperando Nomeação</option>
        <option value="Aprovado">Aprovado</option>
      </select>
    </div>
  );
};

export default StatusSelect;
