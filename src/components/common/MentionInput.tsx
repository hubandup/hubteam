import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  display_name: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  disabled,
  rows = 3,
  className,
  onKeyDown,
}: MentionInputProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Extract mentions from the current value
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
      mentions.push(match[2]); // Extract user ID
    }

    return mentions;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(position);

    // Check if user is typing @ and find the search term
    const textBeforeCursor = newValue.slice(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if there's a space after @ (which would close suggestions)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const searchTerm = textAfterAt.toLowerCase();
        setMentionSearch(searchTerm);
        
        const filtered = users.filter(user => {
          const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
          const displayName = user.display_name?.toLowerCase() || '';
          return fullName.includes(searchTerm) || displayName.includes(searchTerm);
        });
        
        setFilteredUsers(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (user: User) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const displayName = user.display_name || `${user.first_name} ${user.last_name}`;
      const mention = `@[${displayName}](${user.id})`;
      
      const newValue = 
        textBeforeCursor.slice(0, lastAtIndex) +
        mention +
        ' ' +
        textAfterCursor;

      onChange(newValue);
      setShowSuggestions(false);

      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = lastAtIndex + mention.length + 1;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }

    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={className}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
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
    </div>
  );
}