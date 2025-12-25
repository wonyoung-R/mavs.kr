import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import AnalysisEditor from '@/components/analysis/AnalysisEditor';

export default async function NewAnalysisPage() {
  // Check authentication and authorization
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login?redirect=/analysis/new');
  }

  // Check if user is admin or columnist
  const dbUser = await prisma.user.findUnique({
    where: { email: data.user.email! },
  });

  if (!dbUser || !['ADMIN', 'COLUMNIST'].includes(dbUser.role)) {
    redirect('/analysis');
  }

  return (
    <div className="min-h-screen w-full bg-[#050510] relative text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#050510] to-[#050510]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-12">
        <AnalysisEditor />
      </div>
    </div>
  );
}

