'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Trophy, UserPlus, Search, Users } from 'lucide-react';
import Link from 'next/link';

interface Member {
    id: string;
    name: string;
    username: string;
    role: string;
    posts: number;
    image: string | null;
    createdAt: string;
}

export default function MembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const response = await fetch('/api/community/members');
            if (response.ok) {
                const data = await response.json();
                setMembers(data.members || []);
            }
        } catch (error) {
            console.error('Failed to fetch members:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = members.filter(member =>
        member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const topContributors = [...filteredMembers]
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 10);

    const newMembers = [...filteredMembers]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    return (
        <div className="min-h-screen relative bg-[#050510]">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto pt-24 px-4 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4 text-white">
                        <Link href="/?tab=community">
                            <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">커뮤니티 멤버</h1>
                            <p className="text-slate-400 text-sm">함께 활동하는 MFFL을 만나보세요</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="멤버 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900/50 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-64 backdrop-blur-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : members.length === 0 ? (
                    <div className="text-center py-20">
                        <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">아직 등록된 멤버가 없습니다.</p>
                        <p className="text-slate-500 text-sm mt-2">첫 번째 멤버가 되어보세요!</p>
                        <Link href="/login">
                            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">회원가입</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Ranking Column */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-xl font-bold text-white">활동 랭킹</h2>
                            </div>

                            <div className="grid gap-4">
                                {topContributors.map((member, index) => (
                                    <Card key={member.id} className="bg-slate-900/50 backdrop-blur-xl border-white/10 hover:border-blue-500/30 transition-all">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900 ${
                                                index === 0 ? 'bg-yellow-400 shadow-lg shadow-yellow-500/50' :
                                                index === 1 ? 'bg-slate-300 shadow-lg shadow-slate-400/50' :
                                                index === 2 ? 'bg-amber-600 shadow-lg shadow-amber-600/50' : 'bg-slate-700 text-white'
                                            }`}>
                                                {index + 1}
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border border-white/10 overflow-hidden">
                                                {member.image ? (
                                                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-white">{member.name?.charAt(0) || 'U'}</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white">{member.name || member.username}</h3>
                                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20">{member.role}</span>
                                                </div>
                                                <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                                    <span>📝 게시글 {member.posts}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* New Members Side */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <UserPlus className="w-5 h-5 text-green-400" />
                                <h2 className="text-xl font-bold text-white">신규 멤버</h2>
                            </div>

                            <Card className="bg-slate-900/50 backdrop-blur-xl border-white/10">
                                <CardContent className="p-4 space-y-4">
                                    {newMembers.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/5 overflow-hidden">
                                                {member.image ? (
                                                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="font-bold text-slate-400">{member.name?.charAt(0) || 'U'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{member.name || member.username}</p>
                                                <p className="text-xs text-slate-500">
                                                    가입일: {new Date(member.createdAt).toLocaleDateString('ko-KR')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-white/10 text-center backdrop-blur-sm">
                                <p className="text-slate-300 mb-4">아직 회원이 아니신가요?</p>
                                <Link href="/login">
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/50">로그인 / 회원가입</Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
