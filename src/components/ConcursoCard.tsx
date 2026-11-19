
import React from 'react';
import { Calendar, User, Building, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ConcursoCardProps {
  id: string;
  titulo: string;
  orgao: string;
  data: string;
  vagas: number;
  status?: string;
  path?: string;
}

const ConcursoCard: React.FC<ConcursoCardProps> = ({
  id,
  titulo,
  orgao,
  data,
  vagas,
  status = "Em andamento",
  path,
}) => {
  // If no custom path is provided, use the concurso/:id path
  const detailsPath = path || `/concurso/${id}`;
  const resultsPath = `/concurso/${id}/resultados`;
  
  return (
    <div className="concurso-card">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-muted-foreground">
          <Building className="h-4 w-4 mr-2" />
          <span className="text-sm">{orgao}</span>
        </div>
        
        <div className="flex items-center text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          <span className="text-sm">{data}</span>
        </div>
        
        <div className="flex items-center text-muted-foreground">
          <User className="h-4 w-4 mr-2" />
          <span className="text-sm bg-transparent">{vagas} vagas</span>
        </div>
      </div>
      
      <div className="flex space-x-4">
        <Link 
          to={detailsPath}
          className="flex items-center text-primary hover:text-primary/80 text-sm font-medium"
        >
          Ver detalhes
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
        
        <Link 
          to={resultsPath}
          className="flex items-center text-primary hover:text-primary/80 text-sm font-medium"
        >
          Resultados
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
};

export default ConcursoCard;
