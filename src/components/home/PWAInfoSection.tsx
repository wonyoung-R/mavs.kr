'use client';

import { motion } from 'framer-motion';
import { Smartphone, Download, Zap, Shield, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export function PWAInfoSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="w-full max-w-4xl mt-12 px-4"
    >
      <div className="bg-gradient-to-br from-[#00538C]/20 to-[#003d6b]/20 backdrop-blur-md border border-blue-400/30 rounded-2xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-400" />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
              앱으로 설치하기
            </h2>
            <p className="text-white/70 text-sm md:text-base mb-4">
              MAVS.KR을 홈 화면에 추가하여 더 빠르고 편리하게 이용하세요
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium text-sm">빠른 접근</p>
                  <p className="text-white/60 text-xs">홈 화면에서 바로 실행</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium text-sm">오프라인 지원</p>
                  <p className="text-white/60 text-xs">인터넷 없이도 이용 가능</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium text-sm">앱처럼 사용</p>
                  <p className="text-white/60 text-xs">네이티브 앱 경험</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {expanded ? '접기' : '설치 방법 보기'}
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ▼
              </motion.span>
            </button>

            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/10"
              >
                <div className="space-y-4">
                  {/* Android Chrome */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Download className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-white font-medium">Android (Chrome)</h3>
                    </div>
                    <ol className="space-y-2 text-sm text-white/80 ml-10">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">1.</span>
                        <span>Chrome 브라우저 메뉴(⋮) 클릭</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">2.</span>
                        <span>"홈 화면에 추가" 선택</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">3.</span>
                        <span>확인 버튼 클릭</span>
                      </li>
                    </ol>
                  </div>

                  {/* iOS Safari */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Download className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-white font-medium">iOS (Safari)</h3>
                    </div>
                    <ol className="space-y-2 text-sm text-white/80 ml-10">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">1.</span>
                        <span>공유 버튼(□↑) 클릭</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">2.</span>
                        <span>"홈 화면에 추가" 선택</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">3.</span>
                        <span>이름 확인 후 "추가" 클릭</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

