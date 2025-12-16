# Supabase 구글 로그인 설정 가이드

## 🔍 현재 문제
- Auth event: SIGNED_OUT
- Auth event: INITIAL_SESSION
- 구글 로그인이 작동하지 않음

## ✅ Supabase Dashboard 설정 확인

### 1. Google OAuth 설정 확인

**Supabase Dashboard → Authentication → Providers → Google**

다음 항목을 확인하세요:

1. **Google provider가 활성화되어 있는지 확인**
   - Enabled 토글이 켜져 있어야 함

2. **Client ID와 Client Secret 설정**
   - Google Cloud Console에서 발급받은 값이 입력되어 있어야 함

### 2. Redirect URLs 설정

**Supabase Dashboard → Authentication → URL Configuration**

다음 URL들이 추가되어 있어야 합니다:

```
Redirect URLs (허용된 리다이렉트 URL):
- https://www.mavs.kr/auth/callback
- https://mavs.kr/auth/callback
- http://localhost:3000/auth/callback (로컬 테스트용)
```

### 3. Site URL 설정

**Supabase Dashboard → Authentication → URL Configuration**

```
Site URL: https://www.mavs.kr
```

---

## 🔧 Google Cloud Console 설정

### 1. OAuth 2.0 클라이언트 ID 생성

**Google Cloud Console → APIs & Services → Credentials**

1. **Create Credentials** → **OAuth client ID** 클릭
2. **Application type**: Web application
3. **Name**: MAVS.KR (원하는 이름)

### 2. Authorized redirect URIs 추가

```
승인된 리디렉션 URI:
- https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
- http://localhost:3000/auth/callback (로컬 테스트용)
```

**중요**: `[YOUR-PROJECT-REF]`는 Supabase Dashboard → Settings → API 에서 확인 가능합니다.

예시: `https://abcdefghijk.supabase.co/auth/v1/callback`

### 3. Client ID와 Secret 복사

생성 후 나오는 **Client ID**와 **Client Secret**을 복사하여 Supabase에 입력합니다.

---

## 📋 체크리스트

로그인이 작동하지 않으면 다음을 확인하세요:

- [ ] Supabase에서 Google provider가 활성화되어 있음
- [ ] Google Cloud Console에서 OAuth 2.0 클라이언트 ID가 생성됨
- [ ] Google Cloud Console의 승인된 리디렉션 URI에 Supabase callback URL이 추가됨
- [ ] Supabase에 Google Client ID와 Secret이 입력됨
- [ ] Supabase Redirect URLs에 `https://www.mavs.kr/auth/callback`가 추가됨
- [ ] Supabase Site URL이 `https://www.mavs.kr`로 설정됨
- [ ] Vercel 환경변수가 올바르게 설정됨:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🐛 디버깅

브라우저 콘솔에서 다음 로그를 확인:

```javascript
// 로그인 시작
Starting Google sign in...
Redirect URL: https://www.mavs.kr/auth/callback
Supabase URL: https://[your-project].supabase.co

// 로그인 성공 시
OAuth redirect initiated: { provider: 'google', url: '...' }

// 로그인 실패 시
Google sign in error: { message: '...' }
```

---

## 🔗 참고 링크

- [Supabase Google OAuth 문서](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
