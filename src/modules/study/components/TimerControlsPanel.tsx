import React from 'react';
import { Minus, Pause, Play, Plus, Square } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function getRingMetrics(focusMode: boolean) {
  const size = focusMode ? 248 : 168;
  const stroke = focusMode ? 8 : 7;
  const radius = (size - stroke) / 2;
  return {
    size,
    stroke,
    radius,
    circumference: 2 * Math.PI * radius,
  };
}

export interface TimerControlsPanelProps {
  minutes: number;
  seconds: number;
  initialMinutes: number;
  isRunning: boolean;
  isPaused: boolean;
  progressPercent: number;
  focusMode?: boolean;
  activeTask?: {
    disciplineName: string;
    blockName?: string;
  } | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onAddTime: () => void;
  onRemoveTime: () => void;
  canRemoveTime: boolean;
  canAddTime: boolean;
}

function formatClockValue(minutes: number, seconds: number): string {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getStatusLabel(isRunning: boolean, isPaused: boolean): string {
  if (!isRunning) return 'Pronto';
  if (isPaused) return 'Pausado';
  return 'Focado';
}

export function TimerControlsPanel({
  minutes,
  seconds,
  initialMinutes,
  isRunning,
  isPaused,
  progressPercent,
  focusMode = false,
  activeTask = null,
  onStart,
  onPause,
  onResume,
  onStop,
  onAddTime,
  onRemoveTime,
  canRemoveTime,
  canAddTime,
}: TimerControlsPanelProps) {
  const ring = getRingMetrics(focusMode);
  const ringProgress = isRunning ? Math.min(100, Math.max(0, progressPercent)) : 100;
  const ringOffset = ring.circumference * (1 - ringProgress / 100);
  const statusLabel = getStatusLabel(isRunning, isPaused);
  const displayTime = isRunning ? formatClockValue(minutes, seconds) : formatClockValue(initialMinutes, 0);
  const showRingGlow = isRunning && !isPaused;

  return (
    <Card
      className={cn(
        'w-full',
        focusMode || isRunning ? 'overflow-visible' : 'overflow-hidden',
        focusMode
          ? 'border-0 bg-transparent shadow-none'
          : 'mb-6 border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.07] shadow-sm'
      )}
    >
      <CardContent
        className={cn(
          'flex flex-col items-center',
          focusMode ? 'px-4 pt-0 pb-12' : 'px-6 pt-6 pb-12'
        )}
      >
        <div className={cn('flex w-full flex-col items-center', focusMode ? 'gap-8' : 'gap-5')}>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
              !isRunning && 'bg-muted text-muted-foreground',
              isRunning && !isPaused && 'bg-primary/15 text-primary',
              isPaused && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            )}
          >
            {statusLabel}
          </span>

          {focusMode && isRunning && activeTask && (
            <div className="max-w-sm text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="truncate text-lg font-semibold text-foreground sm:text-xl">
                  {activeTask.disciplineName}
                </p>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Agora
                </span>
              </div>
              {activeTask.blockName && (
                <p className="mt-1 truncate text-sm text-muted-foreground">{activeTask.blockName}</p>
              )}
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <svg
              width={ring.size}
              height={ring.size}
              className={cn(
                '-rotate-90 transition-opacity duration-300',
                showRingGlow && 'drop-shadow-[0_0_16px_hsl(var(--primary)/0.4)]'
              )}
              aria-hidden
            >
              <circle
                cx={ring.size / 2}
                cy={ring.size / 2}
                r={ring.radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={ring.stroke}
                className="text-primary/20 dark:text-primary/30"
              />
              <circle
                cx={ring.size / 2}
                cy={ring.size / 2}
                r={ring.radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={ring.stroke}
                strokeLinecap="round"
                strokeDasharray={ring.circumference}
                strokeDashoffset={ringOffset}
                className={cn(
                  'transition-[stroke-dashoffset] duration-1000 ease-linear',
                  isRunning && !isPaused && 'text-primary',
                  isRunning && isPaused && 'text-primary/75',
                  !isRunning && 'text-primary/50'
                )}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  'font-mono font-semibold leading-none tracking-tight tabular-nums text-foreground',
                  focusMode ? 'text-6xl sm:text-7xl' : 'text-[2.75rem] sm:text-5xl'
                )}
              >
                {displayTime}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {isRunning ? 'restante' : 'meta'}
              </span>
            </div>
          </div>

          {!isRunning && (
            <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-primary/10"
                onClick={onRemoveTime}
                disabled={!canRemoveTime}
                aria-label="Diminuir tempo"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[5.5rem] text-center font-mono text-sm font-semibold tabular-nums text-foreground">
                {initialMinutes} min
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-primary/10"
                onClick={onAddTime}
                disabled={!canAddTime}
                aria-label="Aumentar tempo"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className={cn('flex items-center justify-center', focusMode ? 'gap-4' : 'gap-3')}>
            {!isRunning ? (
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-full px-8 shadow-md shadow-primary/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={onStart}
              >
                <Play className="mr-1 h-5 w-5 fill-current" />
                Iniciar
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className={cn(
                      'rounded-full border border-border/60 bg-background shadow-sm',
                      focusMode ? 'h-14 w-14' : 'h-11 w-11'
                    )}
                    onClick={onPause}
                    aria-label="Pausar"
                  >
                    <Pause className={focusMode ? 'h-6 w-6' : 'h-5 w-5'} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    className={cn(
                      'rounded-full shadow-md shadow-primary/20',
                      focusMode ? 'h-14 w-14' : 'h-11 w-11'
                    )}
                    onClick={onResume}
                    aria-label="Continuar"
                  >
                    <Play className={cn('fill-current', focusMode ? 'h-6 w-6' : 'h-5 w-5')} />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className={cn(
                    'rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive',
                    focusMode ? 'h-14 w-14' : 'h-11 w-11'
                  )}
                  onClick={onStop}
                  aria-label="Parar"
                >
                  <Square className={cn('fill-current', focusMode ? 'h-5 w-5' : 'h-4 w-4')} />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
