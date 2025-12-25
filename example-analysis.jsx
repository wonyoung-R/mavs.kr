const Component = () => {
  const data = [
    { name: 'Game 1', points: 28, assists: 8, rebounds: 7 },
    { name: 'Game 2', points: 32, assists: 6, rebounds: 9 },
    { name: 'Game 3', points: 25, assists: 10, rebounds: 6 },
    { name: 'Game 4', points: 30, assists: 7, rebounds: 8 },
    { name: 'Game 5', points: 35, assists: 9, rebounds: 10 },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          선수 경기별 성적 분석
        </h2>
        <p className="text-slate-400 mb-6">
          최근 5경기 평균: 득점 30.0 | 어시스트 8.0 | 리바운드 8.0
        </p>

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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">득점 분포</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
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
              <Bar dataKey="points" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">스탯 비율</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: '득점', value: 30 },
                  { name: '어시스트', value: 8 },
                  { name: '리바운드', value: 8 },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label
              >
                <Cell fill="#8b5cf6" />
                <Cell fill="#3b82f6" />
                <Cell fill="#10b981" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

