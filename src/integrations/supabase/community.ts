import { supabase } from './client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Function to generate specific users for the community
export const generateSpecificUsers = async () => {
  try {
    // Check if these specific users already exist
    const { data: existingUsers, error: checkError } = await supabase
      .from('users_profiles')
      .select('id')
      .ilike('name', 'Camila Oliveira')
      .limit(1);
      
    if (checkError) throw checkError;
    
    if (existingUsers && existingUsers.length > 0) {
      devLog.log('Specific users already exist. Skipping generation.');
      return { success: true, message: 'Specific users already exist' };
    }

    // List of specific users to create
    const users = [
      { name: 'Camila Oliveira', bio: 'Advogada, estudando para concursos da área jurídica há 3 anos.', concursos_aprovados: 'TRT,TJ-SP' },
      { name: 'João Pereira', bio: 'Formado em Administração, focado em concursos da área fiscal.', concursos_aprovados: 'Receita Federal' },
      { name: 'Mariana Costa', bio: 'Engenheira, buscando aprovação em concursos de tribunais.', concursos_aprovados: 'TCU' },
      { name: 'Ana Silva', bio: 'Professora de Português, estudando para o Banco do Brasil.', concursos_aprovados: 'Banco do Brasil,Caixa' },
      { name: 'Rafael Souza', bio: 'Contador, especializado em contabilidade pública.', concursos_aprovados: 'INSS,TCE' },
      { name: 'Lucas Santos', bio: 'Programador, interessado em concursos da área de tecnologia.', concursos_aprovados: null },
      { name: 'Zé Mané', bio: 'Estudante de Direito, primeira tentativa em concursos.', concursos_aprovados: null },
      { name: 'Maria Clara', bio: 'Psicóloga, buscando concursos na área de saúde.', concursos_aprovados: 'SES-SP' },
      { name: 'Ravabete Zefa', bio: 'Economista, especialista em finanças públicas.', concursos_aprovados: 'Tesouro Nacional' },
      { name: 'Cucurim Jare', bio: 'Estudante de concursos há 5 anos, focado em carreiras policiais.', concursos_aprovados: 'Polícia Federal' }
    ];
    
    // Create the users with specific details
    const testUsers = users.map(user => ({
      id: crypto.randomUUID(),
      name: user.name,
      email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
      bio: user.bio,
      concursos_aprovados: user.concursos_aprovados
    }));
    
    // Insert users into the database
    const { error: insertError } = await supabase
      .from('users_profiles')
      .insert(testUsers);
      
    if (insertError) throw insertError;
    
    // Create follower relationships - everyone follows everyone else
    const followerRelationships = [];
    
    // Create a relationship for each user to follow every other user
    testUsers.forEach(follower => {
      testUsers.forEach(followed => {
        // Don't follow yourself
        if (follower.id !== followed.id) {
          followerRelationships.push({
            follower_id: follower.id,
            followed_id: followed.id
          });
        }
      });
    });
    
    // Sistema de seguidores removido - não inserir mais relacionamentos
    
    // Create random ranking entries for each user in various concursos
    const { data: concursos, error: concursosError } = await supabase
      .from('concursos')
      .select('id')
      .limit(5);
      
    if (concursosError) throw concursosError;
    
    if (concursos && concursos.length > 0) {
      const rankings = [];
      
      testUsers.forEach(user => {
        // Each user participates in 1-3 random concursos
        const participationCount = Math.floor(Math.random() * 3) + 1;
        const selectedConcursos = [...concursos]
          .sort(() => 0.5 - Math.random())
          .slice(0, participationCount);
          
        selectedConcursos.forEach(concurso => {
          rankings.push({
            user_id: user.id,
            concurso_id: concurso.id,
            score: Math.floor(Math.random() * 100) // Random score between 0-100
          });
        });
      });
      
      if (rankings.length > 0) {
        const { error: rankingsError } = await supabase
          .from('user_rankings')
          .insert(rankings);
          
        if (rankingsError) throw rankingsError;
      }
    }
    
    devLog.log(`Created ${testUsers.length} specific users`);
    return { success: true, message: `Criados ${testUsers.length} usuários específicos` };
    
  } catch (error) {
    devLog.error('Error generating specific users: Database operation failed');
    return { success: false, message: 'Erro ao gerar usuários específicos' };
  }
};

