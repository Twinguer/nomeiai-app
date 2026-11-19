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

async function analyzeRankingScores() {
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

      // Buscar todos os rankings deste concurso
      const { data: userRankings, error: rankingsError } = await supabase
        .from('user_rankings')
        .select('user_id, consolidated_data')
        .not('consolidated_data', 'is', null);

      if (rankingsError) {
        console.error('❌ Erro ao buscar rankings:', rankingsError);
        continue;
      }

      const rankingsForConcurso = [];

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
              rankingsForConcurso.push({
                user_id: item.user_id,
                rankingId,
                rankingData: ranking
              });
              break;
            }
          }
        }
      }

      console.log(`   📈 Total de participantes: ${rankingsForConcurso.length}\n`);

      // Ordenar por score
      rankingsForConcurso.sort((a, b) => {
        const scoreA = a.rankingData?.user_data?.score || 0;
        const scoreB = b.rankingData?.user_data?.score || 0;
        return scoreB - scoreA;
      });

      // Analisar os primeiros 5 rankings
      for (let i = 0; i < Math.min(5, rankingsForConcurso.length); i++) {
        const item = rankingsForConcurso[i];
        const userData = item.rankingData?.user_data || {};
        const score = userData.score || 0;
        const subjectScores = userData.subject_scores || {};
        const weightedCustomDisciplineScores = userData.weightedCustomDisciplineScores || userData.weighted_object_scores || {};
        const objectScores = userData.object_scores || {};

        console.log(`   ${i + 1}º Lugar:`);
        console.log(`      User ID: ${item.user_id.substring(0, 8)}...`);
        console.log(`      Score Total: ${score.toFixed(2)}`);
        
        // Calcular soma das disciplinas
        const sumOfDisciplines = Object.values(weightedCustomDisciplineScores).reduce((sum, val) => sum + Number(val || 0), 0);
        const sumOfObjectScores = Object.values(objectScores).reduce((sum, val) => sum + Number(val || 0), 0);
        const sumOfSubjectScores = Object.values(subjectScores).reduce((sum, val) => sum + Number(val || 0), 0);

        console.log(`      Soma das Disciplinas (weightedCustomDisciplineScores): ${sumOfDisciplines.toFixed(2)}`);
        console.log(`      Soma das Disciplinas (object_scores): ${sumOfObjectScores.toFixed(2)}`);
        console.log(`      Soma das Disciplinas (subject_scores): ${sumOfSubjectScores.toFixed(2)}`);
        
        // Mostrar pontuações por disciplina
        if (Object.keys(weightedCustomDisciplineScores).length > 0) {
          console.log(`      Disciplinas (weightedCustomDisciplineScores):`);
          for (const [discipline, disciplineScore] of Object.entries(weightedCustomDisciplineScores)) {
            console.log(`         ${discipline}: ${Number(disciplineScore).toFixed(2)}`);
          }
        }

        if (Object.keys(objectScores).length > 0) {
          console.log(`      Disciplinas (object_scores):`);
          for (const [discipline, disciplineScore] of Object.entries(objectScores)) {
            console.log(`         ${discipline}: ${Number(disciplineScore).toFixed(2)}`);
          }
        }

        if (Object.keys(subjectScores).length > 0) {
          console.log(`      Disciplinas (subject_scores):`);
          for (const [discipline, disciplineScore] of Object.entries(subjectScores)) {
            console.log(`         ${discipline}: ${Number(disciplineScore).toFixed(2)}`);
          }
        }

        // Verificar se há subjetivas
        const subjectives = userData.subjectives || {};
        if (Object.keys(subjectives).length > 0) {
          console.log(`      Subjetivas:`);
          for (const [key, value] of Object.entries(subjectives)) {
            console.log(`         ${key}: ${Number(value).toFixed(2)}`);
          }
        }

        // Verificar discrepância
        const expectedTotal = sumOfDisciplines + (subjectives.discursive || 0) + (subjectives.case_study_1 || 0) + 
                             (subjectives.case_study_2 || 0) + (subjectives.case_study_3 || 0) + (subjectives.other_subjective || 0);
        const discrepancy = Math.abs(score - expectedTotal);
        
        if (discrepancy > 0.01) {
          console.log(`      ⚠️ DISCREPÂNCIA DETECTADA!`);
          console.log(`         Score Total: ${score.toFixed(2)}`);
          console.log(`         Soma Esperada: ${expectedTotal.toFixed(2)}`);
          console.log(`         Diferença: ${discrepancy.toFixed(2)}`);
        }

        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

analyzeRankingScores();

