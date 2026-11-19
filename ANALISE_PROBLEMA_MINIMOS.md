# Análise do Problema: Cálculo de Mínimos no CNU

## 🔍 Problema Identificado

### Dados Encontrados

**Concurso:** CNU - AUDITOR TI
- **ID:** `a1a8571a-aa5e-481d-81d3-a08b5011a05c`
- **Mínimo Global (AC):** 99
- **Mínimo Global (Cotas):** 0
- **Tipo de Prova:** Alternativas

### Usuários com Problema

| User ID | Score | Reservation Type | Below Minimum | Status | Problema |
|---------|-------|------------------|---------------|--------|----------|
| `1ca99a34...` | 15 | "AC" | ❌ false | classificado | ⚠️ Deveria estar eliminado |
| `44c81698...` | 30 | "AC" | ❌ false | classificado | ⚠️ Deveria estar eliminado |
| `34d22725...` | 45 | "AC" | ❌ false | classificado | ⚠️ Deveria estar eliminado |
| `63bff77d...` | 45 | "Ampla Concorrência" | ✅ true | eliminado | ✅ Correto |

## 🐛 Causa Raiz do Problema

### Problema Principal: Normalização de `reservation_type`

A função `calculate_user_score_realtime` verifica se o usuário é de cota na linha 182:

```sql
v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');
```

**O PROBLEMA:**
- Alguns usuários têm `reservation_type = "AC"` (abreviação)
- Outros têm `reservation_type = "Ampla Concorrência"` (nome completo)
- A função só reconhece "Ampla Concorrência" como ampla concorrência
- Quando `reservation_type = "AC"`, a função trata como cota (`v_is_quota = true`)
- Para cotas, ela busca `minimum_total_score_cotas` que é 0
- Como 0 não é > 0, a verificação `v_has_global_minimum` fica false
- Resultado: usuários com "AC" não são eliminados mesmo com score < 99

### Evidências

1. **Usuário com "Ampla Concorrência":**
   - `v_is_quota = false`
   - `v_global_minimum_score = 99` (lê `minimum_total_score`)
   - `v_has_global_minimum = true` (99 > 0)
   - ✅ Verificação funciona: `45 < 99` → eliminado

2. **Usuários com "AC":**
   - `v_is_quota = true` (ERRADO!)
   - `v_global_minimum_score = 0` (lê `minimum_total_score_cotas`)
   - `v_has_global_minimum = false` (0 não é > 0)
   - ❌ Verificação não executa: não elimina

## 📋 Localização do Código

**Arquivo:** `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql`

**Linha 181-182:**
```sql
v_quota_type := v_user_ranking_data->'user_data'->>'reservation_type';
v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');
```

**Linha 237-242:**
```sql
IF v_is_quota THEN
  v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score_cotas')::numeric, 0);
ELSE
  v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score')::numeric, 0);
END IF;
v_has_global_minimum := (v_global_minimum_score > 0);
```

## ✅ Solução Proposta

A função precisa normalizar o `reservation_type` antes de verificar se é cota. O frontend já tem a função `normalizeReservationType` que faz isso, mas o backend não está usando.

**Mapeamento necessário (baseado em `quotaNormalization.ts`):**
- "AC" → "Ampla Concorrência"
- "Ampla" → "Ampla Concorrência"
- "Ampla Concorrência" → "Ampla Concorrência"
- Qualquer outro valor → Cota

**Correção necessária na linha 181-182:**

```sql
-- Normalizar reservation_type (mesma lógica do frontend)
v_quota_type := v_user_ranking_data->'user_data'->>'reservation_type';

-- Normalizar códigos comuns para nomes completos
IF v_quota_type = 'AC' OR v_quota_type = 'ac' OR v_quota_type = 'Ampla' THEN
  v_quota_type := 'Ampla Concorrência';
ELSIF v_quota_type = 'PPI' THEN
  v_quota_type := 'PPP';
ELSIF v_quota_type = 'PC' THEN
  v_quota_type := 'Hipossuficientes';
ELSIF v_quota_type = 'PD' THEN
  v_quota_type := 'Pessoas Trans';
END IF;

-- Verificar se é cota (apenas se não for Ampla Concorrência)
v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');
```

**Arquivo a modificar:**
- `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql` (linhas 181-182)

## 🔧 Verificações Adicionais

1. ✅ A função calcula `v_objective_score` corretamente (sem subjetivas)
2. ✅ A verificação do mínimo usa `v_objective_score` (linha 466)
3. ✅ O mínimo está configurado corretamente no banco (99 para AC)
4. ❌ A normalização de `reservation_type` está incorreta

## 📊 Impacto

- **4 usuários** no concurso CNU
- **3 usuários** com problema (75%)
- **1 usuário** funcionando corretamente (25%)

Todos os usuários com `reservation_type = "AC"` não estão sendo eliminados corretamente.

