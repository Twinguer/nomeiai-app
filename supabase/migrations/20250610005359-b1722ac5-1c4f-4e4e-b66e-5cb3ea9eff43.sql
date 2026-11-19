
-- Verificar o constraint atual
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'official_answer_weights'::regclass 
AND contype = 'c';

-- Remover o constraint restritivo se existir
ALTER TABLE official_answer_weights 
DROP CONSTRAINT IF EXISTS section_type_check;

-- Criar um novo constraint mais flexível que permite valores custom_*
ALTER TABLE official_answer_weights 
ADD CONSTRAINT section_type_check 
CHECK (
    section_type IS NULL OR 
    section_type IN ('basic', 'specific1', 'specific2', 'specific3', 'CONSOLIDATED') OR
    section_type LIKE 'custom_%'
);
