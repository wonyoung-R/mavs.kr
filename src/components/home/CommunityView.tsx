'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MessageCircle, Heart, MapPin, Calendar, ArrowRight, Users, DollarSign, ArrowLeft, Send, Image as ImageIcon, Link as LinkIcon, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MavericksLoading from '@/components/ui/MavericksLoading';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createCommunityPost } from '@/app/actions/community';

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

    const fetchPosts = async (category: string) => {
        try {
            const query = category === 'all' ? '' : `?category=${category}`;
            const response = await fetch(`/api/community${query}`);
            const data = await response.json();
            setPosts(data.posts || []);
        } catch (err) {
            console.error('Failed to load community posts:', err);
        }
    };

    useEffect(() => {
        setLoading(true);
        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 1500));

        Promise.all([fetchPosts(selectedCategory), minLoadingTime]).then(() => {
            setLoading(false);
        });
    }, [selectedCategory]);

    const handleCategoryChange = (categoryId: string) => {
        setSelectedCategory(categoryId);
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

    const featuredPost = posts[0];
    const recentPosts = posts.slice(1, 7);

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
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

    // Main List View
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-6xl mx-auto space-y-8"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Community</h2>
                    <p className="text-slate-400">댈러스 매버릭스 팬들과의 소통 공간</p>
                </div>
                <button
                    onClick={handleWriteClick}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                >
                    ✍️ 글쓰기
                </button>
            </div>

            {/* Category Tabs */}
            <div className="flex overflow-x-auto pb-4 gap-2 custom-scrollbar">
                {CATEGORIES.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => handleCategoryChange(category.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all border ${
                            selectedCategory === category.id
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-900/50 border-white/10 text-slate-400 hover:border-blue-500/50 hover:text-white'
                        }`}
                    >
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                    </button>
                ))}
            </div>

            {/* No Posts */}
            {posts.length === 0 && (
                <div className="text-center py-20">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-bold text-white mb-2">아직 게시글이 없습니다</h3>
                    <p className="text-slate-400 mb-6">첫 번째 글을 작성해보세요!</p>
                    <button
                        onClick={handleWriteClick}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                    >
                        글쓰기
                    </button>
                </div>
            )}

            {/* Featured Post */}
            {featuredPost && (
                <Link href={`/community/${featuredPost.id}`}>
                    <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 p-8 group cursor-pointer"
                    >
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[featuredPost.category] || CATEGORY_COLORS.FREE}`}>
                                        {CATEGORIES.find(c => c.id === featuredPost.category)?.icon} {CATEGORIES.find(c => c.id === featuredPost.category)?.name || '자유게시판'}
                                    </span>
                                    <span className="text-slate-500 text-sm">
                                        {formatDistanceToNow(new Date(featuredPost.createdAt), { addSuffix: true, locale: ko })}
                                    </span>
                                </div>
                                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                                    {featuredPost.title}
                                </h3>
                                <p className="text-slate-400 text-lg line-clamp-2 mb-6">
                                    {getTextSummary(featuredPost.content, 150)}
                                </p>

                                {/* Special badges */}
                                <div className="flex flex-wrap gap-3 mb-6">
                                    {featuredPost.category === 'MARKET' && featuredPost.price && (
                                        <span className="inline-flex items-center gap-1 text-green-400 bg-green-900/30 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <DollarSign className="w-4 h-4" /> ₩{featuredPost.price.toLocaleString()}
                                        </span>
                                    )}
                                    {featuredPost.category === 'MEETUP' && featuredPost.meetupLocation && (
                                        <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-900/30 px-3 py-1.5 rounded-lg text-sm">
                                            <MapPin className="w-4 h-4" /> {featuredPost.meetupLocation}
                                        </span>
                                    )}
                                    {featuredPost.category === 'MEETUP' && featuredPost.meetupDate && (
                                        <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-900/30 px-3 py-1.5 rounded-lg text-sm">
                                            <Calendar className="w-4 h-4" /> {format(new Date(featuredPost.meetupDate), 'M/d HH:mm')}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-white">
                                            {featuredPost.author.username?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium">{featuredPost.author.username}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-500 text-sm">
                                        <span className="flex items-center gap-1">
                                            <Heart className="w-4 h-4" /> {featuredPost._count.likes}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageCircle className="w-4 h-4" /> {featuredPost._count.comments}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-2 transition-all flex-shrink-0" />
                        </div>
                    </motion.div>
                </Link>
            )}

            {/* Recent Posts Grid */}
            {recentPosts.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recentPosts.map((post) => (
                        <Link key={post.id} href={`/community/${post.id}`}>
                            <Card className="h-full bg-slate-900/50 border-white/10 hover:border-blue-500/50 transition-all group cursor-pointer">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-medium px-2 py-1 rounded border ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.FREE}`}>
                                            {CATEGORIES.find(c => c.id === post.category)?.icon}
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

                                    {/* Special badges */}
                                    {post.category === 'MARKET' && post.price && (
                                        <div className="mb-3 text-green-400 font-bold text-sm">
                                            ₩{post.price.toLocaleString()}
                                        </div>
                                    )}
                                    {post.category === 'MEETUP' && post.meetupLocation && (
                                        <div className="mb-3 text-purple-400 text-xs flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {post.meetupLocation}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-sm text-slate-500">
                                        <span className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-600" />
                                            {post.author.username}
                                        </span>
                                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ko })}</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Heart className="w-3 h-3" /> {post._count.likes}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3" /> {post._count.comments}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Call to Action */}
            <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-white/10">
                <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Users className="w-5 h-5 text-purple-400" />
                            매버릭스 팬들과 함께하세요
                        </h4>
                        <p className="text-slate-300">
                            자유롭게 이야기를 나누고, 굿즈를 거래하고, 오프라인 모임을 만들어보세요!
                        </p>
                    </div>
                    <button
                        onClick={handleWriteClick}
                        className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                        새 글 작성하기
                    </button>
                </CardContent>
            </Card>
        </motion.div>
    );
}
