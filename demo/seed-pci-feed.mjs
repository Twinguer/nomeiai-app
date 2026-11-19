/**
 * Envia demo/pci-concursos.json para Supabase (service role).
 * Gere o JSON antes: node demo/scrape-pci.mjs
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node demo/seed-pci-feed.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, 'pci-concursos.json');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const scrapedAt = raw.scrapedAt || new Date().toISOString();
const supabase = createClient(url, key);

const seen = new Set();
const uniqueItems = raw.items.filter((item) => {
  if (seen.has(item.id)) return false;
  seen.add(item.id);
  return true;
});

const rows = uniqueItems.map((item) => ({
  id: item.id,
  titulo: item.titulo,
  regiao: item.regiao,
  uf: item.uf ?? null,
  vagas: item.vagas,
  vagas_texto: item.vagasTexto ?? null,
  salario_min: item.salarioMin,
  salario_max: item.salarioMax,
  salario_texto: item.salarioTexto || null,
  cargos: item.cargos,
  escolaridade: item.escolaridade,
  resumo: item.resumo,
  inscricao_ate: item.inscricaoAte,
  inscricao_texto: item.inscricaoTexto,
  status: item.status,
  is_active: true,
  scraped_at: scrapedAt,
  updated_at: scrapedAt,
}));

const BATCH = 100;
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from('pci_concurso_feed').upsert(rows.slice(i, i + BATCH), { onConflict: 'id' });
  if (error) throw error;
  console.log(`Upsert ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
}
console.log('OK:', rows.length, 'registros');
