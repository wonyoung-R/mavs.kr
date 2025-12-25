'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, MapPin, Calendar, ArrowRight, Users, DollarSign, ArrowLeft, Send, Image as ImageIcon, Link as LinkIcon, Plus, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MavericksLoading from '@/components/ui/MavericksLoading';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createCommunityPost, updateCommunityPost, deleteCommunityPost, toggleLike } from '@/app/actions/community';
import { supabase } from '@/lib/db/supabase';
import { Pencil, Trash2 } from 'lucide-react';
import { createComment, getComments } from '@/app/actions/comment';

interface CommunityPost {
    id: string;
    title: string;
    content: string;
    category: string;
    price?: number | null;
    meetupLocation?: string | null;
    meetupDate?: string | null;
    meetupPurpose?: string | null;
    createdAt: string;
    author: {
        id: string;
        email: string;
        name: string | null;
        username: string;
        image: string | null;
    };
    _count: {
        comments: number;
        votes: number;
        likes: number;
    };
}

const CATEGORIES = [
    { id: 'all', name: '전체', icon: '🔥' },
    { id: 'NOTICE', name: '공지사항', icon: '📢' },
    { id: 'NEWS', name: '뉴스', icon: '📰' },
    { id: 'FREE', name: '자유게시판', icon: '🗣️' },
    { id: 'MARKET', name: '중고장터', icon: '🛒' },
    { id: 'MEETUP', name: '오프라인 모임', icon: '🍺' },
];

const WRITE_CATEGORIES = [
    { id: 'NEWS', name: '뉴스', icon: '📰', description: 'SNS 링크와 이미지로 뉴스를 공유하세요' },
    { id: 'FREE', name: '자유게시판', icon: '🗣️', description: '자유롭게 이야기를 나눠보세요' },
    { id: 'MARKET', name: '중고장터', icon: '🛒', description: '매버릭스 굿즈를 사고 팔아요' },
    { id: 'MEETUP', name: '오프라인 모임', icon: '🍺', description: '같이 경기 보러 가요!' },
];

const MEETUP_PURPOSES = [
    { id: 'DRINK', name: '🍺 술 한잔' },
    { id: 'MEAL', name: '🍽️ 식사' },
    { id: 'THUNDER', name: '⚡ 번개 직관' },
    { id: 'EXERCISE', name: '🏀 운동' },
    { id: 'MEETING', name: '🤝 정모' },
];

const CATEGORY_COLORS: Record<string, string> = {
    NOTICE: 'bg-red-500/10 border-red-500/20 text-red-400',
    NEWS: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    FREE: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    MARKET: 'bg-green-500/10 border-green-500/20 text-green-400',
    MEETUP: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
};

