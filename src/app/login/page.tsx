'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect');
    const error = searchParams.get('error');
    const errorMessage = searchParams.get('message') || searchParams.get('description');

    useEffect(() => {
        if (!loading && user) {
            // 로그인 성공 시 redirect 파라미터가 있으면 해당 페이지로, 없으면 홈으로
            router.push(redirect || '/');
        }
    }, [user, loading, router, redirect]);

    useEffect(() => {
        // Display error message if present
        if (error) {
            const errorMessages: Record<string, string> = {
                'auth_failed': '로그인에 실패했습니다. 다시 시도해주세요.',
                'config_error': 'Supabase 설정이 올바르지 않습니다. 관리자에게 문의하세요.',
                'access_denied': '로그인이 취소되었습니다.',
            };
            const displayMessage = errorMessages[error] || errorMessage || '알 수 없는 오류가 발생했습니다.';
            alert(`❌ ${displayMessage}`);
        }
    }, [error, errorMessage]);

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('Login failed:', error);
            alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };

    // redirect 파라미터에 따른 메시지
    const getMessage = () => {
        if (redirect?.includes('/column')) {
            return {
                title: '컬럼을 읽으려면 로그인이 필요합니다',
                description: '매버릭스 전문가들의 심도 있는 분석과 칼럼을 확인하세요.',
                icon: '📰'
            };
        }
        if (redirect?.includes('/community')) {
            return {
                title: '커뮤니티 글을 작성하려면 로그인이 필요합니다',
                description: '매버릭스 팬들과 함께 이야기를 나눠보세요.',
                icon: '✍️'
            };
        }
        return {
            title: '매버릭스 팬 커뮤니티에 오신 것을 환영합니다',
            description: '로그인하고 다양한 콘텐츠를 즐기세요.',
            icon: '🏀'
        };
    };

    const message = getMessage();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050510] flex items-center justify-center px-4">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050510] to-[#050510]"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-block">
                            <h1 className="text-3xl font-bold text-white">MAVS.KR</h1>
                        </Link>
                        <p className="text-slate-400 mt-2">댈러스 매버릭스 팬 커뮤니티</p>
                    </div>

                    {/* Login Message */}
                    <div className="mb-8 text-center bg-blue-600/10 border border-blue-500/20 rounded-xl p-6">
                        <div className="text-4xl mb-3">{message.icon}</div>
                        <h2 className="text-xl font-bold text-white mb-2">{message.title}</h2>
                        <p className="text-slate-400 text-sm">{message.description}</p>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fillOpacity="0.7"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fillOpacity="0.8"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fillOpacity="0.6"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fillOpacity="0.9"
                            />
                        </svg>
                        <span>Google 계정으로 로그인</span>
                    </button>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-[1px] bg-white/10"></div>
                        <span className="text-slate-500 text-sm">또는</span>
                        <div className="flex-1 h-[1px] bg-white/10"></div>
                    </div>

                    {/* Additional Info */}
                    <p className="text-center text-slate-500 text-sm">
                        로그인하면 MAVS.KR의{' '}
                        <Link href="/terms" className="text-blue-400 hover:underline">
                            이용약관
                        </Link>
                        {' '}및{' '}
                        <Link href="/privacy" className="text-blue-400 hover:underline">
                            개인정보처리방침
                        </Link>
                        에 동의하게 됩니다.
                    </p>

                    {/* Back to Home */}
                    <div className="mt-8 text-center">
                        <Link
                            href="/"
                            className="text-slate-400 hover:text-white transition-colors text-sm"
                        >
                            ← 홈으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
