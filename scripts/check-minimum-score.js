import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMinimumScore() {
  try {
    // Buscar o concurso CNU - Analista Administrativo
    const { data: concursos, error: concursoError } = await supabase
      .from('concursos')
      .select('id, titulo, orgao, disciplines')
      .ilike('titulo', '%CNU%')
      .ilike('orgao', '%Analista Administrativo%');

    if (concursoError) {
      console.error('❌ Erro ao buscar concursos:', concursoError);
      return;
    }

    if (!concursos || concursos.length === 0) {
      console.log('⚠️ Nenhum concurso CNU encontrado');
      return;
    }

    console.log(`\n📊 Encontrados ${concursos.length} concurso(s) CNU\n`);

    for (const concurso of concursos) {
      console.log(`\n🔍 Analisando: ${concurso.titulo} (${concurso.orgao})`);
      console.log(`   ID: ${concurso.id}\n`);

      // Verificar estrutura disciplines
      const disciplines = concurso.disciplines;
      
      if (!disciplines) {
        console.log('   ⚠️ Nenhuma estrutura de disciplinas encontrada');
        continue;
      }

      // Verificar se é objeto (nova estrutura) ou array (estrutura antiga)
      if (typeof disciplines === 'object' && !Array.isArray(disciplines)) {
        // Nova estrutura JSONB
        const minimumTotalScore = disciplines.minimum_total_score || 0;
        const minimumTotalScoreCotas = disciplines.minimum_total_score_cotas || 0;
        
        console.log(`   📋 Mínimo Global (Ampla Concorrência): ${minimumTotalScore}`);
        console.log(`   📋 Mínimo Global (Cotas): ${minimumTotalScoreCotas}`);
        
        if (minimumTotalScore === 0 && minimumTotalScoreCotas === 0) {
          console.log('   ⚠️ ATENÇÃO: Mínimos estão configurados como 0!');
        } else if (minimumTotalScore !== 99) {
          console.log(`   ⚠️ ATENÇÃO: Mínimo global está como ${minimumTotalScore}, mas deveria ser 99!`);
        } else {
          console.log('   ✅ Mínimo global está configurado corretamente como 99');
        }
        
        // Verificar blocos e disciplinas
        if (disciplines.blocks && Array.isArray(disciplines.blocks)) {
          console.log(`   📦 Blocos: ${disciplines.blocks.length}`);
          disciplines.blocks.forEach((block, idx) => {
            console.log(`      Bloco ${idx + 1}: ${block.blockName || block.blockId}`);
            console.log(`         Mínimo do Bloco (AC): ${block.blockMinimumScore || 0}`);
            console.log(`         Mínimo do Bloco (Cotas): ${block.blockMinimumCotas || 0}`);
            
            if (block.disciplines && Array.isArray(block.disciplines)) {
              console.log(`         Disciplinas: ${block.disciplines.length}`);
              block.disciplines.forEach((disc) => {
                if (disc.isEnabled) {
                  console.log(`            - ${disc.name} (${disc.type})`);
                  console.log(`              Mínimo (AC): ${disc.minimum_score || 0}`);
                  console.log(`              Mínimo (Cotas): ${disc.minimum_score_cotas || 0}`);
                }
              });
            }
          });
        }
      } else if (Array.isArray(disciplines)) {
        console.log('   ⚠️ Estrutura antiga (array) - não tem mínimo global configurado');
      }

      // Buscar alguns rankings para verificar se estão sendo eliminados corretamente
      const { data: userRankings, error: rankingsError } = await supabase
        .from('user_rankings')
        .select('user_id, consolidated_data')
        .not('consolidated_data', 'is', null)
        .limit(10);

      if (rankingsError) {
        console.error('   ❌ Erro ao buscar rankings:', rankingsError);
        continue;
      }

      console.log(`\n   📊 Verificando ${userRankings?.length || 0} rankings de exemplo:\n`);

      let classifiedCount = 0;
      let eliminatedCount = 0;

      for (const item of userRankings || []) {
        let consolidatedData = item.consolidated_data;
        
        if (typeof consolidatedData === 'string') {
          try {
            consolidatedData = JSON.parse(consolidatedData);
          } catch (e) {
            continue;
          }
        }

        if (consolidatedData?.rankings) {
          for (const [rankingId, ranking] of Object.entries(consolidatedData.rankings)) {
            const rankingConcursoId = ranking?.concurso_id;
            
            if (String(rankingConcursoId) === String(concurso.id)) {
              const userData = ranking?.user_data || {};
              const score = userData.score || 0;
              const belowMinimum = userData.belowMinimum || userData.below_minimum || false;
              
              const status = belowMinimum ? '❌ ELIMINADO' : '✅ CLASSIFICADO';
              
              console.log(`      ${status} - Score: ${score.toFixed(2)}, Mínimo: ${minimumTotalScore}`);
              
              if (belowMinimum) {
                eliminatedCount++;
                if (userData.elimination_reasons) {
                  console.log(`         Motivos: ${JSON.stringify(userData.elimination_reasons)}`);
                }
              } else {
                classifiedCount++;
              }
              
              // Verificar se há inconsistência
              if (!belowMinimum && score < minimumTotalScore && minimumTotalScore > 0) {
                console.log(`         ⚠️ INCONSISTÊNCIA: Score ${score} < Mínimo ${minimumTotalScore} mas está CLASSIFICADO!`);
              }
              
              break;
            }
          }
        }
      }

      console.log(`\n   📈 Resumo:`);
      console.log(`      Classificados: ${classifiedCount}`);
      console.log(`      Eliminados: ${eliminatedCount}`);
    }
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMinimumScore();





