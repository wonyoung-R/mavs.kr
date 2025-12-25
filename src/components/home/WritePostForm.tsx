'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Send, PenLine, TrendingUp } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { createColumn } from '@/app/actions/column';

interface WritePostFormProps {
  session: any;
  onCancel: () => void;
  onSuccess: () => void;
  editPost?: {
    id: string;
    title: string;
    content: string;
    category: 'COLUMN' | 'ANALYSIS';
  } | null;
}

export function WritePostForm({ session, onCancel, onSuccess, editPost = null }: WritePostFormProps) {
  // Post category state (말머리)
  const [category, setCategory] = useState<'COLUMN' | 'ANALYSIS'>('COLUMN');

  // Content state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load edit post data
  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title);
      setCategory(editPost.category);
      setContent(editPost.content);
    }
  }, [editPost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('category', category);
      if (editPost) {
        formData.append('id', editPost.id);
      }

      await createColumn(formData, session?.access_token);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Editor Card */}
      <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection (말머리) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">말머리</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('COLUMN')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    category === 'COLUMN'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800/70 hover:text-white border border-slate-700'
                  }`}
                >
                  <PenLine className="w-4 h-4" />
                  칼럼
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('ANALYSIS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    category === 'ANALYSIS'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800/70 hover:text-white border border-slate-700'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  분석
                </button>
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">내용</label>
              <TiptapEditor content={content} onChange={setContent} placeholder="내용을 입력하세요..." />
              <p className="text-xs text-slate-500 mt-2">
                💡 에디터 상단의 📊 버튼을 눌러 JSX 차트를 삽입할 수 있습니다.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={onCancel}
              >
                취소
              </Button>
              <Button
                type="submit"
                className={`px-8 text-white ${
                  category === 'COLUMN'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
                disabled={isSubmitting}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? '업로드 중...' : editPost ? '수정하기' : '등록'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

