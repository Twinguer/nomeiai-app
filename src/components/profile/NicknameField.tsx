import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NicknameFieldProps {
  nickname: string;
  setNickname: (value: string) => void;
}

export const NicknameField: React.FC<NicknameFieldProps> = ({
  nickname,
  setNickname
}) => {
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Converter para minúsculas
    value = value.toLowerCase();
    
    // Remover caracteres inválidos (apenas a-z, 0-9, underscore, ponto)
    value = value.replace(/[^a-z0-9_.]/g, '');
    
    // Limitar a 20 caracteres
    if (value.length <= 20) {
      setNickname(value);
    }
  };

  const isValid = nickname.length >= 3 && nickname.length <= 20 && /^[a-z0-9_.]+$/.test(nickname);
  const isEmpty = nickname.length === 0;

  return (
    <div>
      <Label htmlFor="nickname">Nickname (3-20 caracteres)</Label>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">@</span>
        <Input
          id="nickname"
          type="text"
          value={nickname}
          onChange={handleNicknameChange}
          placeholder="meunickname"
          maxLength={20}
          className={`pl-8 ${!isEmpty && !isValid ? 'border-red-500' : ''}`}
        />
      </div>
      <div className="mt-1">
        <p className={`text-xs ${isEmpty ? 'text-muted-foreground' : isValid ? 'text-green-600' : 'text-red-600'}`}>
          {isEmpty
            ? `${nickname.length}/20 caracteres - Letras minúsculas, números, underscore ou ponto`
            : isValid
              ? `✓ ${nickname.length}/20 caracteres - Válido`
              : `⚠ ${nickname.length}/20 caracteres - Mínimo 3 caracteres`}
        </p>
      </div>
    </div>
  );
};