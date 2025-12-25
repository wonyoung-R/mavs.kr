'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Upload, TrendingUp, FileCode, Eye, X } from 'lucide-react';
import Link from 'next/link';
import { createAnalysis } from '@/app/actions/analysis';
import DynamicJSXRenderer from './DynamicJSXRenderer';

export default function AnalysisEditor() {
  const [title, setTitle] = useState('');
  const [jsxCode, setJsxCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.jsx') && !file.name.endsWith('.js')) {
      alert('.jsx 또는 .js 파일만 업로드 가능합니다.');
      return;
    }

    try {
      const text = await file.text();
      setJsxCode(text);
      setFileName(file.name);

      // Auto-generate title from filename if not set
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.(jsx?|js)$/, '');
        setTitle(nameWithoutExt);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jsxCode) {
      alert('JSX 파일을 업로드해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('jsxCode', jsxCode);

      await createAnalysis(formData);
    } catch (error) {
      console.error('Error creating analysis:', error);
      alert('분석글 작성 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  const clearFile = () => {
    setJsxCode('');
    setFileName('');
    setIsPreview(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/analysis">
            <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
              <ArrowLeft className="w-4 h-4" /> 취소
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-400" />
            새 분석 작성
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="분석글 제목을 입력하세요"
            required
            className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            JSX 파일 업로드
          </label>

          {!jsxCode ? (
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/20 rounded-lg cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 mb-4 text-slate-400" />
                <p className="mb-2 text-sm text-slate-400">
                  <span className="font-semibold">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
                </p>
                <p className="text-xs text-slate-500">.jsx 또는 .js 파일</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".jsx,.js"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between bg-slate-900/50 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-white font-medium">{fileName}</p>
                    <p className="text-xs text-slate-500">{jsxCode.length} characters</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsPreview(!isPreview)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    {isPreview ? '코드 보기' : '미리보기'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearFile}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Preview or Code */}
              {isPreview ? (
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-6">
                  <DynamicJSXRenderer jsxCode={jsxCode} />
                </div>
              ) : (
                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-4">
                  <pre className="text-xs text-slate-400 overflow-auto max-h-96 font-mono">
                    {jsxCode}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-sm font-bold text-blue-400 mb-2">💡 JSX 파일 작성 가이드</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• 컴포넌트 이름은 반드시 <code className="text-blue-400">const Component = () =&gt; ...</code> 형태로 작성</li>
            <li>• React 훅(useState, useEffect 등) 사용 가능</li>
            <li>• Recharts 차트 라이브러리 사용 가능 (LineChart, BarChart, PieChart 등)</li>
            <li>• 파일 확장자: .jsx 또는 .js</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Link href="/analysis">
            <Button type="button" variant="ghost">
              취소
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !jsxCode}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isSubmitting ? '업로드 중...' : '업로드'}
          </Button>
        </div>
      </form>
    </div>
  );
}