export function CommunityView() {
    const { user, session } = useAuth();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showWriteForm, setShowWriteForm] = useState(false);
    const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [detailListPage, setDetailListPage] = useState(1); // 상세 페이지 내 리스트 페이지네이션
    const ITEMS_PER_PAGE = 10; // 첫 페이지: 1개 featured + 9개 list, 나머지 페이지: 10개 list
    const DETAIL_LIST_PER_PAGE = 5; // 상세 페이지 내 리스트 페이지당 항목 수

    // Write form states
    const [writeCategory, setWriteCategory] = useState('FREE');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('');
    const [meetupLocation, setMeetupLocation] = useState('');
    const [meetupDate, setMeetupDate] = useState('');
    const [meetupPurpose, setMeetupPurpose] = useState('DRINK');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // News specific states
    const [newsImages, setNewsImages] = useState<string[]>(['']);
    const [snsLinks, setSnsLinks] = useState<string[]>(['']);

    // Comment states
    const [commentContent, setCommentContent] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');

    // Like states
    const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

    // Edit mode states
    const [isEditMode, setIsEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editMeetupLocation, setEditMeetupLocation] = useState('');
    const [editMeetupDate, setEditMeetupDate] = useState('');
    const [editMeetupPurpose, setEditMeetupPurpose] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Check if current user is the author
    const isAuthor = (post: CommunityPost) => {
        if (!user) return false;
        return user.email === post.author.email;
    };

    // Get display name (nickname first, then username)
    const getDisplayName = (author: CommunityPost['author']) => {
        return author.name || author.username;
    };

    const fetchPosts = async (category: string) => {
        try {
            const query = category === 'all' ? '' : `?category=${category}`;
            console.log('[CommunityView] Fetching posts for category:', category, 'query:', query);
            const response = await fetch(`/api/community${query}`);

            if (!response.ok) {
                console.error('[CommunityView] API error:', response.status, response.statusText);
            }

            const data = await response.json();
            console.log('[CommunityView] Received data:', data);
            console.log('[CommunityView] Posts count:', data.posts?.length || 0);
            setPosts(data.posts || []);
        } catch (err) {
            console.error('[CommunityView] Failed to load community posts:', err);
        }
    };

    useEffect(() => {
        setLoading(true);
        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 1500));

        Promise.all([fetchPosts(selectedCategory), minLoadingTime]).then(() => {
            setLoading(false);
        });
    }, [selectedCategory]);

    // Initialize like counts when posts change
    useEffect(() => {
        const counts: Record<string, number> = {};
        posts.forEach(post => {
            // Use existing count if available, otherwise use post count
            counts[post.id] = likeCounts[post.id] ?? post._count.likes;
        });
        setLikeCounts(counts);
    }, [posts]);

    // Fetch comments when selected post changes
    useEffect(() => {
        if (selectedPost) {
            fetchComments(selectedPost.id);
        } else {
            setComments([]);
        }
        // Reset edit mode and detail list page when post changes
        setIsEditMode(false);
        setDetailListPage(1);
    }, [selectedPost]);

    const handleCategoryChange = (categoryId: string) => {
        setSelectedCategory(categoryId);
        setSelectedPost(null); // 카테고리 변경 시 상세 페이지 닫기
        setCurrentPage(1); // 카테고리 변경 시 첫 페이지로
    };

    const handleWriteClick = () => {
        if (!user) {
            // 로그인 페이지로 리다이렉트 (현재 위치 저장)
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=community');
            return;
        }
        setShowWriteForm(true);
    };

    const handleCancelWrite = () => {
        setShowWriteForm(false);
        // Reset form
        setTitle('');
        setContent('');
        setPrice('');
        setMeetupLocation('');
        setMeetupDate('');
        setWriteCategory('FREE');
        setNewsImages(['']);
        setSnsLinks(['']);
    };

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
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=community');
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
            await fetchPosts(selectedCategory);
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
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=community');
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
            await fetchPosts(selectedCategory);
        } catch (error) {
            console.error('Reply error:', error);
            alert('답글 등록 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleLikeToggle = async (postId: string) => {
        if (!user || !session?.access_token) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login?redirect=' + encodeURIComponent('/?tab=community');
            return;
        }

        try {
            const result = await toggleLike(postId, session.access_token);

            // Update liked state
            setLikedPosts(prev => {
                const newSet = new Set(prev);
                if (result.liked) {
                    newSet.add(postId);
                } else {
                    newSet.delete(postId);
                }
                return newSet;
            });

            // Update like count
            setLikeCounts(prev => ({
                ...prev,
                [postId]: result.liked
                    ? (prev[postId] || 0) + 1
                    : Math.max(0, (prev[postId] || 0) - 1)
            }));
        } catch (error) {
            console.error('Like error:', error);
            alert('좋아요 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        }
    };

    // Start editing a post
    const handleEditStart = (post: CommunityPost) => {
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditPrice(post.price?.toString() || '');
        setEditMeetupLocation(post.meetupLocation || '');
        setEditMeetupDate(post.meetupDate ? new Date(post.meetupDate).toISOString().slice(0, 16) : '');
        setEditMeetupPurpose(post.meetupPurpose || 'DRINK');
        setIsEditMode(true);
    };

    // Cancel editing
    const handleEditCancel = () => {
        setIsEditMode(false);
        setEditTitle('');
        setEditContent('');
        setEditPrice('');
        setEditMeetupLocation('');
        setEditMeetupDate('');
        setEditMeetupPurpose('');
    };

    // Submit edit
    const handleEditSubmit = async () => {
        if (!selectedPost || !session?.access_token) return;

        if (!editTitle.trim() || !editContent.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append('title', editTitle.trim());
            formData.append('content', editContent);
            if (selectedPost.category === 'MARKET' && editPrice) {
                formData.append('price', editPrice);
            }
            if (selectedPost.category === 'MEETUP') {
                formData.append('meetupLocation', editMeetupLocation);
                formData.append('meetupDate', editMeetupDate);
                formData.append('meetupPurpose', editMeetupPurpose);
            }

            await updateCommunityPost(selectedPost.id, formData, session.access_token);

            // Update local state
            const updatedPost = {
                ...selectedPost,
                title: editTitle.trim(),
                content: editContent,
                price: editPrice ? parseInt(editPrice) : null,
                meetupLocation: editMeetupLocation || null,
                meetupDate: editMeetupDate || null,
                meetupPurpose: editMeetupPurpose || null,
            };
            setSelectedPost(updatedPost);
            setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));

            setIsEditMode(false);
            alert('게시글이 수정되었습니다.');
        } catch (error) {
            console.error('Update error:', error);
            alert('수정 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsUpdating(false);
        }
    };

    // Delete post
    const handleDelete = async () => {
        if (!selectedPost || !session?.access_token) return;

        if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;

        setIsDeleting(true);
        try {
            await deleteCommunityPost(selectedPost.id, session.access_token);

            // Remove from local state
            setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
            setSelectedPost(null);

            alert('게시글이 삭제되었습니다.');
        } catch (error) {
            console.error('Delete error:', error);
            alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        if (writeCategory === 'MARKET' && !price) {
            alert('가격을 입력해주세요.');
            return;
        }

        if (writeCategory === 'MEETUP' && (!meetupLocation || !meetupDate)) {
            alert('모임 장소와 날짜를 입력해주세요.');
            return;
        }

        // Double-check user is still logged in
        if (!user || !session?.access_token) {
            alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            formData.append('category', writeCategory);

            if (writeCategory === 'MARKET') {
                formData.append('price', price);
            }

            if (writeCategory === 'MEETUP') {
                formData.append('meetupLocation', meetupLocation);
                formData.append('meetupDate', meetupDate);
                formData.append('meetupPurpose', meetupPurpose);
            }

            if (writeCategory === 'NEWS') {
                // Filter out empty strings
                const validImages = newsImages.filter(img => img.trim());
                const validLinks = snsLinks.filter(link => link.trim());
                formData.append('images', JSON.stringify(validImages));
                formData.append('snsLinks', JSON.stringify(validLinks));
            }

            console.log('Submitting with token:', session.access_token ? 'present' : 'missing');
            await createCommunityPost(formData, session.access_token);

            // Reset and refresh
            handleCancelWrite();
            setCurrentPage(1); // 첫 페이지로 이동
            await fetchPosts(selectedCategory);

        } catch (error) {
            console.error(error);
            alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Extract text summary from HTML content
    const getTextSummary = (content: string, maxLength = 100) => {
        const text = content.replace(/<[^>]*>/g, '');
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Pagination logic
    const totalPages = Math.ceil(posts.length / ITEMS_PER_PAGE);
    let featuredPost: CommunityPost | undefined;
    let displayPosts: CommunityPost[] = [];

    if (currentPage === 1) {
        // 첫 페이지: featured 1개 + list 9개
        featuredPost = posts[0];
        displayPosts = posts.slice(1, ITEMS_PER_PAGE);
    } else {
        // 나머지 페이지: 모두 list로 표시
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        displayPosts = posts.slice(startIndex, endIndex);
    }

    const recentPosts = displayPosts;

    if (loading) {
        return (
            <div className="w-full min-h-[calc(100vh-200px)] flex items-center justify-center">
                <MavericksLoading fullScreen={false} />
            </div>
        );
    }


    // Write Form View
    if (showWriteForm) {
        const selectedWriteCategory = WRITE_CATEGORIES.find(c => c.id === writeCategory);

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-4xl mx-auto space-y-6"
            >
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="md"
                        className="hover:bg-white/10 text-white p-2 w-10"
                        onClick={handleCancelWrite}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-2xl font-bold text-white">커뮤니티 글쓰기</h2>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-3">카테고리 선택</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {WRITE_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setWriteCategory(cat.id)}
                                            className={`p-4 rounded-xl border transition-all text-left ${
                                                writeCategory === cat.id
                                                    ? 'bg-blue-600/20 border-blue-500 text-white'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="text-2xl mb-2">{cat.icon}</div>
                                            <div className="font-medium">{cat.name}</div>
                                            <div className="text-xs opacity-70 mt-1">{cat.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">제목</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={
                                        writeCategory === 'MARKET' ? '[판매] 또는 [구매]로 시작해주세요' :
                                        writeCategory === 'MEETUP' ? '모임 제목을 입력하세요' :
                                        '제목을 입력하세요'
                                    }
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                />
                            </div>

                            {/* Market: Price */}
                            {writeCategory === 'MARKET' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" /> 가격
                                    </label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="가격을 입력하세요 (원)"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                    />
                                </div>
                            )}

                            {/* Meetup: Location, Date, Purpose */}
                            {writeCategory === 'MEETUP' && (
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                            <MapPin className="w-4 h-4" /> 장소
                                        </label>
                                        <input
                                            type="text"
                                            value={meetupLocation}
                                            onChange={(e) => setMeetupLocation(e.target.value)}
                                            placeholder="예: 홍대입구역 3번 출구"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> 날짜/시간
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={meetupDate}
                                            onChange={(e) => setMeetupDate(e.target.value)}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">모임 목적</label>
                                        <select
                                            value={meetupPurpose}
                                            onChange={(e) => setMeetupPurpose(e.target.value)}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                        >
                                            {MEETUP_PURPOSES.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* News: Images and SNS Links */}
                            {writeCategory === 'NEWS' && (
                                <div className="space-y-4">
                                    {/* Image URLs */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> 이미지 URL (최대 5개)
                                        </label>
                                        {newsImages.map((img, index) => (
                                            <div key={index} className="flex gap-2 mb-2">
                                                <input
                                                    type="url"
                                                    value={img}
                                                    onChange={(e) => {
                                                        const updated = [...newsImages];
                                                        updated[index] = e.target.value;
                                                        setNewsImages(updated);
                                                    }}
                                                    placeholder="https://example.com/image.jpg"
                                                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                                />
                                                {newsImages.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewsImages(newsImages.filter((_, i) => i !== index))}
                                                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {newsImages.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => setNewsImages([...newsImages, ''])}
                                                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> 이미지 추가
                                            </button>
                                        )}
                                    </div>

                                    {/* SNS Links */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                                            <LinkIcon className="w-4 h-4" /> SNS 링크 (Twitter, Instagram 등)
                                        </label>
                                        {snsLinks.map((link, index) => (
                                            <div key={index} className="flex gap-2 mb-2">
                                                <input
                                                    type="url"
                                                    value={link}
                                                    onChange={(e) => {
                                                        const updated = [...snsLinks];
                                                        updated[index] = e.target.value;
                                                        setSnsLinks(updated);
                                                    }}
                                                    placeholder="https://twitter.com/... 또는 https://instagram.com/..."
                                                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                                />
                                                {snsLinks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSnsLinks(snsLinks.filter((_, i) => i !== index))}
                                                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {snsLinks.length < 3 && (
                                            <button
                                                type="button"
                                                onClick={() => setSnsLinks([...snsLinks, ''])}
                                                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> SNS 링크 추가
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Content - TipTap Editor */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">내용</label>
                                <TiptapEditor content={content} onChange={setContent} placeholder="내용을 입력하세요..." />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    onClick={handleCancelWrite}
                                >
                                    취소
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8" disabled={isSubmitting}>
                                    <Send className="w-4 h-4 mr-2" />
                                    {selectedWriteCategory?.icon} {selectedWriteCategory?.name} 등록
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // Render Detail or List Content
    const renderContent = () => {
        if (selectedPost) {
            const categoryInfo = CATEGORIES.find(c => c.id === selectedPost.category);
            // Filter out selected post from the list
            // Filter posts to show only same category posts (excluding current post)
            const otherPosts = posts.filter(p => p.id !== selectedPost.id && p.category === selectedPost.category);

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
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${CATEGORY_COLORS[selectedPost.category] || CATEGORY_COLORS.FREE}`}>
                                {categoryInfo?.icon} {categoryInfo?.name}
                            </span>
                            <span className="text-slate-500 text-sm flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true, locale: ko })}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white">
                            {selectedPost.title}
                        </h1>

                        {/* Market: Price Badge */}
                        {selectedPost.category === 'MARKET' && selectedPost.price && (
                            <div className="mb-6 inline-flex items-center gap-2 text-green-400 font-bold text-xl bg-green-900/30 px-4 py-2 rounded-xl border border-green-500/20">
                                <DollarSign className="w-5 h-5" />
                                ₩ {selectedPost.price.toLocaleString()}
                            </div>
                        )}

                        {/* Meetup: Details */}
                        {selectedPost.category === 'MEETUP' && (
                            <div className="mb-6 flex flex-wrap gap-4">
                                {selectedPost.meetupLocation && (
                                    <div className="inline-flex items-center gap-2 text-purple-400 bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20">
                                        <MapPin className="w-4 h-4" />
                                        {selectedPost.meetupLocation}
                                    </div>
                                )}
                                {selectedPost.meetupDate && (
                                    <div className="inline-flex items-center gap-2 text-purple-400 bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20">
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(selectedPost.meetupDate), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300">
                                    {getDisplayName(selectedPost.author)?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <div className="font-medium text-white">{getDisplayName(selectedPost.author)}</div>
                                    <div className="text-xs text-slate-500">Member</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-4">
                                {/* Edit/Delete buttons for author */}
                                {isAuthor(selectedPost) && !isEditMode && (
                                    <>
                                        <button
                                            onClick={() => handleEditStart(selectedPost)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                            <span className="hidden md:inline">수정</span>
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden md:inline">{isDeleting ? '삭제 중...' : '삭제'}</span>
                                        </button>
                                    </>
                                )}

                                {/* Like button */}
                                <button
                                    onClick={() => handleLikeToggle(selectedPost.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                                        likedPosts.has(selectedPost.id)
                                            ? 'text-red-500 bg-red-500/10'
                                            : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                                    }`}
                                >
                                    <Heart className={`w-5 h-5 ${likedPosts.has(selectedPost.id) ? 'fill-red-500' : ''}`} />
                                    <span>{likeCounts[selectedPost.id] ?? selectedPost._count.likes}</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Edit Mode Form */}
                    {isEditMode ? (
                        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-12">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Pencil className="w-5 h-5" /> 게시글 수정
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">제목</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                {/* Market: Price */}
                                {selectedPost.category === 'MARKET' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">가격 (원)</label>
                                        <input
                                            type="number"
                                            value={editPrice}
                                            onChange={(e) => setEditPrice(e.target.value)}
                                            className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                )}

                                {/* Meetup: Location & Date */}
                                {selectedPost.category === 'MEETUP' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-2">장소</label>
                                            <input
                                                type="text"
                                                value={editMeetupLocation}
                                                onChange={(e) => setEditMeetupLocation(e.target.value)}
                                                className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-2">날짜/시간</label>
                                            <input
                                                type="datetime-local"
                                                value={editMeetupDate}
                                                onChange={(e) => setEditMeetupDate(e.target.value)}
                                                className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">내용</label>
                                    <TiptapEditor
                                        content={editContent}
                                        onChange={setEditContent}
                                        placeholder="내용을 입력하세요..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={handleEditCancel}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleEditSubmit}
                                        disabled={isUpdating}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isUpdating ? '저장 중...' : '저장'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Post Content */
                        <article className="prose prose-invert prose-lg max-w-none mb-12 bg-slate-900/50 rounded-2xl p-6 border border-white/10">
                            <div
                                className="text-slate-200 [&_p]:text-slate-200 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_li]:text-slate-200 [&_span]:text-slate-200 [&_div]:text-slate-200 [&_strong]:text-white"
                                dangerouslySetInnerHTML={{ __html: selectedPost.content }}
                            />
                        </article>
                    )}

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
                                            const replies = comments.filter((c: any) => c.parentId === comment.id);

                                            const renderComment = (cmt: any, depth = 0) => (
                                                <div key={cmt.id} className={`${depth > 0 ? 'ml-4 md:ml-8 mt-3 md:mt-4' : ''}`}>
                                                    <div className="flex gap-2 md:gap-3 p-3 md:p-4 bg-slate-800/30 rounded-lg">
                                                        <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <User className="w-3 h-3 md:w-4 md:h-4 text-slate-300" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs md:text-sm font-medium text-white">{cmt.author.name || cmt.author.username}</span>
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

                    {/* Other Posts Section - Same Category List */}
                    {(() => {
                        const filteredPosts = otherPosts.filter(p => p.id !== selectedPost.id);
                        const detailTotalPages = Math.ceil(filteredPosts.length / DETAIL_LIST_PER_PAGE);
                        const startIndex = (detailListPage - 1) * DETAIL_LIST_PER_PAGE;
                        const paginatedPosts = filteredPosts.slice(startIndex, startIndex + DETAIL_LIST_PER_PAGE);

                        return (
                            <div className="border-t border-white/10 pt-8">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    {CATEGORIES.find(c => c.id === selectedPost.category)?.icon} {CATEGORIES.find(c => c.id === selectedPost.category)?.name} 게시판
                                    <span className="text-sm font-normal text-slate-500">({filteredPosts.length}개)</span>
                                </h3>

                                {/* Post List - Card Style */}
                                {filteredPosts.length > 0 ? (
                                    <div key={`list-${selectedPost.id}-${detailListPage}`} className="space-y-2">
                                        {paginatedPosts.map((post) => (
                                            <motion.div
                                                key={post.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.2 }}
                                                onClick={() => {
                                                    setSelectedPost(post);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="bg-slate-900/30 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 hover:bg-slate-900/50 transition-all group rounded-lg p-4 cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    {/* Left: Title and Meta */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                                                                {post.title}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                                    {(post.author.name || post.author.username)?.[0]?.toUpperCase()}
                                                                </div>
                                                                {post.author.name || post.author.username}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                                            {post.category === 'MARKET' && post.price && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-green-400 font-semibold">₩{post.price.toLocaleString()}</span>
                                                                </>
                                                            )}
                                                            {post.category === 'MEETUP' && post.meetupLocation && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-purple-400 flex items-center gap-1">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {post.meetupLocation}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right: Stats */}
                                                    <div className="flex items-center gap-4 text-slate-500 text-xs shrink-0">
                                                        <span className="flex items-center gap-1 hover:text-red-400 transition-colors">
                                                            <Heart className="w-3.5 h-3.5" />
                                                            <span className="font-medium">{post._count.likes}</span>
                                                        </span>
                                                        <span className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                            <span className="font-medium">{post._count.comments}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500">
                                        이 게시판에 다른 게시글이 없습니다.
                                    </div>
                                )}

                                {/* Pagination */}
                                {detailTotalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-6">
                                        {/* Previous Button */}
                                        <button
                                            onClick={() => setDetailListPage(prev => Math.max(1, prev - 1))}
                                            disabled={detailListPage === 1}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                detailListPage === 1
                                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                                    : 'bg-slate-800/50 text-white hover:bg-slate-700 border border-white/10 hover:border-blue-500/50'
                                            }`}
                                        >
                                            이전
                                        </button>

                                        {/* Page Numbers */}
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: detailTotalPages }, (_, i) => i + 1).map((page) => {
                                                const showPage =
                                                    page === 1 ||
                                                    page === detailTotalPages ||
                                                    (page >= detailListPage - 1 && page <= detailListPage + 1);

                                                const showEllipsisBefore = page === detailListPage - 2 && detailListPage > 3;
                                                const showEllipsisAfter = page === detailListPage + 2 && detailListPage < detailTotalPages - 2;

                                                if (showEllipsisBefore || showEllipsisAfter) {
                                                    return (
                                                        <span key={page} className="px-2 text-slate-500 text-sm">
                                                            ...
                                                        </span>
                                                    );
                                                }

                                                if (!showPage) return null;

                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => setDetailListPage(page)}
                                                        className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all ${
                                                            detailListPage === page
                                                                ? 'bg-blue-600 text-white border border-blue-500'
                                                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/10 hover:border-blue-500/50'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Next Button */}
                                        <button
                                            onClick={() => setDetailListPage(prev => Math.min(detailTotalPages, prev + 1))}
                                            disabled={detailListPage === detailTotalPages}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                detailListPage === detailTotalPages
                                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                                    : 'bg-slate-800/50 text-white hover:bg-slate-700 border border-white/10 hover:border-blue-500/50'
                                            }`}
                                        >
                                            다음
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
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

                {/* No Posts */}
                {posts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">📝</div>
                        <h3 className="text-xl font-bold text-white mb-2">아직 게시글이 없습니다</h3>
                        <p className="text-slate-400">첫 번째 글을 기다리고 있어요!</p>
                    </div>
                )}

            {/* Featured Post */}
            {featuredPost && (
                <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="relative rounded-xl md:rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 p-4 md:p-8 group cursor-pointer"
                    onClick={() => setSelectedPost(featuredPost)}
                >
                        <div className="flex items-start justify-between gap-3 md:gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
                                    <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium border ${CATEGORY_COLORS[featuredPost.category] || CATEGORY_COLORS.FREE}`}>
                                        {CATEGORIES.find(c => c.id === featuredPost.category)?.icon} {CATEGORIES.find(c => c.id === featuredPost.category)?.name || '자유게시판'}
                                    </span>
                                    <span className="text-slate-500 text-[10px] md:text-sm">
                                        {formatDistanceToNow(new Date(featuredPost.createdAt), { addSuffix: true, locale: ko })}
                                    </span>
                                </div>
                                <h3 className="text-base md:text-3xl font-bold text-white mb-3 md:mb-6 group-hover:text-blue-400 transition-colors line-clamp-2">
                                    {featuredPost.title}
                                </h3>

                                {/* Special badges */}
                                <div className="flex flex-wrap gap-2 md:gap-3 mb-3 md:mb-6">
                                    {featuredPost.category === 'MARKET' && featuredPost.price && (
                                        <span className="inline-flex items-center gap-1 text-green-400 bg-green-900/30 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold">
                                            <DollarSign className="w-3 h-3 md:w-4 md:h-4" /> ₩{featuredPost.price.toLocaleString()}
                                        </span>
                                    )}
                                    {featuredPost.category === 'MEETUP' && featuredPost.meetupLocation && (
                                        <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-900/30 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm">
                                            <MapPin className="w-3 h-3 md:w-4 md:h-4" /> {featuredPost.meetupLocation}
                                        </span>
                                    )}
                                    {featuredPost.category === 'MEETUP' && featuredPost.meetupDate && (
                                        <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-900/30 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-sm">
                                            <Calendar className="w-3 h-3 md:w-4 md:h-4" /> {format(new Date(featuredPost.meetupDate), 'M/d HH:mm')}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 md:gap-6">
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                        <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-700 rounded-full flex items-center justify-center text-[10px] md:text-sm font-bold text-white">
                                            {(featuredPost.author.name || featuredPost.author.username)?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium text-xs md:text-base">{featuredPost.author.name || featuredPost.author.username}</span>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 text-slate-500 text-[10px] md:text-sm">
                                        <span className="flex items-center gap-1">
                                            <Heart className="w-3 h-3 md:w-4 md:h-4" /> {featuredPost._count.likes}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3 md:w-4 md:h-4" /> {featuredPost._count.comments}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 md:w-6 md:h-6 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-2 transition-all flex-shrink-0" />
                        </div>
                    </motion.div>
            )}

            {/* Recent Posts List */}
            {recentPosts.length > 0 && (
                <div className="space-y-1.5 md:space-y-2">
                    {recentPosts.map((post) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setSelectedPost(post)}
                            className="bg-slate-900/30 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 hover:bg-slate-900/50 transition-all group rounded-lg p-3 md:p-4 cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-2 md:gap-4">
                                {/* Left: Title and Meta */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                        <h3 className="text-sm md:text-base font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                                            {post.title}
                                        </h3>
                                        <div className={`px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] border shrink-0 ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.FREE}`}>
                                            {CATEGORIES.find(c => c.id === post.category)?.icon} {CATEGORIES.find(c => c.id === post.category)?.name}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <div className="w-4 h-4 md:w-5 md:h-5 bg-slate-800 rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold text-slate-400">
                                                {(post.author.name || post.author.username)?.[0]?.toUpperCase()}
                                            </div>
                                            <span className="hidden md:inline">{post.author.name || post.author.username}</span>
                                        </span>
                                        <span className="hidden md:inline">•</span>
                                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                        {post.category === 'MARKET' && post.price && (
                                            <>
                                                <span>•</span>
                                                <span className="text-green-400 font-semibold">₩{post.price.toLocaleString()}</span>
                                            </>
                                        )}
                                        {post.category === 'MEETUP' && post.meetupLocation && (
                                            <>
                                                <span className="hidden md:inline">•</span>
                                                <span className="text-purple-400 hidden md:flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {post.meetupLocation}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Stats */}
                                <div className="flex items-center gap-2 md:gap-4 text-slate-500 text-[10px] md:text-xs shrink-0">
                                    <span className="flex items-center gap-0.5 md:gap-1 hover:text-red-400 transition-colors">
                                        <Heart className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        <span className="font-medium">{post._count.likes}</span>
                                    </span>
                                    <span className="flex items-center gap-0.5 md:gap-1 hover:text-blue-400 transition-colors">
                                        <MessageCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        <span className="font-medium">{post._count.comments}</span>
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                        {/* Previous Button */}
                        <button
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === 1}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                currentPage === 1
                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800/50 text-white hover:bg-slate-700 border border-white/10 hover:border-blue-500/50'
                            }`}
                        >
                            이전
                        </button>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                // Show first page, last page, current page, and pages around current
                                const showPage =
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1);

                                // Show ellipsis
                                const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                                const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                                if (showEllipsisBefore || showEllipsisAfter) {
                                    return (
                                        <span key={page} className="px-2 text-slate-500">
                                            ...
                                        </span>
                                    );
                                }

                                if (!showPage) return null;

                                return (
                                    <button
                                        key={page}
                                        onClick={() => {
                                            setCurrentPage(page);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className={`min-w-[40px] h-10 rounded-lg font-medium transition-all ${
                                            currentPage === page
                                                ? 'bg-blue-600 text-white border border-blue-500'
                                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/10 hover:border-blue-500/50'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === totalPages}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                currentPage === totalPages
                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800/50 text-white hover:bg-slate-700 border border-white/10 hover:border-blue-500/50'
                            }`}
                        >
                            다음
                        </button>
                    </div>
                )}

                {/* Call to Action */}
                <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-white/10">
                    <CardContent className="p-4 md:p-8 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
                        <div>
                            <h4 className="text-base md:text-xl font-bold text-white mb-1 md:mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                                매버릭스 팬들과 함께하세요
                            </h4>
                            <p className="text-slate-300 text-xs md:text-base">
                                자유롭게 이야기를 나누고, 굿즈를 거래하고, 모임을 만들어보세요!
                            </p>
                        </div>
                        <button
                            onClick={handleWriteClick}
                            className="px-4 md:px-6 py-2 md:py-3 bg-white text-slate-900 rounded-lg md:rounded-xl font-bold text-sm md:text-base hover:bg-blue-50 transition-colors whitespace-nowrap"
                        >
                            새 글 작성하기
                        </button>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    // Main Layout with Fixed Header
    return (
        <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-8 px-1 md:px-0">
            {/* Fixed Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                <div>
                    <h2 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                        💬 매버릭스 커뮤니티
                        <span className="text-xs md:text-sm font-normal text-slate-400">
                            ({posts.length}개)
                        </span>
                    </h2>
                    <p className="text-slate-400 text-xs md:text-base">댈러스 매버릭스 팬들과의 소통 공간</p>
                </div>
            </div>

            {/* Fixed Category Tabs - Schedule Style */}
            <div className="flex items-center gap-1 md:gap-2 w-full">
                {/* Left Arrow */}
                <button
                    onClick={() => {
                        const currentIndex = CATEGORIES.findIndex(c => c.id === selectedCategory);
                        if (currentIndex > 0) {
                            handleCategoryChange(CATEGORIES[currentIndex - 1].id);
                        }
                    }}
                    disabled={CATEGORIES.findIndex(c => c.id === selectedCategory) === 0}
                    className={`flex-shrink-0 p-1.5 md:p-2 rounded-full transition-all duration-200 ${
                        CATEGORIES.findIndex(c => c.id === selectedCategory) > 0
                            ? 'bg-white/10 text-white hover:bg-blue-600/50 active:scale-95'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>

                {/* Category Pills - Scrollable */}
                <div
                    className="flex-1 overflow-x-auto scrollbar-hide"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl w-max mx-auto">
                        {CATEGORIES.map((category) => (
                            <motion.button
                                key={category.id}
                                onClick={() => handleCategoryChange(category.id)}
                                whileTap={{ scale: 0.95 }}
                                className={`relative flex items-center gap-1 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                                    selectedCategory === category.id
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {selectedCategory === category.id && (
                                    <motion.div
                                        layoutId="activeCategory"
                                        className="absolute inset-0 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                                <span className="relative z-10">{category.icon}</span>
                                <span className="relative z-10">{category.name}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => {
                        const currentIndex = CATEGORIES.findIndex(c => c.id === selectedCategory);
                        if (currentIndex < CATEGORIES.length - 1) {
                            handleCategoryChange(CATEGORIES[currentIndex + 1].id);
                        }
                    }}
                    disabled={CATEGORIES.findIndex(c => c.id === selectedCategory) === CATEGORIES.length - 1}
                    className={`flex-shrink-0 p-1.5 md:p-2 rounded-full transition-all duration-200 ${
                        CATEGORIES.findIndex(c => c.id === selectedCategory) < CATEGORIES.length - 1
                            ? 'bg-white/10 text-white hover:bg-blue-600/50 active:scale-95'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
            </div>

            {/* Dynamic Content Area */}
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>

            {/* Submitting Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900/90 border border-white/10 rounded-xl p-8 flex flex-col items-center gap-4">
                        <MavericksLoading fullScreen={false} />
                        <p className="text-white text-lg font-medium">게시글을 등록하고 있습니다...</p>
                        <p className="text-slate-400 text-sm">잠시만 기다려주세요</p>
                    </div>
                </div>
            )}
        </div>
    );
}
