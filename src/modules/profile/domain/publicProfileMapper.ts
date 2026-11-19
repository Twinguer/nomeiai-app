import type { ProfilePrivacySettings } from '@/utils/profilePrivacySettings';
import { parseProfilePrivacySettings } from '@/utils/profilePrivacySettings';

export type PublicProfileData = {
  id: string;
  name: string;
  avatar_url: string | null;
  nickname: string | null;
  profile_text: string | null;
  is_coach: boolean;
  rankings_count: number;
  concursos_aprovados: string | null;
  concursos_participando: string | null;
  status_concurseiro: string | null;
  estado: string | null;
  formacao: string | null;
  cargo_atual: string | null;
  area_estudos: string | null;
  especialidade: string | null;
  curso_preparatorio: string | null;
  rotina_estudos: string | null;
  privacy: ProfilePrivacySettings;
};

type RpcPublicProfilePayload = {
  id: string;
  name: string;
  avatar_url?: string | null;
  nickname?: string | null;
  profile_text?: string | null;
  is_coach?: boolean;
  rankings_count?: number;
  concursos_aprovados?: string | null;
  concursos_participando?: string | null;
  status_concurseiro?: string | null;
  estado?: string | null;
  formacao?: string | null;
  cargo_atual?: string | null;
  area_estudos?: string | null;
  especialidade?: string | null;
  curso_preparatorio?: string | null;
  rotina_estudos?: string | null;
  privacy?: unknown;
};

export function mapPublicProfileRpcResponse(data: RpcPublicProfilePayload): PublicProfileData {
  const privacy = parseProfilePrivacySettings(data.privacy);

  return {
    id: data.id,
    name: data.name,
    avatar_url: data.avatar_url ?? null,
    nickname: data.nickname ?? null,
    profile_text: data.profile_text ?? null,
    is_coach: data.is_coach ?? false,
    rankings_count: data.rankings_count ?? 0,
    concursos_aprovados: privacy.showPublicAboutInfo ? (data.concursos_aprovados ?? null) : null,
    concursos_participando: privacy.showPublicAboutInfo ? (data.concursos_participando ?? null) : null,
    status_concurseiro: privacy.showPublicAboutInfo ? (data.status_concurseiro ?? null) : null,
    estado: privacy.showPublicAboutInfo ? (data.estado ?? null) : null,
    formacao: privacy.showPublicAboutInfo ? (data.formacao ?? null) : null,
    cargo_atual: privacy.showPublicAboutInfo ? (data.cargo_atual ?? null) : null,
    area_estudos: privacy.showPublicAboutInfo ? (data.area_estudos ?? null) : null,
    especialidade: privacy.showPublicAboutInfo ? (data.especialidade ?? null) : null,
    curso_preparatorio: privacy.showPublicAboutInfo ? (data.curso_preparatorio ?? null) : null,
    rotina_estudos: privacy.showPublicAboutInfo ? (data.rotina_estudos ?? null) : null,
    privacy,
  };
}
