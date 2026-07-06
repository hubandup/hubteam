import { useState } from 'react';
import { getLogoFallback } from './targetUtils';

interface LogoAvatarProps {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function LogoAvatar({ url, name, size = 40, className = '' }: LogoAvatarProps) {
  const [error, setError] = useState(false);
  const fallback = getLogoFallback(name);
  const showImage = url && !error;

  return (
    <span
      className={`rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? '#F4F4F3' : fallback.bg,
        color: fallback.text,
        fontSize: Math.max(10, Math.round(size * 0.3)),
      }}
    >
      {showImage ? (
        <img
          src={url}
          alt={`${name} logo`}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        fallback.initials
      )}
    </span>
  );
}
