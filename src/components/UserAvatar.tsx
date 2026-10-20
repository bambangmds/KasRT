import React, { useState } from 'react';
import { Camera, User } from 'lucide-react';
import { UserProfile } from '../types';

interface UserAvatarProps {
  user?: UserProfile | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'auto';
  shape?: 'circle' | 'rounded' | 'auto';
  className?: string;
  showEditOverlay?: boolean;
  onEditClick?: () => void;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'auto',
  shape = 'auto',
  className = '',
  showEditOverlay = false,
  onEditClick,
  title,
}) => {
  const [imageError, setImageError] = useState(false);

  // Determine size classes
  const effectiveSize = size === 'auto' ? (user?.avatarSize || 'sm') : size;
  
  let sizeClass = 'w-8 h-8 text-xs'; // default 32px
  switch (effectiveSize) {
    case 'xs':
      sizeClass = 'w-6 h-6 text-[10px]';
      break;
    case 'sm':
      sizeClass = 'w-8 h-8 text-xs';
      break;
    case 'md':
      sizeClass = 'w-9 h-9 text-xs';
      break;
    case 'lg':
      sizeClass = 'w-11 h-11 text-sm';
      break;
    case 'xl':
      sizeClass = 'w-16 h-16 text-base';
      break;
    case '2xl':
      sizeClass = 'w-24 h-24 text-xl';
      break;
  }

  // Determine shape classes
  const effectiveShape = shape === 'auto' ? (user?.avatarShape || 'circle') : shape;
  const shapeClass = effectiveShape === 'rounded' ? 'rounded-xl' : 'rounded-full';

  const initials = user?.avatarInitials || (user?.nama ? user.nama.slice(0, 2).toUpperCase() : '02');
  const hasPhoto = Boolean(user?.fotoUrl) && !imageError;
  const zoomScale = user?.avatarZoom || 1;

  return (
    <div
      onClick={onEditClick}
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none transition-all duration-200 ${sizeClass} ${shapeClass} ${
        onEditClick ? 'cursor-pointer hover:ring-2 hover:ring-orange-400/80 group' : ''
      } ${className}`}
      title={title || (onEditClick ? 'Klik untuk mengganti foto profil' : user?.nama || 'Foto Pengguna')}
    >
      {hasPhoto ? (
        <img
          src={user!.fotoUrl}
          alt={user?.nama || 'Foto Pengguna'}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          style={{ transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined }}
          className={`w-full h-full object-cover transition-transform duration-200 ${shapeClass}`}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-bold tracking-wider text-white shadow-inner bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 ${shapeClass}`}
        >
          {initials}
        </div>
      )}

      {/* Edit Camera Overlay when hovered if onEditClick is provided */}
      {showEditOverlay && onEditClick && (
        <div
          className={`absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px] ${shapeClass}`}
        >
          <Camera className="w-3.5 h-3.5 drop-shadow-sm" />
          <span className="text-[8px] font-bold mt-0.5 tracking-tight hidden sm:inline">Ganti</span>
        </div>
      )}
    </div>
  );
};
