import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadEmailImage } from '@/hooks/useEmailTemplates';

interface EmailImageUploaderProps {
  onImageInsert: (imageUrl: string, imageHtml: string) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_MB = 5;

export function EmailImageUploader({ onImageInsert }: EmailImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG, GIF ou WebP.');
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux. Maximum ${MAX_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);

    try {
      const imageUrl = await uploadEmailImage(file);
      const imageHtml = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; height: auto; margin: 10px 0;" />`;
      
      setPreviewUrls((prev) => [...prev, imageUrl]);
      onImageInsert(imageUrl, imageHtml);
      toast.success('Image uploadée et insérée');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePreview = (index: number) => {
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          id="email-image-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          Ajouter une image
        </Button>
        <span className="text-xs text-muted-foreground">
          JPG, PNG, GIF, WebP • Max {MAX_SIZE_MB}MB
        </span>
      </div>

      {previewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewUrls.map((url, index) => (
            <div key={url} className="relative group">
              <img
                src={url}
                alt={`Uploaded ${index + 1}`}
                className="h-16 w-16 object-cover rounded-md border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemovePreview(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
