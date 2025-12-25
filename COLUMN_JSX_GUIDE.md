# 칼럼에 JSX 차트/시각화 임베딩 가이드

## ✨ 새로운 기능

이제 칼럼 작성 시 **일반 텍스트와 JSX 차트/시각화를 함께** 사용할 수 있습니다!

## 📝 사용 방법

### 1️⃣ 칼럼 작성 페이지 접속

- URL: http://localhost:4000/column/new
- 권한: ADMIN 또는 COLUMNIST

### 2️⃣ 일반 텍스트 작성

TipTap 에디터로 평소처럼 글을 작성합니다:
- **굵게**, *기울임*, ~~취소선~~
- 제목 (H1, H2)
- 목록 (순서 있음/없음)
- 인용구
- 링크, 이미지, YouTube

### 3️⃣ JSX 차트/시각화 삽입

#### 방법:

1. **JSX 파일 준비**
   - 로컬에서 `.jsx` 또는 `.js` 파일 작성
   - 예시: `player-stats.jsx`

```jsx
const Component = () => {
  const data = [
    { name: 'Game 1', points: 28, assists: 8 },
    { name: 'Game 2', points: 32, assists: 6 },
    { name: 'Game 3', points: 25, assists: 10 },
  ];

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
      <h3 className="text-xl font-bold text-white mb-4">
        루카 돈치치 최근 3경기
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="points" stroke="#8b5cf6" strokeWidth={2} />
          <Line type="monotone" dataKey="assists" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

2. **에디터 툴바에서 📊 버튼 클릭**
   - 툴바 우측의 차트 아이콘 (TrendingUp) 클릭
   - 또는 마지막 YouTube 버튼 옆에 있습니다

3. **JSX 파일 선택**
   - 파일 선택 다이얼로그에서 JSX 파일 선택
   - 업로드 즉시 에디터에 플레이스홀더 표시

4. **계속 작성**
   - JSX 블록 앞뒤로 일반 텍스트 계속 작성 가능
   - 여러 개의 JSX 블록 삽입 가능

### 4️⃣ 미리보기

- 에디터에서는 **플레이스홀더**로 표시됩니다:
  ```
  📊 JSX 차트/시각화 블록
  미리보기는 게시 후 확인할 수 있습니다
  ```

- 실제 렌더링은 **게시 후 상세 페이지**에서 확인됩니다

### 5️⃣ 게시

- 제목과 내용 입력 후 **"칼럼 등록"** 클릭
- JSX 코드가 HTML과 함께 저장됩니다

## 🎨 예시 칼럼 구조

```
제목: 루카 돈치치 12월 퍼포먼스 분석

내용:
루카 돈치치는 12월 들어 눈부신 활약을 펼치고 있습니다.
특히 득점과 어시스트에서 시즌 최고 수치를 기록하고 있는데요...

[JSX 차트 블록 1: 최근 5경기 스탯]

위 차트에서 보듯이, 득점은 평균 30점을 상회하고 있으며...

[JSX 차트 블록 2: 포지션별 득점 분포]

이러한 데이터를 종합해보면...
```

## 🎯 사용 가능한 컴포넌트

JSX 블록 내부에서 사용 가능:

### React
- `useState`, `useEffect`, `useMemo` 등 모든 훅

### Recharts
- `LineChart`, `BarChart`, `PieChart`, `AreaChart`, `RadarChart`
- `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`
- `ResponsiveContainer`, `Cell`

### 스타일링
- Tailwind CSS 클래스 사용 가능
- 프로젝트의 다크 테마에 맞춰 디자인

## ⚠️ 주의사항

1. **컴포넌트 이름**: 반드시 `const Component = () => { ... }`
2. **파일 확장자**: `.jsx` 또는 `.js`만 가능
3. **보안**: 업로드된 JSX는 클라이언트에서 실행됩니다
4. **미리보기**: 에디터에서는 플레이스홀더만 표시, 실제 렌더링은 게시 후
5. **외부 라이브러리**: React와 Recharts만 사용 가능

## 🚀 장점

### Analysis vs Column의 차이:

| 기능 | Analysis | Column (JSX 임베딩) |
|------|----------|---------------------|
| 텍스트 작성 | ❌ 없음 | ✅ 풍부한 텍스트 에디터 |
| JSX 차트 | ✅ 전체가 JSX | ✅ 부분적으로 삽입 |
| 이미지/링크 | ❌ JSX로 구현 | ✅ 버튼 클릭으로 추가 |
| YouTube | ❌ JSX로 구현 | ✅ 버튼 클릭으로 추가 |
| 용도 | 순수 데이터 분석 | 텍스트 + 데이터 혼합 |

## 📖 참고

- Analysis 작성: `/analysis/new` (순수 JSX만)
- Column 작성: `/column/new` (텍스트 + JSX 혼합)
- 예시 파일: `example-analysis.jsx`

---

이제 풍부한 텍스트와 데이터 시각화를 결합한 전문적인 칼럼을 작성할 수 있습니다! 🎉

