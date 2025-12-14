'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send, MapPin, Calendar, DollarSign } from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { useAuth } from '@/contexts/AuthContext';
import { createCommunityPost } from '@/app/actions/community';

const CATEGORIES = [
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

function NewCommunityForm() {
    const router = useRouter();
    const { user, session, loading } = useAuth();

    const [category, setCategory] = useState('FREE');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('');
    const [meetupLocation, setMeetupLocation] = useState('');
    const [meetupDate, setMeetupDate] = useState('');
    const [meetupPurpose, setMeetupPurpose] = useState('DRINK');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        if (category === 'MARKET' && !price) {
            alert('가격을 입력해주세요.');
            return;
        }

        if (category === 'MEETUP' && (!meetupLocation || !meetupDate)) {
            alert('모임 장소와 날짜를 입력해주세요.');
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            formData.append('category', category);
            
            if (category === 'MARKET') {
                formData.append('price', price);
            }
            
            if (category === 'MEETUP') {
                formData.append('meetupLocation', meetupLocation);
                formData.append('meetupDate', meetupDate);
                formData.append('meetupPurpose', meetupPurpose);
            }

            await createCommunityPost(formData, session?.access_token);
            router.push('/?tab=community');
        } catch (error) {
            console.error(error);
            alert('작성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen bg-[#050510] pt-24 text-center text-white">Loading...</div>;
    }

    const selectedCategory = CATEGORIES.find(c => c.id === category);

    return (
        <div className="min-h-screen relative bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0 fixed">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto pt-24 px-4 pb-12">
                {/* Header */}
                <div className="flex items-center gap-4 text-white mb-6">
                    <Button
                        variant="ghost"
                        size="md"
                        className="hover:bg-white/10 text-white p-2 w-10"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">
                        커뮤니티 글쓰기
                    </h1>
                </div>

                {/* Editor Card */}
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-3">카테고리 선택</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`p-4 rounded-xl border transition-all text-left ${
                                                category === cat.id
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
                                        category === 'MARKET' ? '[판매] 또는 [구매]로 시작해주세요' :
                                        category === 'MEETUP' ? '모임 제목을 입력하세요' :
                                        '제목을 입력하세요'
                                    }
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                                />
                            </div>

                            {/* Market: Price */}
                            {category === 'MARKET' && (
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
                            {category === 'MEETUP' && (
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

                            {/* Content */}
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
                                    onClick={() => router.back()}
                                >
                                    취소
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8" disabled={isSubmitting}>
                                    <Send className="w-4 h-4 mr-2" />
                                    {selectedCategory?.icon} {selectedCategory?.name} 등록
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function NewCommunityPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050510] pt-24 text-center text-white">Loading...</div>}>
            <NewCommunityForm />
        </Suspense>
    );
}

