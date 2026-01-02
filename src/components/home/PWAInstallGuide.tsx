'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, X, Apple, Chrome } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallGuide() {
  const [showModal, setShowModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 모바일 감지
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // 이미 설치되어 있는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // iOS 감지
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // beforeinstallprompt 이벤트 리스너 (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 앱이 설치되었는지 확인
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowModal(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 모바일에서 자동 접기
  useEffect(() => {
    if (isMobile && isExpanded) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, isExpanded]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowModal(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleButtonClick = () => {
    if (isMobile && !isExpanded) {
      setIsExpanded(true);
    } else {
      setShowModal(true);
    }
  };

  // 이미 설치되어 있으면 표시하지 않음
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={handleButtonClick}
        onMouseEnter={() => !isMobile && setIsExpanded(true)}
        onMouseLeave={() => !isMobile && setIsExpanded(false)}
        className="fixed bottom-36 right-4 md:bottom-44 md:right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-[#00538C] to-[#003d6b] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3">
          <Smartphone className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-semibold whitespace-nowrap overflow-hidden"
              >
                앱 설치
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#050510] border border-white/20 rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-6 h-6 text-blue-400" />
                  앱으로 설치하기
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-white/70 text-base mb-6">
                MAVS.KR을 홈 화면에 추가하여 더 빠르고 편리하게 이용하세요
              </p>

              {/* 가로 레이아웃: Android와 iOS 가이드 나란히 표시 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Android Guide */}
                <div className="bg-white/5 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Chrome className="w-6 h-6 text-green-400" />
                    <h4 className="text-white font-semibold text-lg">Android (Chrome)</h4>
                  </div>

                  {/* 자동 설치 버튼 (있는 경우) */}
                  {deferredPrompt && (
                    <div className="mb-4">
                      <button
                        onClick={handleInstallClick}
                        className="w-full py-3 px-4 bg-gradient-to-r from-[#00538C] to-[#003d6b] hover:from-[#0066b3] hover:to-[#00538C] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 mb-3"
                      >
                        <Download className="w-5 h-5" />
                        지금 설치하기
                      </button>
                      <p className="text-xs text-white/50 text-center mb-3">또는 아래 방법으로 수동 설치할 수 있습니다</p>
                      <div className="border-t border-white/10 pt-3">
                        <p className="text-xs text-white/60 mb-2 font-medium">수동 설치 방법:</p>
                      </div>
                    </div>
                  )}

                  {/* 수동 설치 가이드 */}
                  <div className="space-y-4 text-white/80">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-white">Chrome 메뉴(⋮) 클릭</p>
                        <p className="text-xs text-white/60 mt-1">화면 우측 상단의 메뉴 버튼을 탭하세요</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-white">"홈 화면에 추가" 선택</p>
                        <p className="text-xs text-white/60 mt-1">메뉴에서 "홈 화면에 추가" 옵션을 찾으세요</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-white">확인 버튼 클릭</p>
                        <p className="text-xs text-white/60 mt-1">팝업에서 "추가"를 탭하세요</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* iOS Guide */}
                <div className="bg-white/5 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Apple className="w-6 h-6 text-blue-400" />
                    <h4 className="text-white font-semibold text-lg">iOS (Safari)</h4>
                  </div>
                  <div className="space-y-4 text-white/80">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-white">Safari에서 공유 버튼 클릭</p>
                        <p className="text-xs text-white/60 mt-1">화면 하단의 공유 아이콘(□↑)을 탭하세요</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-white">"홈 화면에 추가" 선택</p>
                        <p className="text-xs text-white/60 mt-1">스크롤하여 "홈 화면에 추가" 옵션을 찾으세요</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-white">확인 버튼 클릭</p>
                        <p className="text-xs text-white/60 mt-1">이름을 확인하고 "추가"를 탭하세요</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

