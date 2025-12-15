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
    Undo, Redo, Strikethrough
} from 'lucide-react';
import { useCallback, useState } from 'react';

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    editable?: boolean;
}

const TiptapEditor = ({ content, onChange, placeholder = '내용을 입력하세요...', editable = true }: TiptapEditorProps) => {
    const [isUploading, setIsUploading] = useState(false);

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
        ],
        immediatelyRender: false,
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] p-4 text-white',
            },
        },
    });

    const addImage = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files?.length) {
                setIsUploading(true);
                const file = input.files[0];
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
                }
            }
        };
        input.click();
    }, [editor]);

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

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full border border-slate-700 rounded-lg overflow-hidden bg-slate-900/50">
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
                    <div className="flex-1" />
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
            <EditorContent editor={editor} />
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
