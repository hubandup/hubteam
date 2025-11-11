import { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface ResponsiveTabsProps {
  defaultValue: string;
  tabs: TabItem[];
  className?: string;
  breakpoint?: number; // Width in pixels to switch to mobile view
}

export function ResponsiveTabs({ 
  defaultValue, 
  tabs,
  className,
  breakpoint = 768
}: ResponsiveTabsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentValue, setCurrentValue] = useState(defaultValue);

  useEffect(() => {
    const checkWidth = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [breakpoint]);

  const currentTab = tabs.find(tab => tab.value === currentValue);

  return (
    <Tabs 
      value={currentValue}
      onValueChange={setCurrentValue}
      className={className}
    >
      {isMobile ? (
        <Select value={currentValue} onValueChange={setCurrentValue}>
          <SelectTrigger className="w-full mb-4 bg-background">
            <SelectValue>
              <div className="flex items-center gap-2">
                {currentTab?.icon}
                <span>{currentTab?.label}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <div className="flex items-center gap-2">
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCurrentValue(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                currentValue === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}
      
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

ResponsiveTabs.displayName = 'ResponsiveTabs';
