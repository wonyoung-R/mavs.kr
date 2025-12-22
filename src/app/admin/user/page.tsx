'use client';

import { useEffect, useState } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { supabase } from '@/lib/db/supabase';
import { User, Edit2, Check, X, Search } from 'lucide-react';

interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: UserRole;
    created_at: string;
}

export default function AdminUserPage() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('user');
    const [searchQuery, setSearchQuery] = useState('');

    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => {
        if (isAdmin || isDevelopment) {
            fetchUsers();
        }
    }, [isAdmin, isDevelopment]);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('User')
                .select('id, email, name, image, role, createdAt')
                .order('createdAt', { ascending: false });

            if (error) {
                console.log('User 테이블 조회 실패:', error);
                setUsers([]);
            } else {
                const mappedUsers = (data || []).map((u: any) => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    avatar_url: u.image,
                    role: u.role?.toLowerCase() || 'user',
                    created_at: u.createdAt
                }));
                setUsers(mappedUsers);
            }
        } catch (err) {
            console.log('사용자 목록을 불러올 수 없습니다:', err);
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const updateUserRole = async (userId: string, newRole: UserRole) => {
        try {
            const { error } = await supabase
                .from('User')
                .update({ role: newRole.toUpperCase() })
                .eq('id', userId);

            if (error) {
                console.error('Error updating role:', error);
                alert('권한 변경에 실패했습니다.');
                return;
            }

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setEditingUser(null);
        } catch (err) {
            console.error('Failed to update role:', err);
        }
    };

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case 'admin':
                return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">관리자</span>;
            case 'columnist':
                return <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">컬럼작성자</span>;
            default:
                return <span className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-400">일반유저</span>;
        }
    };

    // Filter users based on search query
    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* User Management */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <User className="w-5 h-5" />
                        사용자 목록 ({users.length}명)
                    </h2>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="이름 또는 이메일 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
                        />
                    </div>
                </div>

                {loadingUsers ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        {searchQuery ? (
                            <p>검색 결과가 없습니다.</p>
                        ) : (
                            <>
                                <p>등록된 사용자가 없습니다.</p>
                                <p className="text-sm mt-2">사용자가 로그인하면 여기에 표시됩니다.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-white/10">
                        {filteredUsers.map((u) => (
                            <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-medium">{u.name || '이름 없음'}</p>
                                        <p className="text-sm text-slate-400">{u.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {editingUser === u.id ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedRole}
                                                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                                className="bg-slate-800 border-2 border-white/10 rounded-lg px-3 py-1.5 text-white text-sm
                                                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                                           cursor-pointer transition-all"
                                            >
                                                <option value="user">일반유저</option>
                                                <option value="columnist">컬럼작성자</option>
                                                <option value="admin">관리자</option>
                                            </select>
                                            <button
                                                onClick={() => updateUserRole(u.id, selectedRole)}
                                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingUser(null)}
                                                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {getRoleBadge(u.role)}
                                            <button
                                                onClick={() => {
                                                    setEditingUser(u.id);
                                                    setSelectedRole(u.role);
                                                }}
                                                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Role Descriptions */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
                <h3 className="text-white font-semibold mb-3">권한 설명</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">관리자</span>
                        <span className="text-slate-400">모든 권한 (사용자 관리, 컨텐츠 삭제 등)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">컬럼작성자</span>
                        <span className="text-slate-400">컬럼 및 뉴스 작성 권한</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 text-xs rounded bg-slate-500/20 text-slate-400">일반유저</span>
                        <span className="text-slate-400">커뮤니티 게시글 및 댓글 작성</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
