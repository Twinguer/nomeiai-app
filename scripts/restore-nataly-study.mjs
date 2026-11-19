/**
 * Restaura user_study_v2 da Nataly Lima a partir do dump (linha COPY) ou audit_logs.
 * Uso: node scripts/restore-nataly-study.mjs [--dry-run]
 */
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const USER_ID = '44c81698-084f-41f3-931a-e8dd1f93a032';
const ROW_ID = '074f60b5-ade0-4988-9191-18dd78df4c0c';
const DUMP_PATH =
  'C:\\Users\\katoz\\OneDrive\\Documents\\Projeto\\nomeia-ai-dump-15-05.sql';
const DUMP_LINE = 40398;
const dryRun = process.argv.includes('--dry-run');

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function countArr(v) {
  return Array.isArray(v) ? v.length : 0;
}

function parseCopyLine(line) {
  const parts = line.split('\t');
  if (parts.length < 10) {
    throw new Error(`Expected 10 tab columns, got ${parts.length}`);
  }
  const [
    id,
    user_id,
    study_sessions,
    study_cycles,
    study_statistics,
    study_schedule,
    study_metadata,
    last_activity_date,
    created_at,
    updated_at,
  ] = parts;

  return {
    id,
    user_id,
    study_sessions: JSON.parse(study_sessions),
    study_cycles: JSON.parse(study_cycles),
    study_statistics: JSON.parse(study_statistics),
    study_schedule: JSON.parse(study_schedule),
    study_metadata: JSON.parse(study_metadata),
    last_activity_date: last_activity_date === '\\N' ? null : last_activity_date,
    created_at: created_at === '\\N' ? null : created_at,
    updated_at: updated_at === '\\N' ? null : updated_at,
  };
}

function loadFromDump() {
  if (!existsSync(DUMP_PATH)) {
    throw new Error(`Dump not found: ${DUMP_PATH}`);
  }
  const lines = readFileSync(DUMP_PATH, 'utf8').split(/\r?\n/);
  const line = lines[DUMP_LINE - 1];
  if (!line?.startsWith(ROW_ID)) {
    throw new Error(
      `Line ${DUMP_LINE} does not start with expected id. Got: ${line?.slice(0, 80)}...`
    );
  }
  return parseCopyLine(line);
}

async function loadFromAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, old_data, new_data')
    .eq('resource_id', ROW_ID)
    .eq('action', 'update_user_study_v2')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  for (const row of data ?? []) {
    const old = row.old_data;
    if (old && countArr(old.study_cycles) > 0) {
      return { source: `audit_logs:${row.id}`, payload: old };
    }
  }
  return null;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== RESTORE ===');
  console.log(`User: ${USER_ID}`);

  const { data: current, error: curErr } = await supabase
    .from('user_study_v2')
    .select('id, user_id, study_cycles, study_sessions, study_schedule, updated_at')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (curErr) throw curErr;

  if (current) {
    console.log('Estado atual:', {
      id: current.id,
      ciclos: countArr(current.study_cycles),
      sessoes: countArr(current.study_sessions),
      cronograma: countArr(current.study_schedule),
      updated_at: current.updated_at,
    });
  } else {
    console.log('Nenhuma linha user_study_v2 no banco (será insert).');
  }

  let source = 'dump';
  let payload = loadFromDump();

  if (countArr(payload.study_cycles) === 0) {
    console.log('Dump sem ciclos; tentando audit_logs...');
    const audit = await loadFromAuditLogs();
    if (audit) {
      source = audit.source;
      payload = audit.payload;
    }
  }

  console.log(`Fonte: ${source}`);
  console.log('Snapshot a restaurar:', {
    id: payload.id ?? ROW_ID,
    ciclos: countArr(payload.study_cycles),
    sessoes: countArr(payload.study_sessions),
    cronograma: countArr(payload.study_schedule),
    cycle_names: (payload.study_cycles ?? [])
      .slice(0, 5)
      .map((c) => c.cycle_name),
  });

  if (countArr(payload.study_cycles) === 0 && countArr(payload.study_sessions) === 0) {
    console.error('Snapshot sem dados de estudo — abortando.');
    process.exit(1);
  }

  const updateBody = {
    study_sessions: payload.study_sessions ?? [],
    study_cycles: payload.study_cycles ?? [],
    study_statistics: payload.study_statistics ?? {},
    study_schedule: payload.study_schedule ?? [],
    study_metadata: payload.study_metadata ?? {},
    last_activity_date: payload.last_activity_date ?? null,
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log('Dry run concluído — nenhuma escrita.');
    return;
  }

  if (current) {
    const { error } = await supabase
      .from('user_study_v2')
      .update(updateBody)
      .eq('user_id', USER_ID);

    if (error) throw error;
    console.log('UPDATE ok.');
  } else {
    const { error } = await supabase.from('user_study_v2').insert({
      id: ROW_ID,
      user_id: USER_ID,
      ...updateBody,
      created_at: payload.created_at ?? new Date().toISOString(),
    });
    if (error) throw error;
    console.log('INSERT ok.');
  }

  const { data: after, error: afterErr } = await supabase
    .from('user_study_v2')
    .select('study_cycles, study_sessions, study_schedule, updated_at')
    .eq('user_id', USER_ID)
    .single();

  if (afterErr) throw afterErr;

  console.log('Estado após restore:', {
    ciclos: countArr(after.study_cycles),
    sessoes: countArr(after.study_sessions),
    cronograma: countArr(after.study_schedule),
    updated_at: after.updated_at,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
