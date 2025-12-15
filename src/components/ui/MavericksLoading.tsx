'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface MavericksLoadingProps {
  className?: string;
  fullScreen?: boolean;
}

export default function MavericksLoading({ className, fullScreen = true }: MavericksLoadingProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center",
      fullScreen ? "min-h-screen" : "h-full w-full",
      className
    )}>
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-24 h-24 z-10"
        >
          <Image
            src="/images/logos/mavericks.svg"
            alt="Dallas Mavericks Logo"
            fill
            className="object-contain"
            priority
          />
        </motion.div>

        {/* Orbiting Dots */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.18, // 순차적으로 나타나게 하여 회전 효과처럼 보이게 함
              ease: "easeInOut"
            }}
            style={{
              // 원형으로 배치
              top: `${50 + 35 * Math.sin((i * 45 * Math.PI) / 180)}%`,
              left: `${50 + 35 * Math.cos((i * 45 * Math.PI) / 180)}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
      </div>
      
      <motion.div 
        className="mt-6 flex gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span className="text-blue-400 font-medium text-lg tracking-widest uppercase">Loading</span>
        <motion.span 
            animate={{ opacity: [0, 1, 0] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            className="text-blue-400 font-medium text-lg"
        >.</motion.span>
        <motion.span 
            animate={{ opacity: [0, 1, 0] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="text-blue-400 font-medium text-lg"
        >.</motion.span>
        <motion.span 
            animate={{ opacity: [0, 1, 0] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="text-blue-400 font-medium text-lg"
        >.</motion.span>
        <motion.span 
            animate={{ opacity: [0, 1, 0] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
            className="text-blue-400 font-medium text-lg"
        >.</motion.span>
      </motion.div>
    </div>
  );
}
