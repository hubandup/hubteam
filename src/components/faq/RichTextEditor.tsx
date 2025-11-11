import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    updateContent();
  };

  const updateContent = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted p-2 border-b flex gap-1 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('bold')}
          title="Gras"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('italic')}
          title="Italique"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('underline')}
          title="Souligné"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<h2>')}
          title="Titre"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertUnorderedList')}
          title="Liste à puces"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertOrderedList')}
          title="Liste numérotée"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={updateContent}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value }}
        className="min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none"
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
}
