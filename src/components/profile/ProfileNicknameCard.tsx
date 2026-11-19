import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { useProfileNickname } from '@/modules/profile';

type NicknameState = ReturnType<typeof useProfileNickname>;

interface ProfileNicknameCardProps {
  nickname: NicknameState;
}

export function ProfileNicknameCard({ nickname }: ProfileNicknameCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nickname público</CardTitle>
        <CardDescription>Identificador único exibido no perfil público e usado para convites.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <span className="text-muted-foreground shrink-0 select-none">@</span>
          <Input
            value={nickname.nicknameInput}
            onChange={(e) => nickname.handleNicknameInputChange(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            maxLength={20}
            disabled={nickname.nicknameStatus === 'saving'}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={nickname.verifyNicknameAvailability}
            disabled={!nickname.nicknameInput || nickname.isNicknameBusy}
          >
            {nickname.nicknameStatus === 'checking' ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>
          <Button
            size="sm"
            onClick={nickname.saveNickname}
            disabled={!nickname.nicknameDirty || nickname.nicknameStatus === 'saving'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {nickname.nicknameStatus === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar nickname'
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={nickname.resetNicknameInput}
            disabled={!nickname.nicknameDirty || nickname.nicknameStatus === 'saving'}
          >
            Desfazer
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={nickname.generateNicknameAutomatically}
          disabled={nickname.nicknameStatus === 'saving'}
        >
          {nickname.nicknameStatus === 'saving' && !nickname.nicknameDirty ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Gerando...
            </>
          ) : (
            'Gerar automaticamente'
          )}
        </Button>
        <p
          className={`text-xs ${
            nickname.nicknameStatus === 'available' || nickname.nicknameStatus === 'success'
              ? 'text-green-600'
              : nickname.nicknameStatus === 'unavailable' || nickname.nicknameStatus === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
          }`}
        >
          {nickname.nicknameMessage ||
            '3-20 caracteres (a-z, 0-9, _ ou .). Acentos viram letras simples; espaços são removidos.'}
        </p>
      </CardContent>
    </Card>
  );
}
