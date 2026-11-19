
import React, { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { formatScore } from '@/lib/utils';

const Resultado: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConcurso, setSelectedConcurso] = useState('');
  const [filtroSelecionado, setFiltroSelecionado] = useState('todos');
  
  // Exemplo de dados
  const concursos = [
    { id: "1", nome: "Analista Administrativo - Ministério da Economia" },
    { id: "2", nome: "Técnico em Informática - INSS" },
    { id: "3", nome: "Auditor Fiscal - Receita Federal" },
    { id: "4", nome: "Técnico Judiciário - Tribunal Regional Federal" }
  ];
  
  const resultados = [
    { id: "1", nome: "Ana Silva", inscricao: "123456", nota: 85.75, posicao: 12, situacao: "Aprovado", concursoId: "1" },
    { id: "2", nome: "João Pereira", inscricao: "789012", nota: 92.50, posicao: 3, situacao: "Aprovado", concursoId: "1" },
    { id: "3", nome: "Mariana Costa", inscricao: "345678", nota: 88.25, posicao: 7, situacao: "Aprovado", concursoId: "1" },
    { id: "4", nome: "Pedro Almeida", inscricao: "234567", nota: 65.25, posicao: 145, situacao: "Reprovado", concursoId: "1" },
    { id: "5", nome: "Lucas Santos", inscricao: "901234", nota: 79.00, posicao: 25, situacao: "Aprovado", concursoId: "2" },
    { id: "6", nome: "Camila Oliveira", inscricao: "567890", nota: 95.50, posicao: 1, situacao: "Aprovado", concursoId: "2" },
    { id: "7", nome: "Rafael Souza", inscricao: "234567", nota: 83.75, posicao: 15, situacao: "Aprovado", concursoId: "3" }
  ];
  
  const filteredResultados = selectedConcurso
    ? resultados.filter(r => 
        r.concursoId === selectedConcurso && 
        (r.nome.toLowerCase().includes(searchTerm.toLowerCase()) || r.inscricao.includes(searchTerm)) &&
        (filtroSelecionado === 'todos' || r.situacao.toLowerCase() === filtroSelecionado.toLowerCase())
      )
    : [];
    
  return (
    <div className="page-container">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Resultados de Concursos</h1>
      
      <div className="mb-6">
        <p className="text-gray-600">
          Consulte os resultados oficiais dos concursos públicos federais. 
          Selecione um concurso e busque por candidatos específicos.
        </p>
      </div>
      
      <div className="mb-8">
        <label htmlFor="concurso" className="block text-sm font-medium text-gray-700 mb-1">
          Selecione o Concurso
        </label>
        <select
          id="concurso"
          className="w-full border-gray-300 rounded-md shadow-sm focus:border-nomeia-500 focus:ring-nomeia-500"
          value={selectedConcurso}
          onChange={(e) => setSelectedConcurso(e.target.value)}
        >
          <option value="">-- Selecione um concurso --</option>
          {concursos.map((concurso) => (
            <option key={concurso.id} value={concurso.id}>
              {concurso.nome}
            </option>
          ))}
        </select>
      </div>
      
      {selectedConcurso && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-nomeia-500 focus:border-nomeia-500"
                placeholder="Busque por nome ou inscrição"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 sm:w-64">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-nomeia-500 focus:ring-nomeia-500"
                value={filtroSelecionado}
                onChange={(e) => setFiltroSelecionado(e.target.value)}
              >
                <option value="todos">Todos os resultados</option>
                <option value="aprovado">Aprovados</option>
                <option value="reprovado">Reprovados</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end mb-4">
            <button 
              className="flex items-center text-sm text-nomeia-600 hover:text-nomeia-800"
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar resultados (PDF)
            </button>
          </div>
          
          <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg mb-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classificação
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inscrição
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nota Final
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResultados.length > 0 ? (
                  filteredResultados.map((resultado) => (
                    <tr key={resultado.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {resultado.posicao}º
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {resultado.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {resultado.inscricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatScore(resultado.nota)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          resultado.situacao === 'Aprovado' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {resultado.situacao}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm ? "Nenhum candidato encontrado com esses critérios." : "Digite um nome ou número de inscrição para buscar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-nomeia-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">Informações sobre este concurso:</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Total de inscritos: 5.230 candidatos</li>
              <li>Data da prova: 10/03/2025</li>
              <li>Resultado homologado em: 25/04/2025</li>
              <li>Total de aprovados: 250 candidatos</li>
              <li>Vagas imediatas: 120 vagas</li>
              <li>Validade do concurso: 2 anos (prorrogável por igual período)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default Resultado;
