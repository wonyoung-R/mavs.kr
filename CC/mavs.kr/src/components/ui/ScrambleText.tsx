'use client';

import { useEffect, useRef, useState } from 'react';

interface ScrambleTextProps {
  text: string;
  scrambleChars?: string;
  scrambleSpeed?: number;
  iterationStep?: number;
  startDelay?: number;
  className?: string;
  onComplete?: () => void;
  nextText?: string;
  nextDelay?: number;
}

export function ScrambleText({
  text,
  scrambleChars = '!<>-_\\/[]{}—=+*^?#________',
  scrambleSpeed = 40,
  iterationStep = 2,
  startDelay = 800,
  className = '',
  onComplete,
  nextText,
  nextDelay = 2000
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState<string[]>([]);
  const [currentText, setCurrentText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 초기화
    const chars = currentText.split('').map(char => ({
      original: char,
      current: char,
      revealed: false,
      scrambleCount: 0
    }));

    setDisplayText(chars.map(c => c.current));

    // 애니메이션 시작
    timeoutRef.current = setTimeout(() => {
      startScrambleAnimation(chars);
    }, startDelay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (nextTimeoutRef.current) clearTimeout(nextTimeoutRef.current);
    };
  }, [currentText, scrambleChars, scrambleSpeed, iterationStep, startDelay]);

  // 첫 번째 텍스트 완료 후 다음 텍스트로 전환하는 타이머
  useEffect(() => {
    if (currentText === text && nextText) {
      const totalAnimationTime = startDelay + (text.length * iterationStep * scrambleSpeed) + nextDelay;
      nextTimeoutRef.current = setTimeout(() => {
        setCurrentText(nextText);
      }, totalAnimationTime);
    }
  }, [text, nextText, nextDelay, startDelay, scrambleSpeed, iterationStep, currentText]);

  const startScrambleAnimation = (chars: Array<{original: string, current: string, revealed: boolean, scrambleCount: number}>) => {
    setIsAnimating(true);
    let iteration = 0;
    const maxIterations = currentText.length * iterationStep;

    intervalRef.current = setInterval(() => {
      const newChars = [...chars];
      let allRevealed = true;

      newChars.forEach((char, index) => {
        if (!char.revealed) {
          allRevealed = false;

          // 글자가 공개될 시점 체크
          if (iteration > index * iterationStep) {
            char.revealed = true;
            char.current = char.original;
          } else {
            // 랜덤 특수문자로 스크램블
            if (char.original !== ' ') {
              char.current = scrambleChars[
                Math.floor(Math.random() * scrambleChars.length)
              ];
            }
          }
        }
      });

      setDisplayText(newChars.map(c => c.current));
      iteration++;

        // 모든 글자가 공개되면 종료
        if (iteration > maxIterations || allRevealed) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsAnimating(false);
          onComplete?.();
        }
    }, scrambleSpeed);
  };

  const handleMouseEnter = () => {
    if (!isAnimating) {
      // 애니메이션 재시작
      const chars = text.split('').map(char => ({
        original: char,
        current: char,
        revealed: false,
        scrambleCount: 0
      }));

      startScrambleAnimation(chars);
    }
  };

  return (
    <span
      className={`scramble-text ${className}`}
      onMouseEnter={handleMouseEnter}
      style={{
        fontFamily: 'inherit',
        fontSize: 'clamp(5rem, 16vw, 12rem)',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #C4CED4 50%, #00538C 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textTransform: 'uppercase',
        position: 'relative',
        display: 'inline-block',
        textShadow: '0 0 40px rgba(0, 83, 140, 0.5)',
        cursor: 'pointer',
        minHeight: 'clamp(6rem, 18vw, 14rem)',
        lineHeight: '1'
      }}
    >
      {displayText.map((char, index) => (
        <span
          key={index}
          className={`scramble-char ${
            !text.split('')[index] || text.split('')[index] === char ? '' : 'scrambling'
          }`}
          style={{
            display: char === ' ' ? 'inline' : 'inline-block',
            transition: 'all 0.3s ease',
            position: 'relative'
          }}
        >
          {char}
        </span>
      ))}

      <style jsx>{`
        .scramble-char.scrambling {
          animation: glitch 0.1s infinite;
          color: #00538C;
          -webkit-text-fill-color: #00538C;
        }

        @keyframes glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-1px, 1px); }
          40% { transform: translate(1px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
          100% { transform: translate(0); }
        }
      `}</style>
    </span>
  );
}
