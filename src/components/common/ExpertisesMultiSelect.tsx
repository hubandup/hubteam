import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useActiveExpertises } from '@/hooks/useExpertises';

interface ExpertisesMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function ExpertisesMultiSelect({
  value,
  onChange,
  placeholder = 'Sélectionner des expertises…',
}: ExpertisesMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: expertises = [], isLoading } = useActiveExpertises();

  // Group by categorie, sorted alpha
  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; nom: string }[]>();
    for (const e of expertises) {
      if (!map.has(e.categorie)) map.set(e.categorie, []);
      map.get(e.categorie)!.push({ id: e.id, nom: e.nom });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([cat, items]) => ({
        categorie: cat,
        items: items.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      }));
  }, [expertises]);

  const known = useMemo(() => new Set(expertises.map((e) => e.nom)), [expertises]);

  const toggle = (nom: string) => {
    if (value.includes(nom)) onChange(value.filter((v) => v !== nom));
    else onChange([...value, nom]);
  };

  const remove = (nom: string) => onChange(value.filter((v) => v !== nom));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate text-muted-foreground">
              {value.length > 0
                ? `${value.length} expertise${value.length > 1 ? 's' : ''} sélectionnée${value.length > 1 ? 's' : ''}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher une expertise…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>
                {isLoading ? 'Chargement…' : 'Aucune expertise trouvée.'}
              </CommandEmpty>
              {grouped.map((group) => (
                <CommandGroup key={group.categorie} heading={group.categorie}>
                  {group.items.map((item) => {
                    const selected = value.includes(item.nom);
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.nom}
                        onSelect={() => toggle(item.nom)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {item.nom}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {value.map((nom) => {
            const isLegacy = !known.has(nom);
            return (
              <Badge
                key={nom}
                variant={isLegacy ? 'outline' : 'secondary'}
                className={cn(
                  'flex items-center gap-1',
                  isLegacy && 'border-dashed text-muted-foreground'
                )}
                title={isLegacy ? 'Expertise non référencée (legacy)' : undefined}
              >
                {nom}
                <button
                  type="button"
                  onClick={() => remove(nom)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Retirer ${nom}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
