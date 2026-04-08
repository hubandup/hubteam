import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Info } from 'lucide-react';

// Cache glossary at module level
let glossaryCache: Record<string, { definition: string; source: string | null }> | null = null;

export function useGlossary() {
  return useQuery({
    queryKey: ['lagostina-glossary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_glossary')
        .select('kpi_name, definition, source');
      if (error) throw error;
      const map: Record<string, { definition: string; source: string | null }> = {};
      for (const item of data || []) {
        map[item.kpi_name.toLowerCase()] = { definition: item.definition, source: item.source };
      }
      glossaryCache = map;
      return map;
    },
    staleTime: 1000 * 60 * 10,
  });
}

interface KPILabelProps {
  kpi: string;
  className?: string;
}

export function KPILabel({ kpi, className = '' }: KPILabelProps) {
  const { data: glossary } = useGlossary();
  const [showTooltip, setShowTooltip] = useState(false);

  const entry = glossary?.[kpi.toLowerCase()] || glossaryCache?.[kpi.toLowerCase()];

  if (!entry) {
    return <span className={className}>{kpi}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {kpi}
      <span
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="h-3 w-3 text-muted-foreground hover:text-black font-semibold cursor-help transition-colors" />
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-border/30 border border-black p-3 text-xs font-['Roboto']">
            <p className="text-foreground mb-1">{entry.definition}</p>
            {entry.source && <p className="text-muted-foreground text-[10px]">Source : {entry.source}</p>}
          </div>
        )}
      </span>
    </span>
  );
}
