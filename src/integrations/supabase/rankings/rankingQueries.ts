
import { supabase } from '../client';
import { Concurso } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Função para buscar um ranking específico por ID
export const fetchRankingById = async (rankingId: string): Promise<Concurso | null> => {
  try {
    const { data, error } = await supabase
      .from('concursos')
      .select('*')
      .eq('id', rankingId)
      .single();
      
    if (error) {
      devLog.error('Erro ao buscar ranking por ID:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    devLog.error('Erro na função fetchRankingById:', error);
    return null;
  }
};

// Função para buscar todos os rankings com opções de filtragem
export const fetchAllRankings = async (filters?: { 
  status?: string; 
  orgao?: string; 
  banca?: string;
}): Promise<Concurso[]> => {
  try {
    let query = supabase
      .from('concursos')
      .select('*');
    
    // Aplicar filtros se fornecidos
    if (filters) {
      if (filters.status && filters.status !== 'Todos') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.orgao && filters.orgao !== 'Todos') {
        query = query.eq('orgao', filters.orgao);
      }
      
      if (filters.banca && filters.banca !== 'Todos') {
        query = query.eq('banca', filters.banca);
      }
    }
    
    // Ordenar por data de publicação mais recente primeiro
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    devLog.error('Erro ao buscar rankings:', error);
    return [];
  }
};

// Função para obter o gabarito oficial de um concurso
export const fetchOfficialAnswers = async (concursoId: string) => {
  try {
    const { data, error } = await supabase
      .from('concursos')
      .select('official_answers')
      .eq('id', concursoId)
      .single();
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    devLog.error('Erro ao buscar gabarito oficial:', error);
    return [];
  }
};

// Outras funções de consulta relacionadas a rankings...