// Function to generate test users for the community
export const generateTestUsers = async (count: number = 30) => {
  try {
    // Check if test users already exist
    const { data: existingUsers, error: checkError } = await supabase
      .from('users_profiles')
      .select('id')
      .ilike('email', 'test%@example.com')
      .limit(1);
      
    if (checkError) throw checkError;
    
    if (existingUsers && existingUsers.length > 0) {
      devLog.log('Test users already exist. Skipping generation.');
      return { success: true, message: 'Test users already exist' };
    }

    // Array of names for the test users
    const firstNames = ['Maria', 'João', 'Ana', 'Pedro', 'Luiza', 'Carlos', 'Beatriz', 'Rafael', 
                      'Juliana', 'Fernando', 'Amanda', 'Lucas', 'Mariana', 'Guilherme', 'Camila'];
    const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Ferreira', 'Pereira', 'Costa', 
                      'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Ribeiro', 'Gomes'];
    
    // Array to store all the test users
    const testUsers = [];
    
    // Generate the specified number of test users
    for (let i = 1; i <= count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const userId = crypto.randomUUID();
      
      testUsers.push({
        id: userId,
        name: `${firstName} ${lastName}`,
        email: `test${i}@example.com`,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${i}`,
        bio: `Olá! Sou ${firstName}, estou estudando para concursos públicos há ${Math.floor(Math.random() * 5) + 1} anos.`,
        concursos_aprovados: Math.random() > 0.7 ? 'INSS,Receita Federal' : (Math.random() > 0.5 ? 'INSS' : null)
      });
    }
    
    // Insert test users into the database
    const { error: insertError } = await supabase
      .from('users_profiles')
      .insert(testUsers);
      
    if (insertError) throw insertError;
    
    // Sistema de seguidores removido - não criar mais relacionamentos
    
    devLog.log(`Created ${testUsers.length} test users`);
    return { success: true, message: `Criados ${testUsers.length} usuários de teste` };
    
  } catch (error) {
    devLog.error('Error generating test users: Database operation failed');
    return { success: false, message: 'Erro ao gerar usuários de teste' };
  }
};

// Function to get demo users for the community
export const getDemoUsers = () => {
  // Array of fixed demo users
  const demoUsers = [
    {
      id: '1',
      name: 'Camila Oliveira',
      email: 'camila.oliveira@example.com',
      bio: 'Advogada, estudando para concursos da área jurídica há 3 anos.',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Camila Oliveira',
      concursos_aprovados: 'TRT,TJ-SP',
      followerCount: 45,
      postCount: 12,
      approvalCount: 2,
      status_concurseiro: 'Aprovada'
    },
    {
      id: '2',
      name: 'João Pereira',
      email: 'joao.pereira@example.com',
      bio: 'Formado em Administração, focado em concursos da área fiscal.',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=João Pereira',
      concursos_aprovados: 'Receita Federal',
      followerCount: 28,
      postCount: 8,
      approvalCount: 1,
      status_concurseiro: 'Aprovado'
    },
    {
      id: '3',
      name: 'Mariana Costa',
      email: 'mariana.costa@example.com',
      bio: 'Engenheira, buscando aprovação em concursos de tribunais.',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana Costa',
      concursos_aprovados: 'TCU',
      followerCount: 32,
      postCount: 15,
      approvalCount: 1,
      status_concurseiro: 'Aprovada'
    },
    {
      id: '4',
      name: 'Rafael Souza',
      email: 'rafael.souza@example.com',
      bio: 'Contador, especializado em contabilidade pública.',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rafael Souza',
      concursos_aprovados: 'INSS,TCE',
      followerCount: 18,
      postCount: 9,
      approvalCount: 2,
      status_concurseiro: 'Aprovado'
    },
    {
      id: '5',
      name: 'Ana Silva',
      email: 'ana.silva@example.com',
      bio: 'Professora de Português, estudando para o Banco do Brasil.',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana Silva',
      concursos_aprovados: 'Banco do Brasil,Caixa',
      followerCount: 22,
      postCount: 7,
      approvalCount: 2,
      status_concurseiro: 'Aprovada'
    }
  ];
  
  return demoUsers;
};
