'use client';

import { Instagram } from 'lucide-react';

export function InstagramFloatingButton() {
  return (
    <a
      href="https://instagram.com/mavs.kr"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center space-x-2
        bg-gradient-to-r from-purple-600 to-pink-600
        text-white px-4 py-3 rounded-full shadow-lg
        hover:scale-110 transition-transform duration-300
        hover:shadow-xl"
    >
      <Instagram className="w-5 h-5" />
      <span className="hidden md:inline font-medium">@mavs.kr instagram 이동</span>
    </a>
  );
}
