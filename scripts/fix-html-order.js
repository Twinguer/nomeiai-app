import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve('dist', 'index.html');

console.log('🔍 [fix-html-order] Iniciando correção da ordem de carregamento...');
console.log('📁 [fix-html-order] Caminho do HTML:', htmlPath);

try {
  let html = readFileSync(htmlPath, 'utf-8');
  console.log('✅ [fix-html-order] HTML lido com sucesso, tamanho:', html.length, 'bytes');
  
  // Encontrar o react-vendor, vendor e o script principal
  // Procurar em modulepreload primeiro (pode ter atributos em qualquer ordem)
  const reactVendorPreload = html.match(/<link[^>]*href=["']([^"']*\/react-vendor-[^"']+)["'][^>]*>/);
  const reactVendorScript = html.match(/<script[^>]*src=["']([^"']*\/react-vendor-[^"']+)["'][^>]*>/);
  const reactVendorMatch = reactVendorPreload || reactVendorScript;
  
  console.log('🔍 [fix-html-order] reactVendorPreload:', reactVendorPreload ? reactVendorPreload[1] : 'não encontrado');
  console.log('🔍 [fix-html-order] reactVendorScript:', reactVendorScript ? reactVendorScript[1] : 'não encontrado');
  console.log('🔍 [fix-html-order] reactVendorMatch:', reactVendorMatch ? reactVendorMatch[1] : 'não encontrado');
  
  // Procurar vendor que NÃO seja react-vendor (usar lookahead negativo)
  const vendorPreload = html.match(/<link[^>]*href=["']([^"']*\/vendor-[^"']+)(?!.*react-vendor)["'][^>]*>/);
  const vendorScript = html.match(/<script[^>]*src=["']([^"']*\/vendor-[^"']+)(?!.*react-vendor)["'][^>]*>/);
  const vendorMatch = vendorPreload || vendorScript;
  const scriptTag = html.match(/<script[^>]*src=["']([^"']*\/index-[^"']+)["'][^>]*>/);
  
  console.log('🔍 [fix-html-order] vendorMatch:', vendorMatch ? vendorMatch[1] : 'não encontrado');
  console.log('🔍 [fix-html-order] scriptTag:', scriptTag ? scriptTag[0] : 'não encontrado');
  
  if (reactVendorMatch && scriptTag) {
    const reactVendorPath = reactVendorMatch[1];
    console.log('✅ [fix-html-order] Todos os elementos encontrados, processando...');
    console.log('📝 [fix-html-order] react-vendor path:', reactVendorPath);
    
    // Remover todos os modulepreloads
    const modulepreloadCount = (html.match(/<link[^>]*rel=["']modulepreload["'][^>]*>/g) || []).length;
    console.log('🗑️ [fix-html-order] Removendo', modulepreloadCount, 'modulepreloads');
    html = html.replace(/<link[^>]*rel=["']modulepreload["'][^>]*>/g, '');
    
    // Remover TODOS os scripts module existentes (incluindo duplicatas)
    // Primeiro remover todos os scripts module
    html = html.replace(/<script[^>]*type=["']module["'][^>]*>.*?<\/script>/g, '');
    html = html.replace(/<script[^>]*type=["']module["'][^>]*src=["'][^"']+["'][^>]*>/g, '');
    
    // Construir nova ordem de scripts com carregamento sequencial
    // Usar import() dinâmico para garantir que react-vendor carregue antes do vendor
    let newScripts = `<script type="module">
      // Carregar react-vendor primeiro e aguardar
      import('${reactVendorPath}').then(() => {
        // Depois carregar vendor (se existir)
        ${vendorMatch ? `return import('${vendorMatch[1]}');` : 'return Promise.resolve();'}
      }).then(() => {
        // Por último, carregar index
        import('${scriptTag[1]}');
      }).catch(err => {
        console.error('Erro ao carregar módulos:', err);
      });
    </script>`;
    
    console.log('📝 [fix-html-order] Nova ordem de scripts (sequencial):');
    console.log(newScripts.substring(0, 200) + '...');
    
    // Inserir antes do fechamento do body (substituir qualquer script restante)
    if (html.includes('</body>')) {
      html = html.replace('</body>', `    ${newScripts}\n</body>`);
    } else {
      // Fallback: adicionar no final
      html += `\n    ${newScripts}`;
    }
    
    // Escrever o HTML modificado
    writeFileSync(htmlPath, html, 'utf-8');
    console.log('✅ [fix-html-order] HTML modificado e salvo com sucesso');
    console.log('✅ [fix-html-order] react-vendor será carregado antes de vendor e index');
  } else {
    console.error('❌ [fix-html-order] ERRO: Não foi possível encontrar todos os elementos necessários');
    console.error('   reactVendorMatch:', reactVendorMatch ? 'encontrado' : 'NÃO encontrado');
    console.error('   scriptTag:', scriptTag ? 'encontrado' : 'NÃO encontrado');
    console.error('   HTML preview (primeiras 500 chars):', html.substring(0, 500));
    process.exit(1);
  }
} catch (error) {
  console.error('❌ [fix-html-order] Erro ao modificar index.html:', error);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

