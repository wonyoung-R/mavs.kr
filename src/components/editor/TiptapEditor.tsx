'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { supabase } from '@/lib/db/supabase';
import {
    Bold, Italic, List, ListOrdered, Quote,
    Heading1, Heading2, Image as ImageIcon,
    Youtube as YoutubeIcon, Link as LinkIcon,
    Undo, Redo, Strikethrough, TrendingUp, Smile, Save
} from 'lucide-react';
import { useCallback, useState, useEffect, useRef } from 'react';
import { JSXBlock } from './JSXBlockExtension';
import dynamic from 'next/dynamic';

// 이모지 피커는 동적 로드 (SSR 방지)
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    editable?: boolean;
    autosaveKey?: string; // 자동 저장 키 (예: 'post-title', 'post-content')
    showCharCount?: boolean; // 글자 수 표시 여부
    onCharCountChange?: (count: number) => void; // 글자 수 변경 콜백
}

// HTML에서 텍스트만 추출하는 함수
function getTextFromHTML(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

const TiptapEditor = ({
    content,
    onChange,
    placeholder = '내용을 입력하세요...',
    editable = true,
    autosaveKey,
    showCharCount = true,
    onCharCountChange
}: TiptapEditorProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
            }),
            Youtube.configure({
                controls: false,
            }),
            Placeholder.configure({
                placeholder,
            }),
            JSXBlock,
        ],
        immediatelyRender: false,
        content,
        editable,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(html);

            // 글자 수 계산
            const text = getTextFromHTML(html);
            const count = text.length;
            setCharCount(count);
            onCharCountChange?.(count);

            // 자동 저장 (debounce)
            if (autosaveKey) {
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }
                saveTimeoutRef.current = setTimeout(() => {
                    localStorage.setItem(autosaveKey, html);
                    setLastSaved(new Date());
                }, 1000); // 1초 후 저장
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] p-4 text-white',
                style: 'white-space: pre-wrap;',
            },
            handleKeyDown: (view, event) => {
                // Enter 키 처리: 빈 줄을 쉽게 만들 수 있도록
                if (event.key === 'Enter' && !event.shiftKey) {
                    const { state } = view;
                    const { selection } = state;
                    const { $from } = selection;

                    // 현재 위치가 빈 paragraph인 경우, 또 다른 빈 paragraph 추가
                    if ($from.parent.textContent === '' && $from.parent.type.name === 'paragraph') {
                        // 이미 빈 줄이면 그대로 진행 (기본 동작)
                        return false;
                    }

                    // 일반 Enter: 기본 동작 (새 paragraph 생성)
                    return false;
                }

                // Shift+Enter: 줄바꿈 (hard break)
                if (event.key === 'Enter' && event.shiftKey) {
                    editor?.chain().focus().setHardBreak().run();
                    return true;
                }

                return false;
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        handleImageUpload(file);
                        return true;
                    }
                }
                return false;
            },
            handlePaste: (view, event, slice) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));

                if (imageItem) {
                    event.preventDefault();
                    const file = imageItem.getAsFile();
                    if (file) {
                        handleImageUpload(file);
                        return true;
                    }
                }
                return false;
            },
        },
    });

    // 자동 저장된 내용 복원
    useEffect(() => {
        if (autosaveKey && editor && !content) {
            const saved = localStorage.getItem(autosaveKey);
            if (saved) {
                editor.commands.setContent(saved);
                const text = getTextFromHTML(saved);
                setCharCount(text.length);
            }
        }
    }, [autosaveKey, editor, content]);

    // 초기 글자 수 계산
    useEffect(() => {
        if (editor && content) {
            const text = getTextFromHTML(content);
            setCharCount(text.length);
        }
    }, [editor, content]);

    // 이모지 피커 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showEmojiPicker]);

    const handleImageUpload = useCallback(async (file: File) => {
        // Check file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB in bytes
        if (file.size > maxSize) {
            alert('이미지 크기는 5MB를 초과할 수 없습니다.\n현재 파일 크기: ' + (file.size / 1024 / 1024).toFixed(2) + 'MB');
            return;
        }

        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error } = await supabase.storage
                .from('Column')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('Column')
                .getPublicUrl(filePath);

            editor?.chain().focus().setImage({ src: publicUrl }).run();
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('이미지 업로드에 실패했습니다.');
        } finally {
            setIsUploading(false);
            setIsDragging(false);
        }
    }, [editor]);

    const addImage = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files?.length) {
                await handleImageUpload(input.files[0]);
            }
        };
        input.click();
    }, [handleImageUpload]);

    const addYoutube = useCallback(() => {
        const url = prompt('YouTube URL을 입력하세요:');

        if (url && editor) {
            editor.commands.setYoutubeVideo({
                src: url,
            });
        }
    }, [editor]);

    const addLink = useCallback(() => {
        const previousUrl = editor?.getAttributes('link').href;
        const url = window.prompt('URL을 입력하세요', previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // update link
        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const addJSXBlock = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.jsx,.js';
        input.onchange = async () => {
            if (input.files?.length) {
                const file = input.files[0];

                // Check file extension
                if (!file.name.endsWith('.jsx') && !file.name.endsWith('.js')) {
                    alert('.jsx 또는 .js 파일만 업로드 가능합니다.');
                    return;
                }

                try {
                    const jsxCode = await file.text();
                    const id = `jsx-${Math.random().toString(36).substring(2)}`;

                    // Encode JSX code to base64 for safe storage in HTML attribute (UTF-8 safe)
                    const encoder = new TextEncoder();
                    const data = encoder.encode(jsxCode);
                    const base64Code = btoa(String.fromCharCode(...data));

                    // Insert JSX block into editor
                    editor?.chain().focus().insertContent({
                        type: 'jsxBlock',
                        attrs: {
                            jsxCode: base64Code,
                            id,
                        },
                    }).run();
                } catch (error) {
                    console.error('Error reading JSX file:', error);
                    alert('JSX 파일을 읽는 중 오류가 발생했습니다.');
                }
            }
        };
        input.click();
    }, [editor]);

    const handleEmojiClick = useCallback((emojiData: { emoji: string }) => {
        editor?.chain().focus().insertContent(emojiData.emoji).run();
        setShowEmojiPicker(false);
    }, [editor]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                handleImageUpload(file);
            }
        }
    }, [handleImageUpload]);

    const clearAutosave = useCallback(() => {
        if (autosaveKey) {
            localStorage.removeItem(autosaveKey);
            setLastSaved(null);
        }
    }, [autosaveKey]);

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full border border-slate-700 rounded-lg overflow-hidden bg-slate-900/50 relative">
            {editable && (
                <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-700 bg-slate-900">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        icon={<Bold className="w-4 h-4" />}
                        title="Bold"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        icon={<Italic className="w-4 h-4" />}
                        title="Italic"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive('strike')}
                        icon={<Strikethrough className="w-4 h-4" />}
                        title="Strike"
                    />
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                        icon={<Heading1 className="w-4 h-4" />}
                        title="H1"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        icon={<Heading2 className="w-4 h-4" />}
                        title="H2"
                    />
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        icon={<List className="w-4 h-4" />}
                        title="Bullet List"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        icon={<ListOrdered className="w-4 h-4" />}
                        title="Ordered List"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        icon={<Quote className="w-4 h-4" />}
                        title="Quote"
                    />
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <ToolbarButton
                        onClick={addLink}
                        isActive={editor.isActive('link')}
                        icon={<LinkIcon className="w-4 h-4" />}
                        title="Link"
                    />
                    <ToolbarButton
                        onClick={addImage}
                        isActive={false}
                        icon={<ImageIcon className="w-4 h-4" />}
                        title="Image"
                        disabled={isUploading}
                    />
                    <ToolbarButton
                        onClick={addYoutube}
                        isActive={editor.isActive('youtube')}
                        icon={<YoutubeIcon className="w-4 h-4" />}
                        title="YouTube"
                    />
                    <ToolbarButton
                        onClick={addJSXBlock}
                        isActive={false}
                        icon={<TrendingUp className="w-4 h-4" />}
                        title="JSX 차트/시각화"
                    />
                    <ToolbarButton
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        isActive={showEmojiPicker}
                        icon={<Smile className="w-4 h-4" />}
                        title="이모지"
                    />
                    <div className="flex-1" />
                    {autosaveKey && lastSaved && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500 mr-2">
                            <Save className="w-3 h-3" />
                            <span>임시저장됨</span>
                        </div>
                    )}
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        isActive={false}
                        icon={<Undo className="w-4 h-4" />}
                        title="Undo"
                    />
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        isActive={false}
                        icon={<Redo className="w-4 h-4" />}
                        title="Redo"
                    />
                </div>
            )}

            {/* 이모지 피커 */}
            {showEmojiPicker && editable && (
                <div ref={emojiPickerRef} className="absolute top-12 right-4 z-50">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={350}
                        height={400}
                        previewConfig={{ showPreview: false }}
                        skinTonesDisabled
                    />
                </div>
            )}

            {/* 드래그 앤 드롭 영역 */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative ${isDragging ? 'bg-blue-500/10 border-2 border-blue-500 border-dashed' : ''}`}
            >
                <EditorContent editor={editor} />
                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 z-10 pointer-events-none">
                        <div className="text-blue-400 font-semibold text-lg">이미지를 여기에 놓으세요</div>
                    </div>
                )}
            </div>

            {/* 글자 수 카운터 */}
            {showCharCount && editable && (
                <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center text-xs text-gray-500">
                    <span>글자 수: {charCount.toLocaleString()}자</span>
                    {autosaveKey && (
                        <button
                            onClick={clearAutosave}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title="임시저장 삭제"
                        >
                            임시저장 삭제
                        </button>
                    )}
                </div>
            )}

            {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="text-white">이미지 업로드 중...</div>
                </div>
            )}
        </div>
    );
};

const ToolbarButton = ({ onClick, isActive, icon, title, disabled }: { onClick: () => void; isActive: boolean; icon: React.ReactNode; title: string, disabled?: boolean }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        type="button"
        className={`p-2 rounded hover:bg-slate-700 transition-colors ${isActive ? 'bg-slate-700 text-blue-400' : 'text-slate-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {icon}
    </button>
);

export default TiptapEditor;
