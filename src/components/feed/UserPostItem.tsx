import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { LinkPreview } from './LinkPreview';
import { PostComments } from './PostComments';
import { PostReactions } from './PostReactions';

interface UserPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  media_urls?: string[] | null;
  embed_url?: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}


interface UserPostItemProps {
  post: UserPost;
}

export function UserPostItem({ post }: UserPostItemProps) {
  const { user } = useAuth();
  const isOwner = user?.id === post.user_id;

  // Extract URL from content (excluding YouTube/Vimeo)
  const extractUrl = (text: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    if (!matches) return null;
    
    // Filter out YouTube and Vimeo URLs
    const nonVideoUrl = matches.find(url => {
      const lower = url.toLowerCase();
      return !lower.includes('youtube.com') && 
             !lower.includes('youtu.be') && 
             !lower.includes('vimeo.com');
    });
    
    return nonVideoUrl || null;
  };

  // Only show link preview if there's no video embed
  const linkUrl = !post.embed_url ? extractUrl(post.content) : null;

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast.success('Post supprimé');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.profiles?.avatar_url || undefined} />
          <AvatarFallback>
            {post.profiles?.first_name?.[0]}
            {post.profiles?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {post.profiles?.first_name} {post.profiles?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="mt-3 text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>

          {/* Embed (YouTube/Vimeo) */}
          {post.embed_url && (
            <div className="mt-3 rounded-lg overflow-hidden border bg-muted">
              <AspectRatio ratio={16 / 9}>
                <iframe
                  src={(() => {
                    const raw = post.embed_url as string;
                    const toYouTubeEmbed = (id: string, start?: number) =>
                      `https://www.youtube-nocookie.com/embed/${id}${start && start > 0 ? `?start=${start}` : ''}`;
                    const parseStart = (u: URL): number => {
                      const t = u.searchParams.get('t') || u.searchParams.get('start');
                      if (!t) return 0;
                      if (/^\d+$/.test(t)) return parseInt(t, 10);
                      const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
                      if (!m) return 0;
                      const h = parseInt(m[1] || '0', 10);
                      const min = parseInt(m[2] || '0', 10);
                      const s = parseInt(m[3] || '0', 10);
                      return h * 3600 + min * 60 + s;
                    };

                    try {
                      const u = new URL(raw);
                      const hostname = u.hostname.replace('www.', '');
                      const path = u.pathname;

                      // Normalize protocol
                      u.protocol = 'https:';

                      // YouTube patterns
                      if (hostname.endsWith('youtube.com') || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
                        const start = parseStart(u);
                        if (path.startsWith('/watch')) {
                          const v = u.searchParams.get('v');
                          if (v) return toYouTubeEmbed(v, start);
                        }
                        if (path.startsWith('/shorts/')) {
                          const id = path.split('/')[2]?.split('?')[0];
                          if (id) return toYouTubeEmbed(id, start);
                        }
                        if (path.startsWith('/live/')) {
                          const id = path.split('/')[2]?.split('?')[0];
                          if (id) return toYouTubeEmbed(id, start);
                        }
                        if (path.startsWith('/embed/')) {
                          const id = path.split('/')[2]?.split('?')[0];
                          if (id) return toYouTubeEmbed(id, start);
                        }
                      }
                      if (hostname === 'youtu.be') {
                        const id = path.slice(1).split('?')[0];
                        const start = parseStart(new URL(raw));
                        if (id) return toYouTubeEmbed(id, start);
                      }

                      // Vimeo
                      if (hostname === 'vimeo.com') {
                        const match = path.match(/\/(\d+)/);
                        if (match) return `https://player.vimeo.com/video/${match[1]}`;
                      }
                    } catch (e) {
                      console.error('Error parsing embed URL:', e);
                    }
                    return raw;
                  })()}
                  title="Contenu embarqué"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </AspectRatio>
            </div>
          )}

          {/* Link Preview - Uses backend metadata fetch (no iframes) */}
          {linkUrl && <LinkPreview url={linkUrl} />}

          {/* Images/Vidéos */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div className="mt-3 space-y-3">
              {post.media_urls.map((url, idx) => {
                const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
                return (
                  <div key={idx} className="rounded-md overflow-hidden border">
                    {isVideo ? (
                      <video
                        controls
                        preload="metadata"
                        className="w-full h-auto"
                      >
                        <source src={url} />
                        Votre navigateur ne supporte pas la vidéo.
                      </video>
                    ) : (
                      <img
                        src={url}
                        loading="lazy"
                        alt={`Média de ${post.profiles?.first_name ?? ''} ${post.profiles?.last_name ?? ''}`.trim() || 'Média du post'}
                        className="w-full h-auto object-contain max-h-[600px]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reactions section */}
          <PostReactions postId={post.id} />

          {/* Comments section */}
          <PostComments postId={post.id} />
        </div>
      </div>
    </Card>
  );
}
