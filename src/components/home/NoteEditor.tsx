import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  display_name: string | null;
}

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function NoteEditor({ value, onChange, placeholder = 'Écrire une note...' }: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isTyping = useRef(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (editorRef.current && !isTyping.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

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

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    updateContent();
  };

  const updateContent = () => {
    if (editorRef.current) {
      isTyping.current = true;
      onChange(editorRef.current.innerHTML);
      setTimeout(() => {
        isTyping.current = false;
      }, 0);
    }
  };

  const handleInput = () => {
    updateContent();
    checkForMention();
  };

  const checkForMention = () => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const textBeforeCursor = range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const searchText = textBeforeCursor.slice(lastAtSymbol + 1);
      
      if (searchText.length === 0 || /^[a-zA-Z0-9\s]*$/.test(searchText)) {
        setMentionSearch(searchText);
        const filtered = users.filter(user => {
          const displayName = user.display_name || `${user.first_name} ${user.last_name}`;
          return displayName.toLowerCase().includes(searchText.toLowerCase());
        });
        setFilteredUsers(filtered);
        setSelectedIndex(0);
        setShowSuggestions(filtered.length > 0);

        // Position suggestions
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        setSuggestionPosition({
          top: rect.bottom - editorRect.top + 5,
          left: rect.left - editorRect.left
        });
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (user: User) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const textBeforeCursor = range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textNode = range.startContainer;
      const searchLength = range.startOffset - lastAtSymbol;

      const deleteRange = document.createRange();
      deleteRange.setStart(textNode, lastAtSymbol);
      deleteRange.setEnd(textNode, range.startOffset);
      deleteRange.deleteContents();

      const displayName = user.display_name || `${user.first_name} ${user.last_name}`;
      const mentionHtml = `<span class="mention bg-primary/10 text-primary px-1 rounded" data-user-id="${user.id}" contenteditable="false">@${displayName}</span>&nbsp;`;
      document.execCommand('insertHTML', false, mentionHtml);

      setShowSuggestions(false);
      updateContent();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          insertMention(filteredUsers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap border-b pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          className="h-8 w-8 p-0"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyLeft')}
          className="h-8 w-8 p-0"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyCenter')}
          className="h-8 w-8 p-0"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyRight')}
          className="h-8 w-8 p-0"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-h-[200px] max-h-[400px] overflow-y-auto w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-placeholder={placeholder}
          style={{
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          }}
        />

        {showSuggestions && (
          <div
            className="absolute z-50 bg-popover border border-border rounded-md shadow-md"
            style={{
              top: suggestionPosition.top,
              left: suggestionPosition.left,
              maxHeight: '200px',
              width: '250px'
            }}
          >
            <Command>
              <CommandList>
                <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
                <CommandGroup>
                  {filteredUsers.map((user, index) => {
                    const displayName = user.display_name || `${user.first_name} ${user.last_name}`;
                    return (
                      <CommandItem
                        key={user.id}
                        onSelect={() => insertMention(user)}
                        className={selectedIndex === index ? 'bg-accent' : ''}
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.first_name[0]}{user.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span>{displayName}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
