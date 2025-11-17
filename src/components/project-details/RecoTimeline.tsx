import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecoTimelineProps {
  projectId: string;
  dates: {
    date_brief: string | null;
    date_prise_en_main: string | null;
    date_concertation_agences: string | null;
    date_montage_reco: string | null;
    date_restitution: string | null;
  };
  canEdit: boolean;
  onDatesUpdate: () => void;
}

interface Step {
  id: string;
  label: string;
  dateField: keyof RecoTimelineProps['dates'];
}

const STEPS: Step[] = [
  { id: 'brief', label: 'Brief', dateField: 'date_brief' },
  { id: 'prise_en_main', label: 'Prise en main', dateField: 'date_prise_en_main' },
  { id: 'concertation', label: 'Concertation des agences', dateField: 'date_concertation_agences' },
  { id: 'montage', label: 'Montage de la reco', dateField: 'date_montage_reco' },
  { id: 'restitution', label: 'Restitution', dateField: 'date_restitution' },
];

export function RecoTimeline({ projectId, dates, canEdit, onDatesUpdate }: RecoTimelineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    const stepDate = dates[STEPS[stepIndex].dateField];
    if (!stepDate) return 'upcoming';

    const now = new Date();
    const date = new Date(stepDate);

    if (date < now) {
      // Check if this is the last completed step
      const nextSteps = STEPS.slice(stepIndex + 1);
      const hasNextCompletedStep = nextSteps.some(
        (s) => dates[s.dateField] && new Date(dates[s.dateField]!) < now
      );
      return hasNextCompletedStep ? 'completed' : 'current';
    }

    return 'upcoming';
  };

  const getProgressPercentage = (): number => {
    const firstDate = dates.date_brief ? new Date(dates.date_brief) : null;
    const lastDate = dates.date_restitution ? new Date(dates.date_restitution) : null;

    if (!firstDate || !lastDate) return 0;

    const now = new Date();
    const totalDuration = lastDate.getTime() - firstDate.getTime();
    const elapsed = now.getTime() - firstDate.getTime();

    return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
  };

  const handleDateUpdate = async (stepField: keyof RecoTimelineProps['dates'], date: Date | undefined) => {
    if (!date) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ [stepField]: date.toISOString() })
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Date mise à jour');
      setEditingStep(null);
      onDatesUpdate();
    } catch (error) {
      console.error('Error updating date:', error);
      toast.error('Erreur lors de la mise à jour de la date');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Progression de la recommandation</CardTitle>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Terminer' : 'Modifier les dates'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timeline Steps */}
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              const stepDate = dates[step.dateField];

              return (
                <div key={step.id} className="flex flex-col items-center flex-1 relative">
                  {/* Step Circle */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10',
                      status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                      status === 'current' && 'bg-background border-primary text-primary animate-pulse',
                      status === 'upcoming' && 'bg-muted border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    {status === 'completed' ? (
                      <Check className="h-5 w-5" />
                    ) : status === 'current' ? (
                      <Clock className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* Connecting Line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'absolute top-5 left-1/2 h-0.5 transition-all',
                        'w-full',
                        status === 'completed' ? 'bg-primary' : 'bg-muted'
                      )}
                      style={{ transform: 'translateY(-50%)' }}
                    />
                  )}

                  {/* Step Label */}
                  <div className="mt-3 text-center">
                    <p className={cn(
                      'text-xs font-medium mb-1',
                      status === 'completed' && 'text-primary',
                      status === 'current' && 'text-primary font-semibold',
                      status === 'upcoming' && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </p>

                    {/* Date Display/Edit */}
                    {isEditing && canEdit ? (
                      <Popover
                        open={editingStep === step.id}
                        onOpenChange={(open) => setEditingStep(open ? step.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span className="text-xs">
                              {stepDate
                                ? format(new Date(stepDate), 'dd/MM/yy', { locale: fr })
                                : 'Définir'}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <CalendarComponent
                            mode="single"
                            selected={stepDate ? new Date(stepDate) : undefined}
                            onSelect={(date) => handleDateUpdate(step.dateField, date)}
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      stepDate && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(stepDate), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
