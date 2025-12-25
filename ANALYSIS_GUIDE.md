# Analysis 글 작성 가이드

## 📝 새 분석글 작성 방법

### 1️⃣ 권한 확인
- **ADMIN** 또는 **COLUMNIST** 권한이 필요합니다
- 일반 사용자는 읽기만 가능합니다

### 2️⃣ 작성 페이지 접속
두 가지 방법이 있습니다:

**방법 1: 탭에서 접근**
1. 홈페이지 (`http://localhost:4000`) 접속
2. **Analysis** 탭 클릭
3. 우측 상단 **"새 분석 작성"** 버튼 클릭

**방법 2: 직접 URL 접속**
- `http://localhost:4000/analysis/new` 직접 접속

### 3️⃣ JSX 파일 준비

로컬에서 JSX 파일을 작성합니다. 예시:

```jsx
const Component = () => {
  const data = [
    { name: 'Game 1', points: 28, assists: 8, rebounds: 7 },
    { name: 'Game 2', points: 32, assists: 6, rebounds: 9 },
    { name: 'Game 3', points: 25, assists: 10, rebounds: 6 },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          루카 돈치치 최근 경기 분석
        </h2>

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
            <Line type="monotone" dataKey="rebounds" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
```

### 4️⃣ 파일 업로드

1. **제목 입력** - 분석글 제목 작성
2. **JSX 파일 선택** - 작성한 `.jsx` 또는 `.js` 파일 업로드
3. **미리보기** - 렌더링 결과 확인
4. **업로드** 버튼 클릭

## 🎨 사용 가능한 컴포넌트

### React
- `useState`, `useEffect`, `useMemo` 등 모든 React 훅

### Recharts 차트
- **LineChart** - 선 그래프
- **BarChart** - 막대 그래프
- **PieChart** - 파이 차트
- **AreaChart** - 영역 차트
- **RadarChart** - 레이더 차트
- **ScatterChart** - 산점도

### 차트 구성 요소
- `XAxis`, `YAxis` - 축
- `CartesianGrid` - 그리드
- `Tooltip` - 툴팁
- `Legend` - 범례
- `ResponsiveContainer` - 반응형 컨테이너
- `Cell` - 셀 (색상 커스터마이징)

## 📋 예시 파일

프로젝트 루트의 `example-analysis.jsx` 파일을 참고하세요!

## ⚠️ 주의사항

1. **컴포넌트 이름은 반드시 `Component`로 작성**
   ```jsx
   const Component = () => { ... }
   ```

2. **파일 확장자**: `.jsx` 또는 `.js`만 가능

3. **외부 라이브러리**: React와 Recharts만 사용 가능

4. **보안**: 관리자/칼럼니스트만 작성 가능

## 🚀 작성 후

- 자동으로 Analysis 탭에 표시됩니다
- 목록에서 클릭하면 상세 페이지로 이동
- JSX 코드가 동적으로 렌더링됩니다

## 📱 접근 경로

- **목록**: `/?tab=analysis` (홈페이지 Analysis 탭)
- **작성**: `/analysis/new`
- **상세**: `/analysis/[id]`

