import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  display_name: string | null;
}

interface RichMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function RichMentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder = 'Écrivez votre message...',
  disabled,
  className = '',
  onKeyDown,
}: RichMentionInputProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (editorRef.current && !isComposing.current) {
      updateEditorContent(value);
    }
  }, [value]);

  useEffect(() => {
    const mentions = extractMentions(value);
    onMentionsChange?.(mentions);
  }, [value, onMentionsChange]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, display_name')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]);
    }

    return mentions;
  };

  const updateEditorContent = (text: string) => {
    if (!editorRef.current) return;

    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    let html = text;
    
    html = html.replace(mentionRegex, (match, displayName, userId) => {
      return `<span class="mention" data-user-id="${userId}" contenteditable="false">@${displayName}</span>`;
    });

    html = html.replace(/\n/g, '<br>');
    
    if (editorRef.current.innerHTML !== html) {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      const cursorOffset = range?.startOffset || 0;
      
      editorRef.current.innerHTML = html;
      
      // Restore cursor position
      try {
        if (selection && editorRef.current.childNodes.length > 0) {
          const textNode = findTextNode(editorRef.current, cursorOffset);
          if (textNode) {
            const newRange = document.createRange();
            newRange.setStart(textNode.node, Math.min(textNode.offset, textNode.node.textContent?.length || 0));
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      } catch (e) {
        // Cursor restoration failed, ignore
      }
    }
  };

  const findTextNode = (element: Node, targetOffset: number): { node: Node; offset: number } | null => {
    let currentOffset = 0;
    
    const traverse = (node: Node): { node: Node; offset: number } | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.textContent?.length || 0;
        if (currentOffset + length >= targetOffset) {
          return { node, offset: targetOffset - currentOffset };
        }
        currentOffset += length;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          const result = traverse(node.childNodes[i]);
          if (result) return result;
        }
      }
      return null;
    };
    
    return traverse(element);
  };

  const getPlainText = (): string => {
    if (!editorRef.current) return '';
    
    let text = '';
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains('mention')) {
          const displayName = element.textContent?.substring(1) || '';
          const userId = element.getAttribute('data-user-id');
          text += `@[${displayName}](${userId})`;
        } else if (element.tagName === 'BR') {
          text += '\n';
        } else {
          for (let i = 0; i < element.childNodes.length; i++) {
            traverse(element.childNodes[i]);
          }
        }
      }
    };
    
    traverse(editorRef.current);
    return text;
  };

  const handleInput = () => {
    if (isComposing.current || !editorRef.current) return;
    
    const plainText = getPlainText();
    onChange(plainText);
    
    // Check for @ mentions
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textBeforeCursor = getTextBeforeCursor(range);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const searchTerm = textAfterAt.toLowerCase();
        setMentionSearch(searchTerm);
        
        const filtered = users.filter(user => {
          const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
          const displayName = user.display_name?.toLowerCase() || '';
          return fullName.includes(searchTerm) || displayName.includes(searchTerm);
        });
        
        setFilteredUsers(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const getTextBeforeCursor = (range: Range): string => {
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editorRef.current!);
    preRange.setEnd(range.startContainer, range.startOffset);
    
    let text = '';
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains('mention')) {
          text += element.textContent || '';
        } else if (element.tagName === 'BR') {
          text += '\n';
        } else {
          for (let i = 0; i < element.childNodes.length; i++) {
            traverse(element.childNodes[i]);
          }
        }
      }
    };
    
    traverse(preRange.cloneContents());
    return text;
  };

  const insertMention = (user: User) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textBeforeCursor = getTextBeforeCursor(range);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) return;
    
    // Remove the @ and search text
    const searchLength = textBeforeCursor.length - lastAtIndex;
    for (let i = 0; i < searchLength; i++) {
      range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
      range.deleteContents();
    }
    
    // Insert mention
    const displayName = user.display_name || `${user.first_name} ${user.last_name}`;
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold';
    mentionSpan.contentEditable = 'false';
    mentionSpan.setAttribute('data-user-id', user.id);
    mentionSpan.textContent = `@${displayName}`;
    
    range.insertNode(mentionSpan);
    
    // Add space after mention
    const space = document.createTextNode('\u00A0');
    range.insertNode(space);
    range.setStartAfter(space);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    setShowSuggestions(false);
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }
    }

    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { 
          isComposing.current = false;
          handleInput();
        }}
        className={`min-h-[80px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        data-placeholder={placeholder}
        style={{
          minHeight: '80px',
        }}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          <Command>
            <CommandList>
              {filteredUsers.length === 0 && (
                <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
              )}
              <CommandGroup>
                {filteredUsers.map((user, index) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => insertMention(user)}
                    className={`flex items-center gap-2 cursor-pointer ${
                      index === selectedIndex ? 'bg-accent' : ''
                    }`}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {user.first_name[0]}{user.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {user.display_name || `${user.first_name} ${user.last_name}`}
                      </span>
                      {user.display_name && (
                        <span className="text-xs text-muted-foreground">
                          {user.first_name} {user.last_name}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          position: absolute;
        }
        .mention {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background-color: hsl(var(--primary) / 0.1);
          color: hsl(var(--primary));
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-weight: 600;
          user-select: all;
        }
      `}</style>
    </div>
  );
}
