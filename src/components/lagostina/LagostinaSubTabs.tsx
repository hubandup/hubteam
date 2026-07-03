import { useState } from 'react';

interface SubTab {
  id: string;
  label: string;
}

interface LagostinaSubTabsProps {
  tabs: SubTab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
  rightAction?: React.ReactNode;
  belowTabs?: React.ReactNode;
}

export function LagostinaSubTabs({ tabs, defaultTab, children, rightAction, belowTabs }: LagostinaSubTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-0 bg-card dark:bg-[hsl(var(--brand-ink))] border border-border/30 inline-flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 text-sm font-['Instrument Sans'] transition-colors ${
                activeTab === t.id
                  ? 'bg-foreground text-background dark:bg-[hsl(var(--brand-yellow))] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {rightAction}
      </div>
      {belowTabs}
      {children(activeTab)}
    </div>
  );
}
