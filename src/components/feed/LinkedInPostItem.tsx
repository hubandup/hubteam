import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LinkedInPost } from '@/hooks/useLinkedInPosts';

interface LinkedInPostItemProps {
  post: LinkedInPost;
}

export function LinkedInPostItem({ post }: LinkedInPostItemProps) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 280;
  const isLong = post.content.length > maxLength;
  const displayContent = expanded ? post.content : post.content.slice(0, maxLength);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm truncate">Hub & Up</span>
            <Badge variant="info" className="text-[10px] px-1.5 py-0">LinkedIn</Badge>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: fr })}
          </span>
        </div>

        <div className="text-sm whitespace-pre-line break-words">
          {displayContent}
          {isLong && !expanded && '…'}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary text-xs font-medium ml-1 hover:underline"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>

        {post.image_url && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img
              src={post.image_url}
              alt="LinkedIn post"
              className="w-full object-cover max-h-80"
              loading="lazy"
            />
          </div>
        )}

        {post.link && (
          <a
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs text-[#0A66C2] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Voir sur LinkedIn
          </a>
        )}
      </CardContent>
    </Card>
  );
}
