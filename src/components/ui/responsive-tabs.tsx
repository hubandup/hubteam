import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  badge?: number | string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
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
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || defaultValue;
  const [currentValue, setCurrentValue] = useState(initialTab);

  useEffect(() => {
    const checkWidth = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [breakpoint]);

  // Sync tab changes to URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') !== currentValue) {
      params.set('tab', currentValue);
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [currentValue, location.search, navigate]);

  // Update current tab if URL changes externally
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get('tab');
    if (urlTab && urlTab !== currentValue) {
      setCurrentValue(urlTab);
    }
  }, [location.search]);

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
                {currentTab?.badge !== undefined && currentTab.badge !== 0 && (
                  <Badge 
                    variant={currentTab.badgeVariant || 'default'} 
                    className="ml-auto"
                  >
                    {currentTab.badge}
                  </Badge>
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <div className="flex items-center gap-2 w-full">
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge !== 0 && (
                    <Badge 
                      variant={tab.badgeVariant || 'default'} 
                      className="ml-auto"
                    >
                      {tab.badge}
                    </Badge>
                  )}
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
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-colors relative",
                currentValue === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 && (
                <Badge 
                  variant={tab.badgeVariant || 'default'} 
                  className={cn(
                    "ml-2",
                    currentValue === tab.value && "bg-primary-foreground text-primary"
                  )}
                >
                  {tab.badge}
                </Badge>
              )}
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
