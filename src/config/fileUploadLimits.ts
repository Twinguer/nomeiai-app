/**
 * Configuração centralizada de limites de upload de arquivos
 * Baseado em boas práticas da indústria e necessidades da aplicação
 */

export const FILE_UPLOAD_LIMITS = {
  // Avatares e imagens de perfil (pequenas, muitas requisições)
  AVATAR: 2 * 1024 * 1024, // 2MB
  
  // Imagens de posts em grupos de estudo
  POST_IMAGE: 5 * 1024 * 1024, // 5MB
  
  // Documentos PDF em posts
  POST_PDF: 10 * 1024 * 1024, // 10MB
  
  // Marca d'água (deve ser leve)
  WATERMARK: 1 * 1024 * 1024, // 1MB
  
  // Documentos de estudo (trilhas, provas subjetivas)
  STUDY_DOCUMENT: 20 * 1024 * 1024, // 20MB
  
  // Capa de grupos de estudo
  GROUP_COVER: 3 * 1024 * 1024, // 3MB
  
  // Limite genérico (fallback)
  GENERIC: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Limites de dimensões para imagens (em pixels)
 */
export const IMAGE_DIMENSION_LIMITS = {
  AVATAR: {
    maxWidth: 2000,
    maxHeight: 2000,
    recommendedWidth: 400,
    recommendedHeight: 400,
  },
  POST_IMAGE: {
    maxWidth: 4000,
    maxHeight: 4000,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
  },
  WATERMARK: {
    maxWidth: 1000,
    maxHeight: 1000,
    recommendedWidth: 500,
    recommendedHeight: 500,
  },
  GROUP_COVER: {
    maxWidth: 3000,
    maxHeight: 2000,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
  },
} as const;

/**
 * Tipos MIME permitidos por categoria
 */
export const ALLOWED_FILE_TYPES = {
  IMAGES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  PDF: [
    'application/pdf',
  ],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;

/**
 * Função auxiliar para formatar tamanho de arquivo
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/**
 * Função auxiliar para obter limite por tipo de upload
 */
export const getUploadLimit = (type: keyof typeof FILE_UPLOAD_LIMITS): number => {
  return FILE_UPLOAD_LIMITS[type] || FILE_UPLOAD_LIMITS.GENERIC;
};

/**
 * Função auxiliar para obter dimensões máximas por tipo de imagem
 */
export const getImageDimensions = (type: keyof typeof IMAGE_DIMENSION_LIMITS) => {
  return IMAGE_DIMENSION_LIMITS[type];
};


