import { NextResponse } from 'next/server';
import { authenticate, database, failure, jsonBody, requireData } from '@/lib/matzip/server';
import { topBlog } from '@/lib/matzip/providers';
import { MatzipError, textField } from '@/lib/matzip/validation';

export async function GET(request: Request) {
  try {
    await authenticate(request, true);
    const { data, error } = await database(true).from('matzip_submissions').select('*').eq('status', 'pending').order('created_at').limit(200);
    requireData(error);
    return NextResponse.json({ submissions: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await authenticate(request, true);
    const body = await jsonBody(request);
    const id = textField(body.id, '신청 번호', 36);
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new MatzipError('신청 번호를 확인해 주세요.');
    if (body.action !== 'approve' && body.action !== 'reject') throw new MatzipError('처리 방법을 확인해 주세요.');
    const note = textField(body.review_note ?? '', '검토 사유', 1000, body.action === 'reject');
    const db = database(true);
    const { data: submission, error: readError } = await db.from('matzip_submissions').select('name,address,status').eq('id', id).maybeSingle();
    requireData(readError);
    if (!submission) throw new MatzipError('신청을 찾을 수 없습니다.', 404);
    if (submission.status !== 'pending') throw new MatzipError('이미 처리된 신청입니다.', 409);
    const blog = body.action === 'approve' ? await topBlog(submission.name, submission.address) : { blog_url: null, blog_title: null };
    const { error } = await db.rpc('matzip_review', { p_actor: user.id, p_id: id, p_action: body.action, p_note: note, p_blog_url: blog.blog_url, p_blog_title: blog.blog_title });
    if (error?.code === 'P0002') throw new MatzipError('이미 처리된 신청입니다.', 409);
    requireData(error);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
