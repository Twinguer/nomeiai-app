import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Timer } from 'lucide-react';
import { useSecureStudyCycleUrls } from '../hooks/useSecureStudyCycleUrls';

const cardShadow =
  '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)';

interface CronogramaTimerLinkCardProps {
  selectedCycleId?: string;
  ownerUserId?: string;
}

export function CronogramaTimerLinkCard({
  selectedCycleId,
  ownerUserId,
}: CronogramaTimerLinkCardProps) {
  const navigate = useNavigate();
  const { token } = useParams();
  const { generateTimerUrl } = useSecureStudyCycleUrls();
  const [opening, setOpening] = useState(false);

  const handleOpenTimer = async () => {
    setOpening(true);
    try {
      if (selectedCycleId && ownerUserId) {
        const timerUrl = await generateTimerUrl(selectedCycleId, ownerUserId);
        navigate(timerUrl);
        return;
      }

      if (token) {
        navigate(`/estudos/timer/${token}`);
        return;
      }

      navigate('/estudos/timer');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card
      className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden"
      style={{ boxShadow: cardShadow }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Timer de Estudo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Use o timer para manter o foco. Ao terminar, registre tempo e questões no modal da tarefa.
          </p>
          <Button className="w-full" onClick={handleOpenTimer} disabled={opening}>
            {opening ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Abrindo...
              </>
            ) : (
              'Abrir timer'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
