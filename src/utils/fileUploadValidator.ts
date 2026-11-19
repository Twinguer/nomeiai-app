/**
 * Utilitário unificado para validação de uploads de arquivos
 */

import {
  FILE_UPLOAD_LIMITS,
  IMAGE_DIMENSION_LIMITS,
  ALLOWED_FILE_TYPES,
  formatFileSize as formatFileSizeUtil,
  getUploadLimit,
  getImageDimensions,
} from '@/config/fileUploadLimits';

// Re-exportar formatFileSize para uso externo
export { formatFileSizeUtil as formatFileSize };

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Valida dimensões de imagem
 */
const validateImageDimensions = async (
  file: File,
  type: keyof typeof IMAGE_DIMENSION_LIMITS
): Promise<{ isValid: boolean; dimensions?: ImageDimensions; error?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const dimensions = { width: img.width, height: img.height };
      const limits = getImageDimensions(type);

      if (img.width > limits.maxWidth || img.height > limits.maxHeight) {
        resolve({
          isValid: false,
          dimensions,
          error: `Imagem muito grande. Dimensões máximas: ${limits.maxWidth}x${limits.maxHeight}px. Sua imagem: ${img.width}x${img.height}px`,
        });
        return;
      }

      resolve({ isValid: true, dimensions });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        isValid: false,
        error: 'Não foi possível ler as dimensões da imagem',
      });
    };

    img.src = url;
  });
};

/**
 * Valida tipo de arquivo
 */
const validateFileType = (
  file: File,
  allowedTypes: readonly string[]
): { isValid: boolean; error?: string } => {
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Tipo de arquivo não permitido. Tipos permitidos: ${allowedTypes.join(', ')}`,
    };
  }
  return { isValid: true };
};

/**
 * Valida tamanho do arquivo
 */
const validateFileSize = (
  file: File,
  maxSize: number
): { isValid: boolean; error?: string } => {
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${formatFileSizeUtil(maxSize)}. Seu arquivo: ${formatFileSizeUtil(file.size)}`,
    };
  }
  return { isValid: true };
};

/**
 * Validação completa de upload de arquivo
 */
export const validateFileUpload = async (
  file: File,
  options: {
    uploadType: keyof typeof FILE_UPLOAD_LIMITS;
    isImage?: boolean;
    validateDimensions?: boolean;
  }
): Promise<FileValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar tamanho
  const maxSize = getUploadLimit(options.uploadType);
  const sizeValidation = validateFileSize(file, maxSize);
  if (!sizeValidation.isValid) {
    errors.push(sizeValidation.error!);
  }

  // 2. Validar tipo
  const allowedTypes = options.isImage
    ? ALLOWED_FILE_TYPES.IMAGES
    : ALLOWED_FILE_TYPES.PDF;
  const typeValidation = validateFileType(file, allowedTypes);
  if (!typeValidation.isValid) {
    errors.push(typeValidation.error!);
  }

  // 3. Validar dimensões (apenas para imagens)
  let dimensions: ImageDimensions | undefined;
  if (options.isImage && options.validateDimensions) {
    const dimensionValidation = await validateImageDimensions(
      file,
      options.uploadType as keyof typeof IMAGE_DIMENSION_LIMITS
    );
    if (!dimensionValidation.isValid) {
      errors.push(dimensionValidation.error!);
    } else {
      dimensions = dimensionValidation.dimensions;
      
      // Adicionar warning se a imagem for muito grande (mas dentro do limite)
      const limits = getImageDimensions(
        options.uploadType as keyof typeof IMAGE_DIMENSION_LIMITS
      );
      if (
        dimensions &&
        (dimensions.width > limits.recommendedWidth ||
          dimensions.height > limits.recommendedHeight)
      ) {
        warnings.push(
          `Imagem grande. Dimensões recomendadas: ${limits.recommendedWidth}x${limits.recommendedHeight}px para melhor performance.`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validação simples (sem dimensões) - mais rápida
 */
export const validateFileUploadSimple = (
  file: File,
  uploadType: keyof typeof FILE_UPLOAD_LIMITS,
  isImage: boolean = false
): FileValidationResult => {
  const errors: string[] = [];

  // Validar tamanho
  const maxSize = getUploadLimit(uploadType);
  const sizeValidation = validateFileSize(file, maxSize);
  if (!sizeValidation.isValid) {
    errors.push(sizeValidation.error!);
  }

  // Validar tipo
  const allowedTypes = isImage
    ? ALLOWED_FILE_TYPES.IMAGES
    : ALLOWED_FILE_TYPES.PDF;
  const typeValidation = validateFileType(file, allowedTypes);
  if (!typeValidation.isValid) {
    errors.push(typeValidation.error!);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

