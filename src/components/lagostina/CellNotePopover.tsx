import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type CellNote = {
  id: string;
  levier: string;
  kpi_name: string;
  week: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  author?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
};

// Hook to fetch all cell notes (shared across all cells)
export function useCellNotes() {
  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('lagostina-cell-notes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lagostina_cell_notes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['lagostina-cell-notes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['lagostina-cell-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lagostina_cell_notes')
        .select('*');
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((n) => n.user_id))];
      const profilesMap = new Map<string, { first_name: string; last_name: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', userIds);
        profiles?.forEach((p) => profilesMap.set(p.id, p));
      }

      const map = new Map<string, CellNote>();
      (data as any[]).forEach((n) => {
        map.set(`${n.levier}|${n.kpi_name}|${n.week}`, {
          ...n,
          author: profilesMap.get(n.user_id),
        });
      });
      return map;
    },
  });
}

// Mini WYSIWYG toolbar
function MiniToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };
  return (
    <div className="flex gap-0.5 border-b border-border/30 pb-1 mb-1">
      {[
        { cmd: 'bold', label: 'B', cls: 'font-bold' },
        { cmd: 'italic', label: 'I', cls: 'italic' },
        { cmd: 'underline', label: 'U', cls: 'underline' },
      ].map((b) => (
        <button
          key={b.cmd}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec(b.cmd); }}
          className={`w-6 h-6 text-xs flex items-center justify-center hover:bg-muted/50 text-foreground ${b.cls}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// The cell wrapper that handles click, hover, and note display
export function NoteableCell({
  levier,
  kpiName,
  week,
  children,
  className = '',
  notesMap,
}: {
  levier: string;
  kpiName: string;
  week: string;
  children: React.ReactNode;
  className?: string;
  notesMap: Map<string, CellNote> | undefined;
}) {
  const key = `${levier}|${kpiName}|${week}`;
  const note = notesMap?.get(key);
  const [showEditor, setShowEditor] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const hasNote = !!note;

  const handleClick = () => {
    if (!showEditor) setShowEditor(true);
  };

  const handleMouseEnter = () => {
    if (hasNote && !showEditor) {
      tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 300);
    }
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  return (
    <td
      ref={cellRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${className} cursor-pointer relative ${hasNote ? 'ring-1 ring-inset ring-[#E8FF4C] dark:ring-[#E8FF4C]' : 'hover:ring-1 hover:ring-inset hover:ring-border/40'}`}
      style={hasNote ? { borderColor: '#E8FF4C' } : undefined}
    >
      {children}

      {/* Hover tooltip */}
      {showTooltip && note && !showEditor && (
        <NoteTooltip note={note} onEdit={() => { setShowTooltip(false); setShowEditor(true); }} />
      )}

      {/* Editor modal */}
      {showEditor && (
        <NoteEditor
          levier={levier}
          kpiName={kpiName}
          week={week}
          existingNote={note}
          onClose={() => setShowEditor(false)}
        />
      )}
    </td>
  );
}

function NoteTooltip({ note, onEdit }: { note: CellNote; onEdit: () => void }) {
  const { user } = useAuth();
  const isAuthor = user?.id === note.user_id;
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lagostina_cell_notes').delete().eq('id', note.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lagostina-cell-notes'] }),
  });

  return (
    <div
      className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-[#1a1f2e] border border-[#E8FF4C] shadow-lg p-3 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Author info */}
      {note.author && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
          <Avatar className="h-5 w-5">
            <AvatarImage src={note.author.avatar_url || undefined} />
            <AvatarFallback className="text-[9px] bg-muted">
              {note.author.first_name?.[0]}{note.author.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] font-medium text-foreground font-['Roboto']">
            {note.author.first_name} {note.author.last_name}
          </span>
        </div>
      )}
      <div
        className="text-xs text-foreground font-['Roboto'] prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
      />
      {isAuthor && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/30">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" /> Modifier
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            className="inline-flex items-center gap-1 text-[11px] text-[#ef4444] hover:text-[#dc2626] transition-colors ml-auto"
          >
            <Trash2 className="h-3 w-3" /> Supprimer
          </button>
        </div>
      )}
      {/* Arrow */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#E8FF4C]" />
    </div>
  );
}

function NoteEditor({
  levier,
  kpiName,
  week,
  existingNote,
  onClose,
}: {
  levier: string;
  kpiName: string;
  week: string;
  existingNote?: CellNote;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && existingNote) {
      editorRef.current.innerHTML = existingNote.content;
    }
    editorRef.current?.focus();
  }, [existingNote]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');
      const sanitized = DOMPurify.sanitize(content);
      if (existingNote) {
        const { error } = await supabase
          .from('lagostina_cell_notes')
          .update({ content: sanitized })
          .eq('id', existingNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lagostina_cell_notes')
          .insert({ levier, kpi_name: kpiName, week, content: sanitized, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lagostina-cell-notes'] });
      onClose();
    },
  });

  const handleSave = () => {
    const content = editorRef.current?.innerHTML?.trim();
    if (content && content !== '<br>') {
      saveMutation.mutate(content);
    }
  };

  return (
    <div
      className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white dark:bg-[#1a1f2e] border border-border/40 shadow-lg p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-['Roboto'] font-medium">
          {existingNote ? 'Modifier la note' : 'Ajouter une note'}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <MiniToolbar editorRef={editorRef} />
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[60px] max-h-[120px] overflow-y-auto text-xs text-foreground font-['Roboto'] p-2 border border-border/30 focus:outline-none focus:ring-1 focus:ring-[#E8FF4C] bg-transparent"
        suppressContentEditableWarning
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-black text-white dark:bg-[#E8FF4C] dark:text-black font-['Roboto'] font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {saveMutation.isPending ? '...' : 'Valider'}
        </button>
      </div>
      {/* Arrow */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-border/40" />
    </div>
  );
}
