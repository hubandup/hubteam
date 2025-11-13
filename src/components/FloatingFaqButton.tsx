import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export function FloatingFaqButton() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <Button
      onClick={() => navigate('/faq')}
      size="icon"
      className="fixed bottom-24 right-6 md:bottom-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40"
      aria-label="Ouvrir la FAQ"
    >
      <HelpCircle className="h-6 w-6" />
    </Button>
  );
}
