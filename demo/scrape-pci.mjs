/**
 * Scrap PCI /concursos/ — utilitário local (não entra no build).
 * Saída: demo/pci-concursos.json para seed opcional ou debug.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PCI_URL = 'https://www.pciconcursos.com.br/concursos/';

const H2_TO_REGIAO = [
  [/NACIONAL/i, 'NACIONAL'],
  [/REGIÃO\s+SUDESTE/i, 'SUDESTE'],
  [/REGIÃO\s+SUL/i, 'SUL'],
  [/REGIÃO\s+CENTRO-?OESTE/i, 'CENTRO-OESTE'],
  [/REGIÃO\s+NORDESTE/i, 'NORDESTE'],
  [/REGIÃO\s+NORTE/i, 'NORTE'],
];

function normalizeText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function mapH2ToRegiao(text) {
  const t = normalizeText(text);
  for (const [re, regiao] of H2_TO_REGIAO) {
    if (re.test(t)) return regiao;
  }
  return null;
}

function slugId(titulo, regiao, uf, inscricao, escolaridade, resumo) {
  return [titulo, regiao, uf || '', inscricao, escolaridade || '', resumo || '']
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function parseVagas(text) {
  const m = text.match(/([\d.]+)\s*vagas/i);
  if (m) return parseInt(m[1].replace(/\./g, ''), 10);
  if (/cadastro de reserva/i.test(text)) return null;
  return null;
}

function parseSalario(text) {
  const ate = text.match(/até\s*R\$\s*([\d.,]+)/i);
  if (ate) {
    const val = parseFloat(ate[1].replace(/\./g, '').replace(',', '.'));
    return { min: null, max: val, texto: `até R$ ${ate[1]}` };
  }
  const range = text.match(/R\$\s*([\d.,]+)\s*a\s*R\$\s*([\d.,]+)/i);
  if (range) {
    const toNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return { min: toNum(range[1]), max: toNum(range[2]), texto: `R$ ${range[1]} a R$ ${range[2]}` };
  }
  return { min: null, max: null, texto: '' };
}

function parseCd(cdEl) {
  const full = normalizeText(cdEl?.textContent || '');
  const outerSpan = cdEl?.querySelector(':scope > span');
  const innerSpan = outerSpan?.querySelector(':scope > span');
  const escolaridade = normalizeText(innerSpan?.textContent || '');
  let cargos = '';
  if (outerSpan) {
    const parts = [];
    for (const node of outerSpan.childNodes) {
      if (node.nodeName === 'SPAN') break;
      if (node.nodeType === 3) parts.push(node.textContent);
      if (node.nodeName === 'BR') parts.push(' ');
    }
    cargos = normalizeText(parts.join(''));
  }
  let line1 = full;
  if (outerSpan) {
    const idx = full.indexOf(normalizeText(outerSpan.textContent));
    if (idx > 0) line1 = full.slice(0, idx).trim();
  }
  const { min, max, texto } = parseSalario(line1 || full);
  return {
    vagas: parseVagas(full),
    vagasTexto: /cadastro de reserva/i.test(full) ? 'Cadastro de reserva' : null,
    salarioMin: min,
    salarioMax: max,
    salarioTexto: texto,
    cargos: cargos || '—',
    escolaridade: escolaridade || '—',
    resumo: line1 || full.slice(0, 120),
  };
}

function parseInscricao(ceEl) {
  const raw = normalizeText((ceEl?.textContent || '').replace(/\s*a\s*/i, ' a '));
  const dates = raw.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  return {
    inscricaoAte: dates[dates.length - 1] || raw,
    inscricaoTexto: raw,
    status: 'aberto',
  };
}

/**
 * @param {string} html
 */
export function parsePciConcursosHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const center = doc.querySelector('#center') || doc.body;

  let regiao = null;
  let ufEstado = null;
  /** @type {ReturnType<typeof buildItem>[]} */
  const items = [];

  const nodes = center.querySelectorAll('h2, div.ua, div.da, div.na');
  for (const node of nodes) {
    if (node.tagName === 'H2') {
      const mapped = mapH2ToRegiao(node.textContent);
      if (mapped) {
        regiao = mapped;
        ufEstado = null;
      }
      continue;
    }

    if (node.classList.contains('ua')) {
      const ufDiv = node.querySelector('.uf');
      ufEstado = node.id && node.id.length <= 3 ? node.id : null;
      if (!ufEstado && ufDiv) {
        const nome = normalizeText(ufDiv.textContent);
        if (nome === 'NACIONAL') ufEstado = null;
      }
      continue;
    }

    if (!regiao) continue;
    if (!node.classList.contains('da') && !node.classList.contains('na')) continue;

    const tituloEl = node.querySelector('.ca a');
    if (!tituloEl) continue;

    const titulo = normalizeText(tituloEl.textContent);
    if (!titulo) continue;

    const cc = normalizeText(node.querySelector('.cc')?.textContent || '');
    const uf = cc && cc.length <= 3 && cc !== '\u00a0' ? cc : regiao === 'NACIONAL' ? undefined : ufEstado || undefined;

    const cd = parseCd(node.querySelector('.cd'));
    const insc = parseInscricao(node.querySelector('.ce'));

    items.push({
      id: slugId(titulo, regiao, uf, insc.inscricaoAte, cd.escolaridade, cd.resumo),
      titulo,
      regiao,
      uf,
      ...cd,
      ...insc,
    });
  }

  return items;
}

export async function fetchPciConcursosHtml() {
  const res = await fetch(PCI_URL, {
    headers: {
      'User-Agent': 'NomeiaAi-Preview-Scrap/1.0 (+local demo only)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`PCI respondeu ${res.status}`);
  return res.text();
}

export async function scrapePciConcursos() {
  const html = await fetchPciConcursosHtml();
  const items = parsePciConcursosHtml(html);
  return {
    scrapedAt: new Date().toISOString(),
    source: 'pciconcursos.com.br/concursos',
    total: items.length,
    items,
  };
}

async function main() {
  const outFile = path.join(__dirname, 'pci-concursos.json');

  console.log('Buscando', PCI_URL, '…');
  const data = await scrapePciConcursos();
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`OK: ${data.total} concursos → ${outFile}`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
