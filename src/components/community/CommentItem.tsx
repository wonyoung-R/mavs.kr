'use client';

import { motion } from 'framer-motion';
import { Reply, Trash2, Send, Loader2, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Comment {
    id: string;
    content: string;
    createdAt: Date;
    author: {
        id: string;
        username: string;
        image: string | null;
        email?: string;
    };
    replies: Comment[];
}

interface CommentItemProps {
    comment: Comment;
    currentUserEmail?: string;
    onDelete: (commentId: string, isReply?: boolean, parentId?: string) => void;
    onReply: (commentId: string) => void;
    replyingTo: string | null;
    replyContent: string;
    onReplyContentChange: (content: string) => void;
    onSubmitReply: (parentId: string) => void;
    onCancelReply: () => void;
    isSubmitting: boolean;
    isReply?: boolean;
    parentId?: string;
}

const ADMIN_EMAILS = ['mavsdotkr@gmail.com'];

export default function CommentItem({
    comment,
    currentUserEmail,
    onDelete,
    onReply,
    replyingTo,
    replyContent,
    onReplyContentChange,
    onSubmitReply,
    onCancelReply,
    isSubmitting,
    isReply = false,
    parentId,
}: CommentItemProps) {
    const isAuthor = currentUserEmail === comment.author.email;
    const isAdmin = currentUserEmail ? ADMIN_EMAILS.includes(currentUserEmail) : false;
    const canDelete = isAuthor || isAdmin;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`${isReply ? 'ml-8 pl-4 border-l-2 border-blue-500/20' : ''}`}
        >
            <div className={`bg-slate-900/40 rounded-xl p-4 border border-white/5 ${isReply ? 'bg-slate-900/20' : ''}`}>
                {/* Comment Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">
                            {comment.author.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <span className="font-medium text-white text-sm">{comment.author.username}</span>
                            <span className="text-slate-500 text-xs ml-2">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {!isReply && (
                            <button
                                onClick={() => onReply(comment.id)}
                                className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                                title="답글"
                            >
                                <Reply className="w-4 h-4" />
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={() => onDelete(comment.id, isReply, parentId)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                title="삭제"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Comment Content */}
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                </p>
            </div>

            {/* Reply Input (shown when replying to this comment) */}
            {!isReply && replyingTo === comment.id && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 ml-8"
                >
                    <div className="bg-slate-900/30 rounded-xl border border-blue-500/20 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-blue-500/5">
                            <CornerDownRight className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-blue-400">{comment.author.username}님에게 답글 작성</span>
                        </div>
                        <textarea
                            value={replyContent}
                            onChange={(e) => onReplyContentChange(e.target.value)}
                            placeholder="답글을 입력하세요..."
                            className="w-full bg-transparent px-4 py-3 text-white placeholder-slate-500 resize-none focus:outline-none min-h-[80px] text-sm"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 px-4 py-2 border-t border-white/5">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onCancelReply}
                                className="text-slate-400 hover:text-white"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onSubmitReply(comment.id)}
                                disabled={!replyContent.trim() || isSubmitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-3 h-3 mr-1" />
                                        답글
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Replies */}
            {!isReply && comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-3">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            currentUserEmail={currentUserEmail}
                            onDelete={onDelete}
                            onReply={onReply}
                            replyingTo={replyingTo}
                            replyContent={replyContent}
                            onReplyContentChange={onReplyContentChange}
                            onSubmitReply={onSubmitReply}
                            onCancelReply={onCancelReply}
                            isSubmitting={isSubmitting}
                            isReply={true}
                            parentId={comment.id}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
}

