'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { createComment, deleteComment } from '@/app/actions/comment';
import CommentItem from './CommentItem';

interface Comment {
    id: string;
    content: string;
    createdAt: Date;
    author: {
        id: string;
        username: string;
        name: string | null;
        image: string | null;
        email?: string;
    };
    replies: Comment[];
}

interface CommentSectionProps {
    postId: string;
    initialComments: Comment[];
    commentCount: number;
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
    const { user, session } = useAuth();
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        if (!newComment.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createComment(postId, newComment, undefined, session?.access_token);
            if (result.success && result.comment) {
                setComments(prev => [{
                    ...result.comment,
                    createdAt: new Date(result.comment.createdAt),
                    replies: []
                }, ...prev]);
                setNewComment('');
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : '댓글 작성에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitReply = async (parentId: string) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        if (!replyContent.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createComment(postId, replyContent, parentId, session?.access_token);
            if (result.success && result.comment) {
                setComments(prev => prev.map(comment => {
                    if (comment.id === parentId) {
                        return {
                            ...comment,
                            replies: [...comment.replies, {
                                ...result.comment,
                                createdAt: new Date(result.comment.createdAt),
                                replies: []
                            }]
                        };
                    }
                    return comment;
                }));
                setReplyContent('');
                setReplyingTo(null);
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : '답글 작성에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string, isReply: boolean = false, parentId?: string) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;

        try {
            const result = await deleteComment(commentId, session?.access_token);
            if (result.success) {
                if (isReply && parentId) {
                    setComments(prev => prev.map(comment => {
                        if (comment.id === parentId) {
                            return {
                                ...comment,
                                replies: comment.replies.filter(r => r.id !== commentId)
                            };
                        }
                        return comment;
                    }));
                } else {
                    setComments(prev => prev.filter(c => c.id !== commentId));
                }
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="border-t border-white/10 pt-12">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                댓글 <span className="text-blue-400">{comments.length}</span>
            </h3>

            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} className="mb-8">
                <div className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={user ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있습니다."}
                        disabled={!user}
                        className="w-full bg-transparent px-4 py-3 text-white placeholder-slate-500 resize-none focus:outline-none min-h-[100px] disabled:opacity-50"
                    />
                    <div className="flex justify-between items-center px-4 py-3 border-t border-white/5 bg-white/[0.02]">
                        <span className="text-xs text-slate-500">
                            {user ? `${user.email}로 작성` : ''}
                        </span>
                        <Button
                            type="submit"
                            disabled={!user || !newComment.trim() || isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    등록
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
                <AnimatePresence>
                    {comments.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-slate-900/30 rounded-xl p-8 text-center text-slate-500 border border-white/5"
                        >
                            <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p>아직 댓글이 없습니다. 첫 댓글을 작성해보세요!</p>
                        </motion.div>
                    ) : (
                        comments.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                currentUserEmail={user?.email}
                                onDelete={handleDeleteComment}
                                onReply={(id) => {
                                    setReplyingTo(id);
                                    setReplyContent('');
                                }}
                                replyingTo={replyingTo}
                                replyContent={replyContent}
                                onReplyContentChange={setReplyContent}
                                onSubmitReply={handleSubmitReply}
                                onCancelReply={() => setReplyingTo(null)}
                                isSubmitting={isSubmitting}
                            />
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

