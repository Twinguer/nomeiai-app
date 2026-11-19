import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudyStatistics } from '@/types/userStudy';

interface StudyHeatmapChartProps {
  statistics: StudyStatistics;
}

interface HeatmapData {
  date: string;
  hours: number;
  sessions: number;
  intensity: 'none' | 'low' | 'medium' | 'high' | 'very-high';
  isToday: boolean;
  isFuture: boolean;
  monthIndex: number;
  monthName: string;
}

const StudyHeatmapChart: React.FC<StudyHeatmapChartProps> = ({ statistics }) => {
  // Preparar dados para o heatmap (mês anterior, atual e seguinte)
  const prepareHeatmapData = (): HeatmapData[] => {
    const data: HeatmapData[] = [];
    // Data atual real
    const today = new Date();
    
    // Mês anterior
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    // Mês atual
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    // Mês seguinte
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Obter nomes dos meses
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Obter número de dias em cada mês
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    // Criar array com todos os dias dos 3 meses
    const months = [
      { 
        start: prevMonth, 
        days: getDaysInMonth(prevMonth), 
        name: monthNames[prevMonth.getMonth()], 
        monthIndex: prevMonth.getMonth() 
      },
      { 
        start: currentMonth, 
        days: getDaysInMonth(currentMonth), 
        name: monthNames[currentMonth.getMonth()], 
        monthIndex: currentMonth.getMonth() 
      },
      { 
        start: nextMonth, 
        days: getDaysInMonth(nextMonth), 
        name: monthNames[nextMonth.getMonth()], 
        monthIndex: nextMonth.getMonth() 
      }
    ];
    
    months.forEach(month => {
      for (let i = 0; i < month.days; i++) {
        const date = new Date(month.start);
        date.setDate(month.start.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        const isToday = dateString === today.toISOString().split('T')[0];
        const isFuture = date > today;
        
        // Buscar dados do dia
        const dayStats = statistics.dailyStats[dateString] || { hours: 0, sessions: 0 };
        
        // Calcular intensidade baseada nas horas
        let intensity: 'none' | 'low' | 'medium' | 'high' | 'very-high' = 'none';
        if (dayStats.hours > 0) {
          if (dayStats.hours >= 6) intensity = 'very-high';
          else if (dayStats.hours >= 4) intensity = 'high';
          else if (dayStats.hours >= 2) intensity = 'medium';
          else intensity = 'low';
        } else if (!isFuture && !isToday) {
          // Dias passados sem estudo = vermelho
          intensity = 'none';
        }
        
        data.push({
          date: dateString,
          hours: dayStats.hours,
          sessions: dayStats.sessions,
          intensity,
          isToday,
          isFuture,
          monthIndex: month.monthIndex,
          monthName: month.name
        });
      }
    });

    return data;
  };

  const heatmapData = prepareHeatmapData();

  // Agrupar dados por mês
  const groupByMonth = (data: HeatmapData[]) => {
    const months: { [key: string]: HeatmapData[] } = {};
    
    data.forEach(day => {
      const monthKey = `${day.monthIndex}-${day.monthName}`;
      if (!months[monthKey]) {
        months[monthKey] = [];
      }
      months[monthKey].push(day);
    });
    
    return months;
  };

  const monthsData = groupByMonth(heatmapData);
  const monthKeys = Object.keys(monthsData).sort((a, b) => {
    const aIndex = parseInt(a.split('-')[0]);
    const bIndex = parseInt(b.split('-')[0]);
    return aIndex - bIndex;
  });

  // Calcular estatísticas
  const totalDays = heatmapData.length;
  const studyDays = heatmapData.filter(d => d.hours > 0).length;
  const totalHours = heatmapData.reduce((sum, d) => sum + d.hours, 0);
  const averageHours = studyDays > 0 ? totalHours / studyDays : 0;
  const currentStreak = statistics.currentStreak;
  const longestStreak = statistics.longestStreak;

  // Obter cor baseada na intensidade
  const getIntensityColor = (intensity: string, isToday: boolean, isFuture: boolean, hours: number) => {
    // Dia atual: fundo azul com borda
    if (isToday) return 'bg-primary text-primary-foreground ring-2 ring-primary';
    
    // Dias futuros: cinza mais escuro para melhor visibilidade
    if (isFuture) return 'bg-muted';
    
    // Dias passados sem estudo: vermelho
    if (!isFuture && !isToday && hours === 0) {
      return 'bg-destructive';
    }
    
    // Dias com estudo: verde (intensidade baseada nas horas)
    switch (intensity) {
      case 'very-high': return 'bg-success';
      case 'high': return 'bg-success/80';
      case 'medium': return 'bg-success/60';
      case 'low': return 'bg-success/40';
      case 'none': return 'bg-muted/50';
      default: return 'bg-muted/50';
    }
  };

  // Obter tooltip baseado na intensidade
  const getIntensityLabel = (intensity: string) => {
    switch (intensity) {
      case 'very-high': return 'Muito intenso (6h+)';
      case 'high': return 'Intenso (4-6h)';
      case 'medium': return 'Moderado (2-4h)';
      case 'low': return 'Leve (1-2h)';
      case 'none': return 'Sem estudo';
      default: return 'Sem dados';
    }
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short'
    });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{formatDate(data.date)}</p>
          <div className="space-y-1 text-sm">
            {data.hours > 0 ? (
              <>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">{formatHours(data.hours)}</span> de estudo
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">{data.sessions}</span> sessões
                </p>
                <p className="text-muted-foreground">
                  {getIntensityLabel(data.intensity)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum estudo registrado</p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (totalHours === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📅 Calendário de Estudos
          </CardTitle>
          <CardDescription>
            Acompanhe sua consistência de estudo ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📚</div>
            <p className="text-sm text-muted-foreground">
              Nenhum estudo registrado ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Comece a estudar para ver seu calendário de progresso
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📅 Calendário de Estudos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Estatísticas com altura reduzida em 10% */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center p-1.5 bg-muted/30 rounded-lg">
            <div className="text-base font-bold text-foreground">{studyDays}</div>
            <div className="text-xs text-muted-foreground">Dias</div>
          </div>
          <div className="text-center p-1.5 bg-muted/30 rounded-lg">
            <div className="text-base font-bold text-foreground">{formatHours(totalHours)}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-1.5 bg-muted/30 rounded-lg">
            <div className="text-base font-bold text-foreground">{formatHours(averageHours)}</div>
            <div className="text-xs text-muted-foreground">Média</div>
          </div>
          <div className="text-center p-1.5 bg-muted/30 rounded-lg">
            <div className="text-base font-bold text-foreground">{currentStreak}</div>
            <div className="text-xs text-muted-foreground">Seq</div>
          </div>
        </div>

        {/* Heatmap agrupado por mês */}
        <div className="space-y-4">
          {monthKeys.map(monthKey => {
            const monthDays = monthsData[monthKey];
            const monthName = monthKey.split('-')[1];
            
            return (
              <div key={monthKey} className="space-y-1.5">
                <h4 className="text-sm font-semibold text-foreground text-center mb-1">
                  {monthName} {new Date().getFullYear()}
                </h4>
                
                {/* Cabeçalho com dias da semana */}
                <div className="grid grid-cols-7 gap-0.5 text-xs text-muted-foreground text-center mb-1">
                  <div>Dom</div>
                  <div>Seg</div>
                  <div>Ter</div>
                  <div>Qua</div>
                  <div>Qui</div>
                  <div>Sex</div>
                  <div>Sáb</div>
                </div>
                
                {/* Grid do heatmap para o mês */}
                <div className="grid grid-cols-7 gap-0.5">
                  {monthDays.map((day, dayIndex) => (
                    <div
                      key={`${monthKey}-${dayIndex}`}
                      className={`
                        w-2.5 h-2.5 rounded-sm cursor-pointer transition-all duration-200 hover:scale-125
                        ${getIntensityColor(day.intensity, day.isToday, day.isFuture, day.hours)}
                      `}
                      title={`${formatDate(day.date)}: ${day.hours > 0 ? formatHours(day.hours) : 'Sem estudo'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legenda com altura reduzida em 10% */}
        <div className="flex items-center justify-between mt-2 p-1.5 bg-muted/20 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-destructive rounded-sm" title="Dias passados sem estudo"></div>
              <div className="w-2 h-2 bg-muted rounded-sm" title="Dias futuros"></div>
              <div className="w-2 h-2 bg-primary rounded-sm" title="Dia atual"></div>
              <div className="w-2 h-2 bg-success/40 rounded-sm" title="Pouco estudo"></div>
              <div className="w-2 h-2 bg-success/60 rounded-sm" title="Estudo moderado"></div>
              <div className="w-2 h-2 bg-success/80 rounded-sm" title="Muito estudo"></div>
              <div className="w-2 h-2 bg-success rounded-sm" title="Estudo intenso"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-xs px-2 py-1">
              Atual: {currentStreak}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-1">
              Melhor: {longestStreak}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudyHeatmapChart;
