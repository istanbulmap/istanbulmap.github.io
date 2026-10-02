import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const base = (size: number, className: string, children: React.ReactNode, strokeWidth = 1.75) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const IconRoute = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </>, strokeWidth);

export const IconPin = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>, strokeWidth);

export const IconStar = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </>, strokeWidth);

export const IconNote = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </>, strokeWidth);

export const IconSettings = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>, strokeWidth);

export const IconWalk = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="4" r="1.5" />
    <path d="M9 8.5l-1.5 5 3 1.5" />
    <path d="M12 8.5l1.5 3-1.5 3" />
    <path d="M10 20l1.5-4.5" />
    <path d="M14 20l-1.5-4.5" />
  </>, strokeWidth);

export const IconMetro = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <path d="M9 22v-4" />
    <path d="M15 22v-4" />
    <path d="M5 12h14" />
    <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
  </>, strokeWidth);

export const IconBus = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M8 6v6" />
    <path d="M16 6v6" />
    <path d="M2 12h19.6" />
    <path d="M18 18h3s.5-1.7.8-4.3c.3-2.7.4-5 .4-5H2s.1 2.3.4 5c.3 2.6.8 4.3.8 4.3H6" />
    <circle cx="8" cy="18" r="2" />
    <circle cx="16" cy="18" r="2" />
    <path d="M2 7h2" />
    <path d="M2 11h20" />
    <path d="M20 7h2" />
  </>, strokeWidth);

export const IconTram = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M14 4l2 4H8l2-4" />
    <rect x="6" y="8" width="12" height="10" rx="2" />
    <path d="M7 22l1.5-3" />
    <path d="M17 22l-1.5-3" />
    <path d="M6 13h12" />
    <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
    <path d="M4 8h16" />
  </>, strokeWidth);

export const IconFerry = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1" />
    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
    <path d="M12 3v4" />
    <path d="M8 7v6" />
    <path d="M16 7v6" />
  </>, strokeWidth);

export const IconFunicular = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M4 21L20 3" />
    <rect x="13" y="3" width="6" height="9" rx="1" transform="rotate(0 13 3)" />
    <rect x="5" y="12" width="6" height="9" rx="1" />
    <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="17" r="1" fill="currentColor" stroke="none" />
  </>, strokeWidth);

export const IconPlus = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>, strokeWidth);

export const IconX = ({ size = 16, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>, strokeWidth);

export const IconTrash = ({ size = 16, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </>, strokeWidth);

export const IconEdit = ({ size = 16, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </>, strokeWidth);

export const IconCheck = ({ size = 16, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <polyline points="20 6 9 17 4 12" />
  </>, strokeWidth);

export const IconDownload = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>, strokeWidth);

export const IconUpload = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>, strokeWidth);

export const IconZoomIn = ({ size = 18, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </>, strokeWidth);

export const IconZoomOut = ({ size = 18, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </>, strokeWidth);

export const IconLocate = ({ size = 18, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3" />
    <path d="M12 19v3" />
    <path d="M2 12h3" />
    <path d="M19 12h3" />
  </>, strokeWidth);

export const IconChevronDown = ({ size = 16, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <polyline points="6 9 12 15 18 9" />
  </>, strokeWidth);

export const IconChevronRight = ({ size = 16, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <polyline points="9 18 15 12 9 6" />
  </>, strokeWidth);

export const IconMapPin = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </>, strokeWidth);

export const IconSave = ({ size = 16, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </>, strokeWidth);

export const IconAlertTriangle = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>, strokeWidth);

export const IconInfo = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </>, strokeWidth);

export const IconRestaurant = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
  </>, strokeWidth);

export const IconCafe = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </>, strokeWidth);

export const IconHotel = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M3 22V12h18v10" />
    <path d="M3 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 22h18" />
    <rect x="8" y="15" width="8" height="7" />
  </>, strokeWidth);

export const IconAttraction = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <line x1="3" y1="22" x2="21" y2="22" />
    <line x1="6" y1="18" x2="6" y2="11" />
    <line x1="10" y1="18" x2="10" y2="11" />
    <line x1="14" y1="18" x2="14" y2="11" />
    <line x1="18" y1="18" x2="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </>, strokeWidth);

export const IconShopping = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </>, strokeWidth);

export const IconTransport = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>, strokeWidth);

export const IconBookmark = ({ size = 20, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </>, strokeWidth);

export const IconClock = ({ size = 16, className = '', strokeWidth = 1.75 }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>, strokeWidth);

export const IconArrowRight = ({ size = 16, className = '', strokeWidth = 2 }: IconProps) =>
  base(size, className, <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>, strokeWidth);

export const TRANSPORT_ICONS: Record<string, React.FC<IconProps>> = {
  walking:   IconWalk,
  metro:     IconMetro,
  bus:       IconBus,
  tram:      IconTram,
  ferry:     IconFerry,
  funicular: IconFunicular,
};

export const CATEGORY_ICONS: Record<string, React.FC<IconProps>> = {
  restaurant: IconRestaurant,
  cafe:       IconCafe,
  hotel:      IconHotel,
  attraction: IconAttraction,
  shopping:   IconShopping,
  transport:  IconTransport,
  other:      IconMapPin,
};
