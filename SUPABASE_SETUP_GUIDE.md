# Supabase 구글 로그인 설정 가이드

## 🚨 중요: 로그인이 안 될 때 체크리스트

### 1️⃣ Supabase Dashboard - Google Provider 설정

**위치:** Supabase Dashboard → Authentication → Providers → Google

**필수 설정:**
1. ✅ **"Enable Sign in with Google"** 토글을 **ON**
2. ✅ **Client ID (for OAuth)** 입력
3. ✅ **Client Secret (for OAuth)** 입력
4. ✅ **Save** 버튼 클릭

---

### 2️⃣ Supabase Dashboard - URL Configuration

**위치:** Supabase Dashboard → Authentication → URL Configuration

**Site URL 설정:**
```
https://www.mavs.kr
```

**Redirect URLs 설정 (각각 추가):**
```
https://www.mavs.kr/auth/callback
https://www.mavs.kr/*
http://localhost:3000/auth/callback
http://localhost:3030/auth/callback
```

⚠️ **중요:** 각 URL을 하나씩 입력하고 Enter 또는 Add 버튼 클릭

---

### 3️⃣ Google Cloud Console - OAuth 2.0 설정

#### A. OAuth 동의 화면 설정

**위치:** Google Cloud Console → APIs & Services → OAuth consent screen

1. **앱 이름**: MAVS.KR
2. **사용자 지원 이메일**: mavsdotkr@gmail.com
3. **승인된 도메인** 추가:
   ```
   mavs.kr
   supabase.co
   ```
4. **저장 후 계속**

#### B. OAuth 2.0 클라이언트 ID 생성

**위치:** Google Cloud Console → APIs & Services → Credentials

**1. "CREATE CREDENTIALS" → "OAuth client ID" 클릭**

**2. 애플리케이션 유형:** 웹 애플리케이션

**3. 승인된 자바스크립트 원본:**
```
https://www.mavs.kr
https://<your-project-id>.supabase.co
```

**예시:**
```
https://www.mavs.kr
https://abcdefghijklmnop.supabase.co
```

**4. 승인된 리디렉션 URI:**
```
https://<your-project-id>.supabase.co/auth/v1/callback
```

**예시:**
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```

⚠️ **주의:** `<your-project-id>`를 실제 Supabase 프로젝트 ID로 교체!

**5. 생성 후:**
- Client ID 복사 → Supabase Google Provider에 붙여넣기
- Client Secret 복사 → Supabase Google Provider에 붙여넣기

---

### 4️⃣ Vercel 환경 변수 확인

**위치:** Vercel Dashboard → Project → Settings → Environment Variables

**필수 환경 변수:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
```

**각 환경에 적용 (모두 체크):**
- ✅ Production
- ✅ Preview
- ✅ Development

**환경 변수 추가/수정 후:**
- Deployments → 최근 배포 → Redeploy 버튼 클릭

---

## 🔍 문제 진단 방법

### 브라우저 콘솔 확인 (F12 → Console)

**로그인 버튼 클릭 후 나타나야 할 로그:**

```
[SignIn] Starting Google sign in...
[SignIn] Redirect URL: https://www.mavs.kr/auth/callback
[SignIn] Supabase URL: https://xxxxx.supabase.co
[SignIn] OAuth redirect initiated
[SignIn] Provider: google
[SignIn] URL: https://accounts.google.com/...
```

**문제 발생 시 나타나는 로그:**

1. **"Supabase URL: not set"**
   → Vercel 환경 변수 미설정

2. **"Supabase URL: https://placeholder.supabase.co"**
   → .env.local 파일 없거나 Vercel 환경 변수 미설정

3. **"Google sign in error: ..."**
   → Google OAuth 설정 문제 또는 Redirect URL 불일치

4. **"Auth event: SIGNED_OUT" 반복**
   → auth/callback 처리 실패 또는 데이터베이스 문제

---

## 🐛 일반적인 문제와 해결 방법

### 문제 1: "Supabase URL이 placeholder로 표시"
**해결:**
- Vercel 환경 변수 설정
- 배포 후 Redeploy

### 문제 2: "Google 로그인 창이 안 뜸"
**해결:**
- Google Cloud Console에서 OAuth 클라이언트 ID 확인
- Supabase Provider 설정 확인
- Client ID, Secret이 올바르게 입력되었는지 확인

### 문제 3: "로그인 후 바로 로그아웃됨"
**해결:**
1. Supabase SQL Editor에서 `SUPABASE_MIGRATION.sql` 실행
2. User 테이블이 생성되었는지 확인
3. auth/callback 로그 확인

### 문제 4: "redirect_uri_mismatch 에러"
**해결:**
- Google Cloud Console의 승인된 리디렉션 URI 확인
- 정확히 다음 형식이어야 함:
  ```
  https://<project-id>.supabase.co/auth/v1/callback
  ```

---

## ✅ 모든 설정 완료 체크리스트

- [ ] Supabase Google Provider 활성화
- [ ] Google OAuth Client ID/Secret 입력
- [ ] Supabase Redirect URLs 설정
- [ ] Google Cloud Console OAuth 설정
- [ ] Vercel 환경 변수 설정
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 브라우저 콘솔에서 로그 확인

---

## 💡 테스트 방법

1. **로컬 테스트:**
   ```bash
   npm run dev
   ```
   - http://localhost:3000/login 접속
   - 구글 로그인 버튼 클릭
   - F12 콘솔 로그 확인

2. **프로덕션 테스트:**
   - https://www.mavs.kr/login 접속
   - 구글 로그인 버튼 클릭
   - F12 콘솔 로그 확인

---

## 📞 도움이 필요하면

다음 정보를 제공해주세요:
1. 브라우저 콘솔 로그 (F12 → Console 전체 복사)
2. Supabase URL (placeholder인지 실제 URL인지)
3. 에러 메시지 (있다면)
4. auth/callback 페이지 URL 파라미터

이 정보로 정확한 원인을 파악할 수 있습니다!
