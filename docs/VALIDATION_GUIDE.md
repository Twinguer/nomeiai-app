# 🔒 Guia de Validação de Inputs

## 📋 Visão Geral

Este documento descreve como usar os validadores de input de forma padronizada em todo o sistema para garantir segurança e consistência.

## 🎯 Validadores Disponíveis

### 1. SecurityValidators (Básico)

Validação de segurança básica - SQL injection, XSS, etc.

```typescript
import { SecurityValidators } from '@/utils/securityValidators';

// Validar input genérico
const validation = SecurityValidators.validateInput(userInput);
if (!validation.isValid) {
  // Rejeitar input
  return;
}

// Validar UUID
if (!SecurityValidators.validateUUID(userId)) {
  // UUID inválido
}

// Validar range numérico
if (!SecurityValidators.validateNumericRange(value, 0, 100)) {
  // Valor fora do range
}
```

### 2. EnhancedInputValidator (Avançado)

Validação completa com sanitização e regras customizadas.

```typescript
import { EnhancedInputValidator } from '@/utils/enhancedInputValidation';

// Validar com regras
const result = EnhancedInputValidator.validate(value, {
  required: true,
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9\s]+$/,
  sanitize: true
});

if (!result.isValid) {
  // Mostrar erros: result.errors
  return;
}

// Usar valor sanitizado: result.sanitizedValue
```

### 3. useSecurityValidation (Hook React)

Hook para validação em componentes React.

```typescript
import { useSecurityValidation } from '@/hooks/useSecurityValidation';

const MyComponent = () => {
  const { validateAndSanitizeInput, validateUUID, validateNumericInput } = useSecurityValidation();
  
  const handleSubmit = (input: string) => {
    const sanitized = validateAndSanitizeInput(input, 'Nome');
    if (!sanitized) return; // Validação falhou
    
    // Usar sanitized
  };
};
```

### 4. useInputValidation (Hook React - Avançado)

Hook com validações específicas (email, password, URL, etc).

```typescript
import { useInputValidation } from '@/utils/enhancedInputValidation';

const MyComponent = () => {
  const { validateEmail, validatePassword, validateURL, validate } = useInputValidation();
  
  const emailResult = validateEmail(email);
  if (!emailResult.isValid) {
    // Mostrar erros
  }
};
```

## 📝 Padrão Recomendado

### Para Formulários Simples

```typescript
import { SecurityValidators } from '@/utils/securityValidators';

const handleInput = (value: string) => {
  // 1. Validar segurança básica
  const securityCheck = SecurityValidators.validateInput(value);
  if (!securityCheck.isValid) {
    toast.error(`Entrada inválida: ${securityCheck.reason}`);
    return;
  }
  
  // 2. Validar regras específicas do campo
  if (value.length < 3) {
    toast.error('Mínimo de 3 caracteres');
    return;
  }
  
  if (value.length > 50) {
    toast.error('Máximo de 50 caracteres');
    return;
  }
  
  // 3. Usar valor validado
  setFieldValue(value);
};
```

### Para Formulários Complexos

```typescript
import { EnhancedInputValidator } from '@/utils/enhancedInputValidation';

const handleSubmit = (formData: FormData) => {
  // Validar cada campo
  const nameResult = EnhancedInputValidator.validate(formData.name, {
    required: true,
    minLength: 2,
    maxLength: 100,
    sanitize: true
  });
  
  const emailResult = EnhancedInputValidator.validateEmail(formData.email);
  
  // Verificar se todos são válidos
  if (!nameResult.isValid || !emailResult.isValid) {
    // Mostrar erros
    const allErrors = [
      ...nameResult.errors,
      ...emailResult.errors
    ];
    toast.error(allErrors.join(', '));
    return;
  }
  
  // Usar valores sanitizados
  submitData({
    name: nameResult.sanitizedValue,
    email: emailResult.sanitizedValue
  });
};
```

### Para Componentes React

```typescript
import { useSecurityValidation } from '@/hooks/useSecurityValidation';

const MyForm = () => {
  const { validateAndSanitizeInput } = useSecurityValidation();
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleNameChange = (value: string) => {
    const sanitized = validateAndSanitizeInput(value, 'Nome');
    if (sanitized === null) {
      setErrors(prev => ({ ...prev, name: 'Nome inválido' }));
      return;
    }
    
    setErrors(prev => ({ ...prev, name: '' }));
    setName(sanitized);
  };
  
  return (
    <Input
      value={name}
      onChange={(e) => handleNameChange(e.target.value)}
      error={errors.name}
    />
  );
};
```

## 🔍 Campos Específicos

### Email

```typescript
import { EnhancedInputValidator } from '@/utils/enhancedInputValidation';

const result = EnhancedInputValidator.validateEmail(email);
if (!result.isValid) {
  // result.errors contém mensagens de erro
}
```

### Senha

```typescript
import { EnhancedInputValidator } from '@/utils/enhancedInputValidation';

const result = EnhancedInputValidator.validatePassword(password);
if (!result.isValid) {
  // result.errors contém requisitos não atendidos
}
```

### URL

```typescript
import { EnhancedInputValidator } from '@/utils/enhancedInputValidation';

const result = EnhancedInputValidator.validateURL(url);
if (!result.isValid) {
  // URL inválida
}
```

### UUID

```typescript
import { SecurityValidators } from '@/utils/securityValidators';

if (!SecurityValidators.validateUUID(id)) {
  // UUID inválido
}
```

### Arquivo

```typescript
import { SecurityValidators } from '@/utils/securityValidators';

const result = SecurityValidators.validateFileUpload(file);
if (!result.isValid) {
  // result.reason contém o motivo
}
```

## ⚠️ Regras Importantes

1. **SEMPRE validar no frontend** - Primeira linha de defesa
2. **NUNCA confiar apenas no frontend** - Backend também deve validar
3. **SEMPRE sanitizar** - Remover caracteres perigosos
4. **SEMPRE validar comprimento** - Prevenir buffer overflow
5. **SEMPRE validar tipo** - Garantir tipo correto
6. **SEMPRE validar formato** - Email, URL, UUID, etc.

## 🚫 O que NÃO fazer

```typescript
// ❌ ERRADO: Sem validação
const handleSubmit = (input: string) => {
  saveToDatabase(input); // PERIGOSO!
};

// ❌ ERRADO: Validação incompleta
const handleSubmit = (input: string) => {
  if (input.length > 0) {
    saveToDatabase(input); // Ainda perigoso!
  }
};

// ✅ CORRETO: Validação completa
const handleSubmit = (input: string) => {
  const validation = SecurityValidators.validateInput(input);
  if (!validation.isValid) return;
  
  if (input.length < 3 || input.length > 100) return;
  
  const sanitized = input.trim();
  saveToDatabase(sanitized);
};
```

## 📚 Exemplos Práticos

Veja os seguintes arquivos para exemplos:
- `src/components/Auth/SignupForm.tsx` - Validação de formulário de cadastro
- `src/hooks/useSecureAuth.tsx` - Validação de autenticação
- `src/utils/enhancedInputValidation.ts` - Validações avançadas

## 🔄 Migração

Para migrar formulários existentes:

1. Identificar todos os inputs
2. Adicionar validação de segurança básica
3. Adicionar validação de regras específicas
4. Adicionar sanitização
5. Mostrar mensagens de erro ao usuário
6. Testar com inputs maliciosos


