'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface MagneticTextProps {
  text: string;
  variant?: 'small' | 'medium' | 'large' | 'xl';
  textColor?: string;
  className?: string;
}

export function MagneticText({
  text,
  variant = 'xl',
  textColor = 'linear-gradient(135deg, #FFFFFF 0%, #C4CED4 50%, #00538C 100%)',
  className = ''
}: MagneticTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'small':
        return {
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          minHeight: 'clamp(2rem, 5vw, 4rem)',
          magneticStrength: 0.3
        };
      case 'medium':
        return {
          fontSize: 'clamp(2rem, 6vw, 4rem)',
          minHeight: 'clamp(2.5rem, 6vw, 5rem)',
          magneticStrength: 0.4
        };
      case 'large':
        return {
          fontSize: 'clamp(3rem, 8vw, 6rem)',
          minHeight: 'clamp(4rem, 10vw, 8rem)',
          magneticStrength: 0.5
        };
      case 'xl':
      default:
        return {
          fontSize: 'clamp(2.5rem, 8vw, 6rem)',
          minHeight: 'clamp(3rem, 9vw, 7rem)',
          magneticStrength: 0.6
        };
    }
  };

  const variantStyles = getVariantStyles();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const chars = charsRef.current.filter(Boolean) as HTMLSpanElement[];

    if (chars.length === 0) return;

    // GSAP quickSetter로 성능 최적화
    const xSetter = gsap.quickSetter(chars, 'x', 'px');
    const ySetter = gsap.quickSetter(chars, 'y', 'px');
    const rotationSetter = gsap.quickSetter(chars, 'rotation', 'deg');

    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseOver) return;

      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left - rect.width / 2;
      mouseY = e.clientY - rect.top - rect.height / 2;
    };

    const handleMouseEnter = () => {
      isMouseOver = true;
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      isMouseOver = false;
      setIsHovered(false);

      // 마우스가 벗어나면 원래 위치로 복귀
      gsap.to(chars, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 1.2,
        ease: 'elastic.out(1, 0.3)',
        stagger: {
          amount: 0.3,
          from: 'center'
        }
      });
    };

    const animateChars = () => {
      if (!isMouseOver) return;

      chars.forEach((char, index) => {
        const charRect = char.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const charCenterX = charRect.left + charRect.width / 2 - containerRect.left;
        const charCenterY = charRect.top + charRect.height / 2 - containerRect.top;

        const deltaX = mouseX - charCenterX;
        const deltaY = mouseY - charCenterY;

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 200; // 최대 반응 거리

        if (distance < maxDistance) {
          const strength = variantStyles.magneticStrength * (1 - distance / maxDistance);
          const angle = Math.atan2(deltaY, deltaX);

          const moveX = Math.cos(angle) * strength * 50;
          const moveY = Math.sin(angle) * strength * 50;
          const rotation = Math.sin(angle) * strength * 15;

          // Elastic 이징으로 자연스러운 움직임
          gsap.to(char, {
            x: moveX,
            y: moveY,
            rotation: rotation,
            duration: 0.6,
            ease: 'elastic.out(1, 0.5)',
            overwrite: true
          });
        } else {
          // 거리가 멀면 원래 위치로 복귀
          gsap.to(char, {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.8,
            ease: 'elastic.out(1, 0.3)',
            overwrite: true
          });
        }
      });

      requestAnimationFrame(animateChars);
    };

    // 이벤트 리스너 등록
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    // 애니메이션 시작
    animateChars();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [variantStyles.magneticStrength]);

  return (
    <div
      ref={containerRef}
      className={`magnetic-text-container ${className}`}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: variantStyles.minHeight,
        lineHeight: '1'
      }}
    >
      {text.split('').map((char, index) => (
        <span
          key={index}
          ref={(el) => {
            charsRef.current[index] = el;
          }}
          className="magnetic-char"
          style={{
            display: char === ' ' ? 'inline' : 'inline-block',
            fontSize: variantStyles.fontSize,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: textColor,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
            position: 'relative',
            textShadow: isHovered ? '0 0 40px rgba(0, 83, 140, 0.8)' : '0 0 40px rgba(0, 83, 140, 0.5)',
            transition: 'text-shadow 0.3s ease',
            transformOrigin: 'center center'
          }}
        >
          {char}
        </span>
      ))}

      <style jsx>{`
        .magnetic-text-container:hover .magnetic-char {
          filter: brightness(1.1);
        }

        .magnetic-char {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
