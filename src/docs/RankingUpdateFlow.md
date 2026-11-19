
# Ranking Update Flow Documentation

Este documento descreve o fluxo completo de atualização de rankings no sistema, explicando como as pontuações são calculadas e quando são propagadas para todos os usuários.

## Estrutura do Banco de Dados

### Tabelas Principais
- `user_rankings`: Armazena os rankings dos usuários para cada concurso
- `user_answers`: Armazena as respostas dos usuários para cada ranking
- `official_answer_weights`: Armazena o gabarito oficial com pesos para cada concurso
- `score_calculation_logs`: Registra todas as operações de cálculo de pontuação

### Funções Principais do Banco de Dados
- `recalculate_all_scores_with_weights`: Função principal para recalcular todas as pontuações de um concurso (com SECURITY DEFINER)
- `recalculate_all_users_scores_realtime`: Marca todos os rankings de um concurso para recálculo (com SECURITY DEFINER)
- `update_answer_with_weight`: Atualiza uma resposta no gabarito oficial (com SECURITY DEFINER)
- `save_user_answers_and_calculate_scores`: Salva as respostas do usuário e calcula pontuações (com SECURITY DEFINER)
- `calculate_user_score_realtime`: Calcula pontuações para um único usuário (com SECURITY DEFINER)

## Sequência de Fluxo de Atualização

1. **Pontos de Gatilho**:
   - Quando o gabarito oficial é atualizado (via `useOfficialAnswerWeights`)
   - Quando o usuário clica no botão de atualização manual (via botão na `ResultadosPage`)

2. **Processo de Recálculo de Pontuação**:
   - O frontend chama `recalculateAllUserScores` em `batchOperations.ts`
   - Isso chama a função de banco de dados `recalculate_all_scores_with_weights` com privilégios SECURITY DEFINER
   - A função de banco de dados atualiza todos os rankings de usuário para o concurso, ignorando o RLS

3. **Atualizações em Tempo Real**:
   - Após o recálculo, a flag `is_score_recalculated` é definida como false via `recalculate_all_users_scores_realtime`
   - O frontend escuta alterações no banco de dados via canais Supabase
   - Quando alterações são detectadas, os rankings são automaticamente buscados novamente

## Componentes Principais e seus Papéis

### Componentes Frontend
- `ResultadosPage`: Página principal que exibe rankings, inclui botão de atualização
- `RankingTable`: Exibe rankings de usuário com pontuações
- `AnswerSheet`: Interface para usuários entrarem com suas respostas

### Hooks Frontend
- `useResultadosData`: Busca e gerencia dados de ranking
- `useOfficialAnswerWeights`: Gerencia gabaritos oficiais
- `useSaveAnswers`: Lida com salvamento de respostas e cálculo de pontuação

### Operações Backend
- `batchOperations.ts`: Contém funções para operações em massa como `recalculateAllUserScores`
- `answerKeyService.ts`: Serviços para gerenciamento de gabarito
- `scoreCalculation.ts`: Funções para calcular pontuações de usuário

## Fluxo de Atualização Detalhado

1. **Atualização de Gabarito Oficial**: 
   - Admin atualiza uma resposta via `useOfficialAnswerWeights.updateAnswer`
   - Isso chama a função de banco de dados `update_answer_with_weight`
   - Após a atualização, `recalculateAllUserScores` é chamado automaticamente
   - Todas as pontuações de usuário são recalculadas no banco de dados com privilégios SECURITY DEFINER

2. **Salvamento de Resposta de Usuário**:
   - Usuário salva respostas via `useSaveAnswers.handleSaveAnswers`
   - Isso chama a função de banco de dados `save_user_answers_and_calculate_scores`
   - A pontuação do usuário é calculada individualmente
   - Não há recálculo automático para todos os usuários após o salvamento de respostas individuais

3. **Atualização Manual**:
   - Usuário clica no botão atualizar em `ResultadosPage`
   - A função `refreshData` é chamada
   - Se o usuário estiver autenticado, isso chama `recalculateAllUserScores` de `batchOperations.ts`
   - Todas as pontuações de usuário são recalculadas no banco de dados

4. **Atualizações em Tempo Real**:
   - Hook `useResultadosData` configura um listener de canal Supabase
   - Quando rankings são atualizados, dados são automaticamente buscados novamente
   - Os usuários veem atualizações em tempo real sem recarregar a página

## Segurança e Performance

- SECURITY DEFINER é usado para funções importantes do banco de dados para contornar o RLS
- Isso permite que administradores e criadores de ranking atualizem pontuações de todos os usuários
- Políticas RLS públicas são configuradas para permitir que qualquer pessoa leia os rankings
- Operações em lote são usadas para eficiência ao atualizar muitos usuários
- Atualizações em tempo real usam canais Supabase eficientes para propagação imediata

## Solução de Problemas

Se as atualizações de ranking não estiverem sendo propagadas:

1. Verifique se as funções do banco de dados têm a flag SECURITY DEFINER
2. Verifique se as políticas RLS permitem acesso apropriado
3. Certifique-se de que canais em tempo real estão configurados corretamente
4. Procure erros nos logs de cálculo de pontuação
5. Teste a atualização manual via botão de atualização em ResultadosPage
6. Verifique se o usuário está logado ao tentar iniciar atualizações manuais
