import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchPciConcursoFeed } from '@/services/pciConcursoFeedService';
import { PciConcursoCard } from '@/components/concursos/PciConcursoCard';
import {
  PCI_REGION_LABELS,
  PCI_REGION_TAB_ORDER,
  type PciConcursoFeedItem,
  type PciNivelFilter,
} from '@/types/pciConcursoFeed';
import {
  collectUfsFromItems,
  filterPciItems,
  getGridColumnCount,
  parseUfFilter,
} from '@/utils/pciConcursoFeedUtils';
import { Badge } from '@/components/ui/badge';

const ROWS_PER_PAGE = 3;

export function PciConcursosFeed() {
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState<string | null>(null);
  const [nivel, setNivel] = useState<PciNivelFilter>('');
  const [activeTab, setActiveTab] = useState<string>('NACIONAL');
  const [visibleByTab, setVisibleByTab] = useState<Record<string, number>>({});
  const [filterKey, setFilterKey] = useState('');
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(9);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pci-concurso-feed'],
    queryFn: fetchPciConcursoFeed,
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];

  const updatePageSize = useCallback(() => {
    const el = gridWrapRef.current;
    const width = el?.clientWidth ?? 1100;
    setPageSize(getGridColumnCount(width) * ROWS_PER_PAGE);
  }, []);

  useEffect(() => {
    updatePageSize();
    const ro = new ResizeObserver(() => updatePageSize());
    if (gridWrapRef.current) ro.observe(gridWrapRef.current);
    return () => ro.disconnect();
  }, [updatePageSize]);

  const availableUfs = useMemo(() => collectUfsFromItems(items), [items]);

  const activeUf = ufFilter || parseUfFilter(search);

  const filtered = useMemo(
    () => filterPciItems(items, search, nivel, ufFilter),
    [items, search, nivel, ufFilter],
  );

  const toggleUfFilter = (uf: string) => {
    const code = uf.toUpperCase();
    setUfFilter((prev) => (prev === code ? null : code));
    setSearch('');
  };

  const byRegiao = useMemo(() => {
    const map: Record<string, PciConcursoFeedItem[]> = {};
    for (const item of filtered) {
      const r = item.regiao || 'OUTROS';
      if (!map[r]) map[r] = [];
      map[r].push(item);
    }
    return map;
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of PCI_REGION_TAB_ORDER) {
      c[r] = byRegiao[r]?.length ?? 0;
    }
    return c;
  }, [byRegiao]);

  useEffect(() => {
    const key = `${search}|${nivel}|${ufFilter ?? ''}`;
    if (key !== filterKey) {
      setFilterKey(key);
      setVisibleByTab({});
    }
  }, [search, nivel, ufFilter, filterKey]);

  useEffect(() => {
    const firstWithData = PCI_REGION_TAB_ORDER.find((r) => (counts[r] ?? 0) > 0);
    if (!counts[activeTab] && firstWithData) {
      setActiveTab(firstWithData);
    }
  }, [counts, activeTab]);

  const getLimit = (regiao: string) => visibleByTab[regiao] ?? pageSize;

  const loadMore = (regiao: string) => {
    setVisibleByTab((prev) => ({
      ...prev,
      [regiao]: getLimit(regiao) + pageSize,
    }));
  };

  const lastScrapedLabel = data?.lastScrapedAt
    ? new Date(data.lastScrapedAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  if (isLoading) {
    return (
      <>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Concursos abertos</h1>
        </header>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (isError) {
    const detail =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : error instanceof Error
          ? error.message
          : '';
    return (
      <p className="text-center text-muted-foreground py-12">
        Não foi possível carregar os concursos.
        {detail ? <span className="block text-sm mt-2 opacity-80">{detail}</span> : null}
      </p>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 space-y-2 text-muted-foreground">
        <p>Ainda não há concursos sincronizados.</p>
        <p className="text-sm">Os dados são atualizados automaticamente em dias úteis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={gridWrapRef}>
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-foreground">Concursos abertos</h1>
        {lastScrapedLabel ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Atualizado em {lastScrapedLabel} · {filtered.length} concurso
            {filtered.length === 1 ? '' : 's'} com os filtros atuais
          </p>
        ) : null}
      </header>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Órgão, cargo… ou UF (ex.: AL)"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={nivel || 'todos'} onValueChange={(v) => setNivel(v === 'todos' ? '' : (v as PciNivelFilter))}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os níveis</SelectItem>
            <SelectItem value="fundamental">Fundamental</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="superior">Superior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-card p-1 w-full justify-start">
          {PCI_REGION_TAB_ORDER.map((regiao) => {
            const count = counts[regiao] ?? 0;
            const label = PCI_REGION_LABELS[regiao] ?? regiao;
            return (
              <TabsTrigger
                key={regiao}
                value={regiao}
                disabled={count === 0}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {availableUfs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {availableUfs.map((uf) => (
              <Badge
                key={uf}
                variant={activeUf === uf ? 'default' : 'outline'}
                className="cursor-pointer text-xs hover:bg-primary/10"
                role="button"
                tabIndex={0}
                onClick={() => toggleUfFilter(uf)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleUfFilter(uf);
                  }
                }}
              >
                {uf}
              </Badge>
            ))}
            {activeUf ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setUfFilter(null);
                  if (parseUfFilter(search)) setSearch('');
                }}
              >
                Limpar estado
              </Button>
            ) : null}
          </div>
        ) : null}

        {!filtered.length ? (
          <p className="text-center text-muted-foreground py-8">Nenhum concurso com esses filtros.</p>
        ) : (
          PCI_REGION_TAB_ORDER.map((regiao) => {
            const panelItems = byRegiao[regiao] ?? [];
            const limit = getLimit(regiao);
            const visible = panelItems.slice(0, limit);
            const remaining = panelItems.length - visible.length;

            return (
              <TabsContent key={regiao} value={regiao} className="mt-4">
                {panelItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum concurso nesta região com os filtros atuais.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {visible.map((item) => (
                        <PciConcursoCard
                          key={item.id}
                          item={item}
                          onUfClick={toggleUfFilter}
                          ufFilterActive={activeUf}
                        />
                      ))}
                    </div>
                    {remaining > 0 ? (
                      <div className="flex justify-center mt-6">
                        <Button variant="outline" onClick={() => loadMore(regiao)}>
                          Carregar mais… ({remaining} restante{remaining === 1 ? '' : 's'})
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </TabsContent>
            );
          })
        )}
      </Tabs>

      <p className="text-xs text-muted-foreground border-t pt-4">
        Dados informativos agregados de fontes públicas. Confira sempre o edital oficial do órgão antes de se
        inscrever.
      </p>
    </div>
  );
}
