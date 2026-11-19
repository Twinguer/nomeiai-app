import { PciConcursosFeed } from '@/components/concursos/PciConcursosFeed';

const ConcursosPage = () => {
  return (
    <div className="min-h-screen bg-page-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PciConcursosFeed />
      </div>
    </div>
  );
};

export default ConcursosPage;
