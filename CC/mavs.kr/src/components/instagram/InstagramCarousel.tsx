'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstagramPost } from '@/types/instagram';
import { ExternalLink } from 'lucide-react';

export function InstagramCarousel() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInstagramPosts();
  }, []);

  useEffect(() => {
    if (posts.length > 0 && !isHovered) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % posts.length);
      }, 3000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [posts.length, isHovered]);

  const fetchInstagramPosts = async () => {
    try {
      const response = await fetch('/api/instagram');
      const data = await response.json();

      if (data.success && data.posts.length > 0) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to fetch Instagram posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6">
        <div className="flex space-x-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0">
              <div className="w-48 h-48 bg-slate-700/50 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6">
        <div className="text-center text-slate-400">
          Instagram 게시물을 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        <div className="flex transition-transform duration-500 ease-in-out"
             style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {posts.map((post, index) => (
            <div key={post.id} className="flex-shrink-0 w-full">
              <div className="flex justify-center">
                <div className="relative group">
                  <div className="w-48 h-48 bg-slate-700/50 rounded-lg shadow-lg overflow-hidden">
                    <img
                      src={post.imageUrl}
                      alt={`Instagram post ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onLoad={() => console.log('Image loaded successfully:', post.imageUrl)}
                      onError={(e) => {
                        console.log('Image load error:', post.imageUrl);
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yMDAgMTAwQzE1MC4yOTMgMTAwIDExMCAxNDAuMjkzIDExMCAxOTBDMTEwIDIzOS43MDcgMTUwLjI5MyAyODAgMjAwIDI4MEMyNDkuNzA3IDI4MCAyOTAgMjM5LjcwNyAyOTAgMTkwQzI5MCAxNDAuMjkzIDI0OS43MDcgMTAwIDIwMCAxMDBaIiBmaWxsPSIjNjM2NkY3Ii8+CjxwYXRoIGQ9Ik0xNzAgMTUwSDIzMFYyMzBIMTcwVjE1MFoiIGZpbGw9IiM2MzY2RjciLz4KPC9zdmc+';
                      }}
                    />
                  </div>
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-300 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <ExternalLink className="w-6 h-6 text-white" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 인디케이터 */}
        <div className="flex justify-center mt-4 space-x-2">
          {posts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                index === currentIndex ? 'bg-blue-400' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
