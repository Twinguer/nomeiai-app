import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import StatusSelect from './StatusSelect';

interface ProfileInfoTabProps {
  name: string;
  setName: (name: string) => void;
  email: string;
  statusConcurseiro: string;
  setStatusConcurseiro: (status: string) => void;
  profileText: string;
  setProfileText: (text: string) => void;
  concursosAprovados: string;
  setConcursosAprovados: (value: string) => void;
  concursosParticipando: string;
  setConcursosParticipando: (value: string) => void;
  estado: string;
  setEstado: (value: string) => void;
  formacao: string;
  setFormacao: (value: string) => void;
  cargoAtual: string;
  setCargoAtual: (value: string) => void;
  areaEstudos: string;
  setAreaEstudos: (value: string) => void;
  especialidade: string;
  setEspecialidade: (value: string) => void;
  cursoPreparatorio: string;
  setCursoPreparatorio: (value: string) => void;
  rotinaEstudos: string;
  setRotinaEstudos: (value: string) => void;
}

function useLineListEditor(value: string, onChange: (value: string) => void) {
  const [draft, setDraft] = useState('');
  const items = value ? value.split('\n').filter(Boolean) : [];

  const addItem = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()].join('\n'));
    setDraft('');
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index).join('\n'));
  };

  return { draft, setDraft, items, addItem, removeItem };
}

const ProfileInfoTab: React.FC<ProfileInfoTabProps> = ({
  name,
  setName,
  email,
  statusConcurseiro,
  setStatusConcurseiro,
  profileText,
  setProfileText,
  concursosAprovados,
  setConcursosAprovados,
  concursosParticipando,
  setConcursosParticipando,
  estado,
  setEstado,
  formacao,
  setFormacao,
  cargoAtual,
  setCargoAtual,
  areaEstudos,
  setAreaEstudos,
  especialidade,
  setEspecialidade,
  cursoPreparatorio,
  setCursoPreparatorio,
  rotinaEstudos,
  setRotinaEstudos,
}) => {
  const aprovacoes = useLineListEditor(concursosAprovados, setConcursosAprovados);
  const participando = useLineListEditor(concursosParticipando, setConcursosParticipando);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome de usuário</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 15) setName(value);
            }}
            placeholder="Seu nome completo"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground">{name.length}/15 caracteres</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="bg-muted" />
        </div>

        <StatusSelect value={statusConcurseiro} onChange={setStatusConcurseiro} />

        <div className="space-y-2">
          <Label htmlFor="profileText">Frase do perfil</Label>
          <Textarea
            id="profileText"
            value={profileText}
            onChange={(e) => {
              if (e.target.value.length <= 100) setProfileText(e.target.value);
            }}
            placeholder="Uma frase curta que aparece no topo do seu perfil"
            rows={2}
            maxLength={100}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{profileText.length}/100 caracteres</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rotinaEstudos">Rotina de estudos</Label>
          <Textarea
            id="rotinaEstudos"
            value={rotinaEstudos}
            onChange={(e) => {
              if (e.target.value.length <= 1500) setRotinaEstudos(e.target.value);
            }}
            placeholder="Rotina de estudos, próximos concursos, dicas..."
            className="min-h-[150px] break-words whitespace-pre-wrap"
          />
          <p className="text-xs text-muted-foreground text-right">{rotinaEstudos.length}/1500 caracteres</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">Sobre mim</h3>
          <div className="space-y-2 border p-4 rounded-md bg-secondary">
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formacao">Formação</Label>
              <Input id="formacao" value={formacao} onChange={(e) => setFormacao(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargoAtual">Cargo atual</Label>
              <Input id="cargoAtual" value={cargoAtual} onChange={(e) => setCargoAtual(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaEstudos">Área de Estudos</Label>
              <Input id="areaEstudos" value={areaEstudos} onChange={(e) => setAreaEstudos(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="especialidade">Especialidade</Label>
              <Input id="especialidade" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cursoPreparatorio">Curso Preparatório</Label>
              <Input
                id="cursoPreparatorio"
                value={cursoPreparatorio}
                onChange={(e) => setCursoPreparatorio(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border p-4 rounded-md bg-secondary">
          <Label className="text-lg font-medium">Concursos em que foi aprovado</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Analista Administrativo - TCU"
              value={aprovacoes.draft}
              onChange={(e) => aprovacoes.setDraft(e.target.value)}
              maxLength={50}
              className="flex-grow"
            />
            <Button onClick={aprovacoes.addItem} type="button" className="flex items-center">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2 mt-3">
            {aprovacoes.items.length > 0 ? (
              aprovacoes.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-background p-2 rounded border">
                  <span className="text-sm break-words flex-grow">{item}</span>
                  <Button variant="ghost" size="sm" onClick={() => aprovacoes.removeItem(index)} className="h-8 w-8 p-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhuma aprovação adicionada ainda</p>
            )}
          </div>
        </div>

        <div className="space-y-3 border p-4 rounded-md bg-secondary">
          <Label className="text-lg font-medium">Concursos em que está participando</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Auditor Fiscal - SEFAZ SP"
              value={participando.draft}
              onChange={(e) => participando.setDraft(e.target.value)}
              maxLength={50}
              className="flex-grow"
            />
            <Button onClick={participando.addItem} type="button" className="flex items-center">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2 mt-3">
            {participando.items.length > 0 ? (
              participando.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between bg-background p-2 rounded border">
                  <span className="text-sm break-words flex-grow">{item}</span>
                  <Button variant="ghost" size="sm" onClick={() => participando.removeItem(index)} className="h-8 w-8 p-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhum concurso em andamento listado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileInfoTab;
