'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const TOEIC_TOPICS = [
  '詞性辨析（名詞/形容詞/副詞）',
  '動詞時態與主被動語態',
  '介系詞與固定搭配片語',
  '關係代名詞與連接詞辨析',
  '主詞與動詞一致性 (Subject-Verb Agreement)',
];

const CHEER_MESSAGES = [
  '寶寶最棒了，慢慢寫不著急～ 🌸',
  '熊咘咘在旁邊幫妳加油打氣喔 🧸',
  '今天也離金色證書更近一步了 ✨',
  '認真的寶寶超級迷人 💖',
  '答錯也沒關係，把解析看懂就是賺到！ 🍀',
];

export default function Home() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSelections, setUserSelections] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [cheerMsg, setCheerMsg] = useState(CHEER_MESSAGES[0]);

  useEffect(() => {
    // 每次載入隨機抽一句加油語
    const randomMsg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
    setCheerMsg(randomMsg);
  }, [currentIndex, isSubmitted]);

  // 模式 1：從累積題庫隨機抽取複習（秒開、不耗等待時間）
  async function handleReviewFromBank() {
    setLoading(true);
    setLoadingText('熊咘咘正在翻題庫幫寶寶挑精選題目中... 🐾');
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, 10);
        setQuestions(shuffled);
        setCurrentIndex(0);
        setUserSelections({});
        setIsSubmitted(false);
      } else {
        alert('題庫目前還是空的，先請熊咘咘出第一批題目吧！ 🧸');
      }
    } catch (e: any) {
      alert('翻題庫有點卡卡，再試一次看看～');
    } finally {
      setLoading(false);
    }
  }

  // 模式 2：熊咘咘全新出題並自動存入題庫
  async function handleGenerateNewSet() {
    setLoading(true);
    const randomTopic = TOEIC_TOPICS[Math.floor(Math.random() * TOEIC_TOPICS.length)];
    setLoadingText(`熊咘咘正在認真思考考點【${randomTopic}】，為寶寶量身出題中... 🧸💭`);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: randomTopic, count: 5 }),
      });

      if (!res.ok) throw new Error('生成失敗');
      
      const result = await res.json();
      if (result.data && result.data.length > 0) {
        setQuestions(result.data);
        setCurrentIndex(0);
        setUserSelections({});
        setIsSubmitted(false);
      }
    } catch (e: any) {
      alert('熊咘咘剛剛手滑了一下，請再點一次讓他重新出題！ 🐾');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleReviewFromBank();
  }, []);

  function handleSelectOption(optionKey: string) {
    if (isSubmitted) return;
    setUserSelections((prev) => ({
      ...prev,
      [currentIndex]: optionKey,
    }));
  }

  async function handleSubmitQuiz() {
    const unansweredCount = questions.length - Object.keys(userSelections).length;
    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(`寶寶還有 ${unansweredCount} 題沒寫完喔，確定現在交卷嗎？`);
      if (!confirmSubmit) return;
    }

    setIsSubmitted(true);

    const records = questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: userSelections[idx] || '未作答',
      is_correct: userSelections[idx] === q.answer,
    }));
    await supabase.from('user_answers').insert(records);
  }

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userSelections).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const correctCount = questions.filter((q, idx) => userSelections[idx] === q.answer).length;

  return (
    <main className="min-h-screen bg-rose-50/50 py-8 px-4 selection:bg-rose-100 selection:text-rose-700">
      <div className="max-w-5xl mx-auto">
        {/* 可愛粉萌頂部導覽列 */}
        <header className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 mb-6 flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧸</span>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">寶寶的多益專屬特訓室</h1>
              <span className="text-xs bg-rose-100 text-rose-600 font-bold px-3 py-1 rounded-full">Part 5 專練</span>
            </div>
            <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
              <span>💌</span> <span>{cheerMsg}</span>
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={handleReviewFromBank}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-2xl hover:bg-black active:scale-95 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
            >
              <span>📚</span>
              <span>題庫抽 10 題複習</span>
            </button>
            <button
              onClick={handleGenerateNewSet}
              disabled={loading}
              className="px-4 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-2xl hover:bg-rose-600 active:scale-95 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
            >
              <span>🧸</span>
              <span>熊咘咘出新題目</span>
            </button>
          </div>
        </header>

        {loading && (
          <div className="p-4 mb-6 bg-white border border-rose-200 rounded-3xl text-center text-sm font-bold text-rose-500 shadow-sm animate-pulse flex items-center justify-center gap-2">
            <span>🐾</span>
            <span>{loadingText}</span>
          </div>
        )}

        {totalQuestions > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 左側答題狀態面板 */}
            <div className="md:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-rose-100 h-fit space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">作答進度</span>
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
                    {answeredCount} / {totalQuestions}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* 題號按鈕格 */}
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const selectedKey = userSelections[idx];
                  const isAnswered = selectedKey !== undefined;
                  const isCorrect = isSubmitted && selectedKey === q.answer;
                  const isWrong = isSubmitted && isAnswered && !isCorrect;

                  let containerStyle = 'bg-white border-slate-200 text-slate-700 hover:border-rose-200 hover:-translate-y-0.5 shadow-sm';
                  let badgeStyle = 'bg-slate-200 text-slate-600';

                  if (isCurrent) {
                    containerStyle = 'ring-2 ring-rose-400 border-rose-400 bg-rose-50/40 text-rose-900 font-bold -translate-y-0.5 shadow';
                  }

                  if (!isSubmitted) {
                    if (isAnswered) {
                      badgeStyle = 'bg-rose-500 text-white font-bold animate-in zoom-in-50 duration-200';
                      if (!isCurrent) containerStyle = 'bg-rose-50/20 border-rose-200 text-rose-950 font-medium hover:border-rose-300';
                    }
                  } else {
                    if (isCorrect) {
                      containerStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                      badgeStyle = 'bg-emerald-500 text-white font-bold';
                    } else if (isWrong) {
                      containerStyle = 'bg-rose-50 border-rose-400 text-rose-900 font-bold';
                      badgeStyle = 'bg-rose-500 text-white font-bold';
                    } else {
                      containerStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                      badgeStyle = 'bg-slate-200 text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative h-12 rounded-2xl border flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${containerStyle}`}
                    >
                      <span className="text-[11px] font-semibold">{idx + 1}</span>
                      {isAnswered ? (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full absolute -top-1.5 -right-1.5 shadow-sm ${badgeStyle}`}>
                          {selectedKey}
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                {!isSubmitted ? (
                  <button
                    onClick={handleSubmitQuiz}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-2xl transition-all active:scale-[0.98] shadow-md shadow-rose-200 flex items-center justify-center gap-1.5"
                  >
                    <span>📝</span>
                    <span>寫完了，交卷對答案！</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleReviewFromBank}
                      className="w-full py-2.5 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-2xl transition shadow"
                    >
                      📚 題庫隨機再抽一組
                    </button>
                    <button
                      onClick={handleGenerateNewSet}
                      className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-2xl transition shadow flex items-center justify-center gap-1"
                    >
                      <span>🧸</span>
                      <span>請熊咘咘再出新題目</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 右側作答卡片 */}
            <div className="md:col-span-3 space-y-6">
              {/* 結算結合成績卡 */}
              {isSubmitted && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 flex items-center justify-between animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {correctCount === totalQuestions
                        ? '🎉 哇！！全對滿分！太厲害了寶寶！'
                        : correctCount >= totalQuestions * 0.7
                        ? '✨ 答得很棒耶！超優秀！'
                        : '很棒喔！把錯題弄懂實力又更強了 💖'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">點擊左側題號看熊咘咘整理的考點與中譯解析喔！</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-rose-500">{correctCount}</span>
                    <span className="text-slate-400 font-bold"> / {totalQuestions}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      正確率 {Math.round((correctCount / totalQuestions) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {/* 題目本體 */}
              {currentQ && (
                <div className="bg-white rounded-3xl p-7 shadow-sm border border-rose-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[11px] font-semibold rounded-full border border-rose-100">
                      {currentQ.topic || 'Part 5 單句填空'}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      第 {currentIndex + 1} / {totalQuestions} 題
                    </span>
                  </div>

                  <p className="text-base md:text-lg font-semibold text-slate-800 leading-relaxed mb-6">
                    {currentQ.question}
                  </p>

                  {/* 選項列表 */}
                  <div className="space-y-3 mb-6">
                    {Object.entries(currentQ.options).map(([key, val]: any) => {
                      const selected = userSelections[currentIndex] === key;
                      let optionStyle = 'border-slate-200 bg-white hover:border-rose-200 text-slate-700 hover:bg-rose-50/20';

                      if (!isSubmitted) {
                        if (selected) {
                          optionStyle = 'border-rose-400 bg-rose-50/50 text-rose-950 ring-2 ring-rose-300/30 font-semibold shadow-sm';
                        }
                      } else {
                        if (key === currentQ.answer) {
                          optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm';
                        } else if (selected && key !== currentQ.answer) {
                          optionStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                        }
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectOption(key)}
                          className={`w-full text-left p-4 rounded-2xl border text-xs md:text-sm transition-all duration-150 active:scale-[0.99] flex items-center ${optionStyle}`}
                        >
                          <span className={`w-7 h-7 rounded-xl mr-3 flex items-center justify-center text-xs font-bold transition-colors ${
                            selected && !isSubmitted
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {key}
                          </span>
                          <span className="flex-1">{val}</span>
                          {isSubmitted && key === currentQ.answer && (
                            <span className="text-xs text-emerald-600 font-bold">✓ 正確答案</span>
                          )}
                          {isSubmitted && selected && key !== currentQ.answer && (
                            <span className="text-xs text-rose-500 font-bold">✕ 寶寶選的答案</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 上下題切換 */}
                  <div className="flex justify-between pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"
                    >
                      ← 上一題
                    </button>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      disabled={currentIndex === totalQuestions - 1}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-black disabled:opacity-30 transition"
                    >
                      下一題 →
                    </button>
                  </div>

                  {/* 解析與中文翻譯 */}
                  {isSubmitted && (
                    <div className="mt-6 p-5 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-3 animate-in fade-in duration-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">中文翻譯</h4>
                        <p className="text-xs md:text-sm text-slate-700 leading-relaxed">{currentQ.translation}</p>
                      </div>
                      <div className="pt-2 border-t border-rose-100">
                        <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">考點詳解</h4>
                        <p className="text-xs md:text-sm text-slate-800 leading-relaxed">{currentQ.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-rose-200">
              <p className="text-slate-500 mb-3 font-medium">題庫還沒有題目喔！</p>
              <button
                onClick={handleGenerateNewSet}
                className="px-5 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-2xl hover:bg-rose-600 transition shadow flex items-center gap-1.5 mx-auto"
              >
                <span>🧸</span>
                <span>請熊咘咘出第一批題目</span>
              </button>
            </div>
          )
        )}
      </div>
    </main>
  );
}
