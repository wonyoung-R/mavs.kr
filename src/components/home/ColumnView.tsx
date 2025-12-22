'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BookOpen, User, Calendar, ArrowRight, Star, ArrowLeft, MessageCircle, Heart, Send } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import MavericksLoading from '@/components/ui/MavericksLoading';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { createComment, getComments } from '@/app/actions/comment';

interface ColumnPost {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    author: {
        username: string;
        image: string | null;
    };
    _count: {
        comments: number;
        votes: number;
    };
}

export function ColumnView() {
    const { user, session } = useAuth();
    const [posts, setPosts] = useState<ColumnPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<ColumnPost | null>(null);

    // Comment states
    const [commentContent, setCommentContent] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');

    const fetchPosts = async () => {
        try {
            const response = await fetch('/api/columns');
            const data = await response.json();
            setPosts(data.posts || []);
        } catch (err) {
            console.error('Failed to load columns:', err);
        }
    };

    useEffect(() => {
        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2000));
        const fetchData = fetchPosts();

        Promise.all([fetchData, minLoadingTime])
            .then(() => {
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load columns:', err);
                setLoading(false);
            });
    }, []);

    const fetchComments = async (postId: string) => {
        setLoadingComments(true);
        try {
            const result = await getComments(postId);
            setComments(result || []);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
            setComments([]);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleCommentSubmit = async () => {
        if (!commentContent.trim()) {
            alert('댓글 내용을 입력해주세요.');
            return;
        }

        if (!user || !session?.access_token) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=column');
            return;
        }

        if (!selectedPost) return;

        setIsSubmittingComment(true);
        try {
            await createComment(selectedPost.id, commentContent, undefined, session.access_token);
            setCommentContent('');
            // Refresh comments to show new one
            await fetchComments(selectedPost.id);
            // Refresh posts to update comment count
            await fetchPosts();
        } catch (error) {
            console.error('Comment error:', error);
            alert('댓글 등록 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleReplySubmit = async (parentId: string) => {
        if (!replyContent.trim()) {
            alert('답글 내용을 입력해주세요.');
            return;
        }

        if (!user || !session?.access_token) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=column');
            return;
        }

        if (!selectedPost) return;

        setIsSubmittingReply(true);
        try {
            await createComment(selectedPost.id, replyContent, parentId, session.access_token);
            setReplyContent('');
            setReplyingTo(null);
            // Refresh comments to show new reply
            await fetchComments(selectedPost.id);
            // Refresh posts to update comment count
            await fetchPosts();
        } catch (error) {
            console.error('Reply error:', error);
            alert('답글 등록 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Fetch comments when selected post changes
    useEffect(() => {
        if (selectedPost) {
            fetchComments(selectedPost.id);
        } else {
            setComments([]);
        }
    }, [selectedPost]);

    if (loading) {
        return (
            <div className="w-full min-h-[calc(100vh-200px)] flex items-center justify-center">
                <MavericksLoading fullScreen={false} />
            </div>
        );
    }

    const featuredPost = posts[0];
    const recentPosts = posts.slice(1, 4);

    // Extract first image from content or use placeholder
    const getImageFromContent = (content: string) => {
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
        return imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1546519638-68e109498ee2?q=80&w=2090&auto=format&fit=crop';
    };

    // Extract text summary from HTML content
    const getTextSummary = (content: string, maxLength = 150) => {
        const text = content.replace(/<[^>]*>/g, '');
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Render Detail or List Content
    const renderContent = () => {
        if (selectedPost) {
            // Filter out selected post from the list
            const otherPosts = posts.filter(p => p.id !== selectedPost.id);

            return (
                <motion.div
                    key="detail"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                >

                    {/* Post Header */}
                    <header className="border-b border-white/10 pb-8">
                        <div className="flex items-center gap-3 mb-6 flex-wrap">
                            <span className="px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/20 text-sm font-medium">
                                ✍️ 칼럼
                            </span>
                            <span className="text-slate-500 text-sm flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true, locale: ko })}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white">
                            {selectedPost.title}
                        </h1>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300 overflow-hidden">
                                    {selectedPost.author.image ? (
                                        <img src={selectedPost.author.image} alt={selectedPost.author.username} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedPost.author.username?.[0]?.toUpperCase() || 'U'
                                    )}
                                </div>
                                <div>
                                    <div className="font-medium text-white">{selectedPost.author.username}</div>
                                    <div className="text-xs text-slate-500">칼럼니스트</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <Star className="w-5 h-5 text-yellow-500" />
                                    <span>{selectedPost._count.votes} 추천</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Post Content */}
                    <article className="prose prose-invert prose-lg max-w-none mb-12 bg-slate-900/50 rounded-2xl p-6 border border-white/10">
                        <div
                            className="text-slate-200 [&_p]:text-slate-200 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_li]:text-slate-200 [&_span]:text-slate-200 [&_div]:text-slate-200 [&_strong]:text-white"
                            dangerouslySetInnerHTML={{ __html: selectedPost.content }}
                        />
                    </article>

                    {/* Comments Section */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-3 md:p-6">
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h3 className="text-base md:text-xl font-bold text-white flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                                댓글 {comments.length}
                            </h3>
                        </div>

                        {/* Comments List - Now First */}
                        <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                            {loadingComments ? (
                                <div className="text-center py-6 md:py-8 text-slate-400">
                                    <div className="animate-spin w-5 h-5 md:w-6 md:h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                                </div>
                            ) : comments.length === 0 ? (
                                <div className="text-center py-6 md:py-8 text-slate-400 text-sm md:text-base">
                                    첫 댓글을 작성해보세요!
                                </div>
                            ) : (
                                <div className="space-y-3 md:space-y-4">
                                    {comments
                                        .filter((comment: any) => !comment.parentId)
                                        .map((comment: any) => {
                                            const renderComment = (cmt: any, depth = 0) => (
                                                <div key={cmt.id} className={`${depth > 0 ? 'ml-4 md:ml-8 mt-3 md:mt-4' : ''}`}>
                                                    <div className="flex gap-2 md:gap-3 p-3 md:p-4 bg-slate-800/30 rounded-lg">
                                                        <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <User className="w-3 h-3 md:w-4 md:h-4 text-slate-300" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs md:text-sm font-medium text-white">{cmt.author.username}</span>
                                                                <span className="text-[10px] md:text-xs text-slate-500">
                                                                    {formatDistanceToNow(new Date(cmt.createdAt), { addSuffix: true, locale: ko })}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs md:text-sm text-slate-300 whitespace-pre-wrap break-words mb-2">{cmt.content}</p>
                                                            <button
                                                                onClick={() => setReplyingTo(replyingTo === cmt.id ? null : cmt.id)}
                                                                className="text-[10px] md:text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                                            >
                                                                {replyingTo === cmt.id ? '취소' : '답글'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Reply input form */}
                                                    {replyingTo === cmt.id && (
                                                        <div className="ml-4 md:ml-8 mt-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={replyContent}
                                                                    onChange={(e) => setReplyContent(e.target.value)}
                                                                    placeholder={`@${cmt.author.username}님에게 답글...`}
                                                                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-white placeholder-slate-500
                                                                               focus:outline-none focus:border-blue-500 focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleReplySubmit(cmt.id);
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => handleReplySubmit(cmt.id)}
                                                                    disabled={isSubmittingReply || !replyContent.trim()}
                                                                    className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2"
                                                                >
                                                                    <Send className="w-3 h-3" />
                                                                    <span className="hidden md:inline">{isSubmittingReply ? '등록 중...' : '등록'}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Nested replies */}
                                                    {comments
                                                        .filter((c: any) => c.parentId === cmt.id)
                                                        .map((reply: any) => renderComment(reply, depth + 1))}
                                                </div>
                                            );

                                            return renderComment(comment);
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Comment Input - Now Below Comments */}
                        <div className="pt-4 md:pt-6 border-t border-white/10">
                            <textarea
                                value={commentContent}
                                onChange={(e) => setCommentContent(e.target.value)}
                                placeholder="댓글을 입력하세요..."
                                rows={2}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base text-white placeholder-slate-500 resize-none
                                           focus:outline-none focus:border-blue-500 focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20
                                           transition-all duration-200"
                            />
                            <div className="flex justify-between items-center mt-2 md:mt-3">
                                <span className="text-[10px] md:text-xs text-slate-500 truncate max-w-[120px] md:max-w-none">{user ? user.email : '로그인 필요'}</span>
                                <Button
                                    onClick={handleCommentSubmit}
                                    disabled={isSubmittingComment || !commentContent.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-6 py-1.5 md:py-2 text-xs md:text-sm disabled:opacity-50"
                                >
                                    <Send className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                    {isSubmittingComment ? '등록 중...' : '등록'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Other Columns Section */}
                    <div className="border-t border-white/10 pt-8">
                        <h3 className="text-2xl font-bold text-white mb-6">다른 칼럼</h3>
                        <div className="grid md:grid-cols-3 gap-6">
                            {otherPosts.slice(0, 6).map((post) => (
                                <Card
                                    key={post.id}
                                    className="h-full bg-slate-900/50 border-white/10 hover:border-blue-500/50 transition-colors group cursor-pointer"
                                    onClick={() => {
                                        setSelectedPost(post);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                >
                                    <CardHeader>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                                                Column
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                        <CardTitle className="text-lg text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                                            {post.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-slate-500 text-sm line-clamp-2 mb-4">
                                            {getTextSummary(post.content, 80)}
                                        </p>
                                        <div className="flex items-center justify-between text-sm text-slate-400">
                                            <span className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-slate-500" />
                                                {post.author.username}
                                            </span>
                                            <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </motion.div>
            );
        }

        // List View
        return (
            <motion.div
                key="list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
            >
            {/* Featured Column Hero */}
            {featuredPost && (
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="relative rounded-xl md:rounded-2xl overflow-hidden aspect-[4/3] md:aspect-[21/9] group cursor-pointer border border-white/10"
                    onClick={() => setSelectedPost(featuredPost)}
                >
                        <div className="absolute inset-0">
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/20 z-10" />
                            <img
                                src={getImageFromContent(featuredPost.content)}
                                alt="Featured Column"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-3 md:p-8 z-20">
                            <div className="flex items-center gap-2 mb-1.5 md:mb-4">
                                <span className="px-2 py-0.5 md:py-1 rounded-full bg-blue-600 text-white text-[10px] md:text-xs font-medium">Featured</span>
                                <span className="flex items-center text-slate-300 text-[10px] md:text-sm gap-1">
                                    <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" /> {formatDistanceToNow(new Date(featuredPost.createdAt), { addSuffix: true, locale: ko })}
                                </span>
                            </div>
                            <h3 className="text-base md:text-3xl lg:text-4xl font-bold text-white mb-1.5 md:mb-3 group-hover:text-blue-400 transition-colors line-clamp-2">
                                {featuredPost.title}
                            </h3>
                            <p className="text-slate-300 text-sm md:text-lg line-clamp-2 mb-3 md:mb-6 max-w-3xl hidden md:block">
                                {getTextSummary(featuredPost.content)}
                            </p>
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="flex items-center gap-1.5 md:gap-3">
                                    <div className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-slate-700 flex items-center justify-center border border-white/20 overflow-hidden">
                                        {featuredPost.author.image ? (
                                            <img src={featuredPost.author.image} alt={featuredPost.author.username} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <User className="w-3 h-3 md:w-5 md:h-5 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-[10px] md:text-sm">{featuredPost.author.username}</p>
                                        <p className="text-blue-400 text-[9px] md:text-xs">Columnist</p>
                                    </div>
                                </div>
                                <div className="h-4 md:h-8 w-px bg-white/20" />
                                <span className="text-slate-400 text-[10px] md:text-sm flex items-center gap-1">
                                    <BookOpen className="w-2.5 h-2.5 md:w-4 md:h-4" /> {featuredPost._count.comments} 댓글
                                </span>
                            </div>
                        </div>
                    </motion.div>
            )}

            {/* Recent Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                {recentPosts.map((post) => (
                        <Card key={post.id} className="h-full bg-slate-900/50 border-white/10 hover:border-blue-500/50 transition-colors group cursor-pointer" onClick={() => setSelectedPost(post)}>
                            <CardHeader className="p-3 md:p-6">
                                <div className="flex justify-between items-start mb-1 md:mb-2">
                                    <span className="text-[10px] md:text-xs font-medium text-blue-400 bg-blue-400/10 px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                                        Column
                                    </span>
                                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-slate-500 group-hover:text-blue-400 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <CardTitle className="text-sm md:text-lg text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                                    {post.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                                <div className="flex items-center justify-between text-[10px] md:text-sm text-slate-400">
                                    <span className="flex items-center gap-1 md:gap-2">
                                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-500" />
                                        {post.author.username}
                                    </span>
                                    <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                </div>
                            </CardContent>
                        </Card>
                ))}
            </div>

            {/* Call to Action for Writers */}
            <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-white/10">
                <CardContent className="p-4 md:p-8 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
                    <div>
                        <h4 className="text-base md:text-xl font-bold text-white mb-1 md:mb-2 flex items-center gap-2">
                            <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                            Mavs Columnist가 되어보세요
                        </h4>
                        <p className="text-slate-300 text-xs md:text-base">
                            나만의 시선으로 댈러스의 이야기를 들려주세요.
                        </p>
                    </div>
                    <Link href="/login?redirect=/column">
                        <button className="px-4 md:px-6 py-2 md:py-3 bg-white text-slate-900 rounded-lg md:rounded-xl font-bold text-sm md:text-base hover:bg-blue-50 transition-colors whitespace-nowrap">
                            칼럼 기고하기
                        </button>
                    </Link>
                </CardContent>
            </Card>
            </motion.div>
        );
    };

    // Main Layout with Fixed Header
    return (
        <div className="w-full max-w-5xl mx-auto space-y-4 md:space-y-8 px-3 md:px-4 pt-3 md:pt-4 pb-16 md:pb-20">
            {/* Fixed Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-4 md:mb-6">
                <div>
                    <h2 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                        ✍️ 매버릭스 칼럼
                        <span className="text-xs md:text-sm font-normal text-slate-400">
                            ({posts.length}개)
                        </span>
                    </h2>
                    <p className="text-slate-400 text-xs md:text-base">전문가들의 시선으로 보는 댈러스 매버릭스</p>
                </div>
            </div>

            {/* Dynamic Content Area */}
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>
        </div>
    );
}
