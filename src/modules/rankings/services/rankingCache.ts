/**
 * Cache simples para rankings
 * Sistema leve e funcional
 */

// ✅ CONSOLIDADO: Usar interface única do rankingService
import type { Ranking } from '@/modules/rankings/services/rankingService';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class RankingCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // TTL simples: 5 minutos para todos os dados
  private readonly TTL = 5 * 60 * 1000;
  
  // ✅ Versão do cache - incrementar quando a lógica de ordenação mudar
  // Isso força invalidação de todos os caches antigos
  private readonly CACHE_VERSION = 'v2-tiebreaker-by-date';

  /**
   * Armazena dados no cache
   */
  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Recupera dados do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar se expirou
    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Remove entrada específica do cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Verifica se uma chave existe no cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Verificar se expirou
    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Métodos específicos para rankings
   * ✅ FASE 3: Adicionado suporte a reservationType
   * ✅ Versão de cache para forçar invalidação quando a lógica mudar
   */
  setRankings(concursoId: string, rankings: Ranking[], page: number, limit: number, reservationType?: string): void {
    const key = `rankings:${this.CACHE_VERSION}:${concursoId}:${page}:${limit}:${reservationType || 'all'}`;
    this.set(key, rankings);
  }

  getRankings(concursoId: string, page: number, limit: number, reservationType?: string): Ranking[] | null {
    const key = `rankings:${this.CACHE_VERSION}:${concursoId}:${page}:${limit}:${reservationType || 'all'}`;
    return this.get<Ranking[]>(key);
  }

  setConcurso(concursoId: string, concurso: any): void {
    const key = `concurso:${concursoId}`;
    this.set(key, concurso);
  }

  getConcurso(concursoId: string): any | null {
    const key = `concurso:${concursoId}`;
    return this.get(key);
  }

  /**
   * Limpeza automática de entradas expiradas
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtém estatísticas básicas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * ✅ FASE 3: Invalidar cache de um ranking específico
   * Incorporado do V2
   * ✅ Atualizado para considerar versão do cache
   */
  invalidateRanking(concursoId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      // Invalidar tanto chaves com versão quanto sem versão (para compatibilidade)
      if (
        key.startsWith(`rankings:${this.CACHE_VERSION}:${concursoId}:`) ||
        key.startsWith(`rankings:${concursoId}:`) ||
        key.startsWith(`concurso:${concursoId}`)
      ) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * ✅ FASE 3: Cache de dados de ranking (incorporado do V2)
   */
  setRankingData(concursoId: string, data: any): void {
    const key = `ranking-data:${concursoId}`;
    this.set(key, data);
  }

  getRankingData(concursoId: string): any | null {
    const key = `ranking-data:${concursoId}`;
    return this.get(key);
  }
}

// Instância singleton do cache
export const rankingCache = new RankingCache();

// Limpeza automática removida - será feita sob demanda