'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const CHEER_MESSAGES_BAOBAO = [
  '寶寶最棒了，慢慢寫不著急～ 🌸',
  '熊咘咘在旁邊幫妳加油打氣喔 🧸',
  '今天也離金色證書更近一步了 ✨',
  '認真的寶寶超級迷人 💖',
  '答錯也沒關係，把解析看懂就是賺到！ 🍀',
];

const CHEER_MESSAGES_BEAR = [
  '熊熊衝刺！跟寶寶一起拿下金色證書 🐻🔥',
  '今天也要展現帥氣實力，穩穩拿分！ 🎯',
  '專注破題，多益 850+ 勢在必得 ✨',
  '錯題就是養分，徹底弄懂就無敵了！ 🚀',
];

interface ExamSession {
  sessionId: string;
  dateStr: string;
  part: string;
  total: number;
  correct: number;
  accuracy: number;
  userName: string;
  recordIds: number[];
  items: any[];
}

export default function Home() {
  // 身分切換：寶寶 / 熊熊
  const [currentUser, setCurrentUser] = useState<'寶寶' | '熊熊'>('寶寶');

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSelections, setUserSelections] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [cheerMsg, setCheerMsg] = useState(CHEER_MESSAGES_BAOBAO[0]);
  const [selectedPart, setSelectedPart] = useState<'Part 5' | 'Part 6' | 'Part 7' | 'Mock 50'>('Part 5');

  // 歷史紀錄相關狀態
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const list = currentUser === '寶寶' ? CHEER_MESSAGES_BAOBAO : CHEER_MESSAGES_BEAR;
    const randomMsg = list[Math.floor(Math.random() * list.length)];
    setCheerMsg(randomMsg);
  }, [currentIndex, isSubmitted, currentUser]);

  // 從題庫抽取（支援各 Part 與 50 題多益比例小模考）
  async function handleReviewFromBank(partToFilter: 'Part 5' | 'Part 6' | 'Part 7' | 'Mock 50' = selectedPart) {
    setLoading(true);
    if (partToFilter === 'Mock 50') {
      setLoadingText(`正在為【${currentUser}】組裝【50 題多益比重全真小模考】... 🎯🐾`);
    } else {
      setLoadingText(`正在為【${currentUser}】挑選【${partToFilter}】題目... 🐾`);
    }

    try {
      if (partToFilter === 'Mock 50') {
        const { data: allData, error } = await supabase.from('questions').select('*');
        if (error) throw error;
        if (!allData || allData.length === 0) {
          alert('題庫目前還是空的！ 🧸');
          setLoading(false);
          return;
        }

        // 1. Part 5: 隨機挑 15 題 (30%)
        const p5All = allData.filter((q) => q.part === 'Part 5');
        const p5Shuffled = [...p5All].sort(() => 0.5 - Math.random());
        const p5Selected = p5Shuffled.slice(0, 15);

        // 2. Part 6: 隨機抽 2 篇題組 (8 題，16%)
        const p6All = allData.filter((q) => q.part === 'Part 6');
        const p6Map = new Map<string, any[]>();
        p6All.forEach((q) => {
          const key = q.context || 'p6_gen';
          if (!p6Map.has(key)) p6Map.set(key, []);
          p6Map.get(key)!.push(q);
        });
        const p6Articles = Array.from(p6Map.values()).sort(() => 0.5 - Math.random());
        const p6Selected = p6Articles.slice(0, 2).flat();

        // 3. Part 7: 隨機抽文章湊足 27 題 (54%)
        const p7All = allData.filter((q) => q.part === 'Part 7');
        const p7Map = new Map<string, any[]>();
        p7All.forEach((q) => {
          const key = q.context || 'p7_gen';
          if (!p7Map.has(key)) p7Map.set(key, []);
          p7Map.get(key)!.push(q);
        });
        const p7Articles = Array.from(p7Map.values()).sort(() => 0.5 - Math.random());
        let p7Selected: any[] = [];
        for (const art of p7Articles) {
          if (p7Selected.length + art.length <= 27) {
            p7Selected.push(...art);
          } else {
            const needed = 27 - p7Selected.length;
            p7Selected.push(...art.slice(0, needed));
            break;
          }
        }

        const finalMock = [...p5Selected, ...p6Selected, ...p7Selected];
        setQuestions(finalMock);
        setCurrentIndex(0);
        setUserSelections({});
        setIsSubmitted(false);
      } else {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('part', partToFilter);

        if (error) throw error;

        if (!data || data.length === 0) {
          alert(`${partToFilter} 題庫目前沒有題目喔！ 🧸`);
          setLoading(false);
          return;
        }

        let selectedQuestions: any[] = [];

        if (partToFilter === 'Part 5') {
          const shuffled = [...data].sort(() => 0.5 - Math.random());
          selectedQuestions = shuffled.slice(0, 5);
        } else {
          const contextMap = new Map<string, any[]>();
          data.forEach((q) => {
            const key = q.context || 'general';
            if (!contextMap.has(key)) {
              contextMap.set(key, []);
            }
            contextMap.get(key)!.push(q);
          });

          const allArticles = Array.from(contextMap.values());
          const randomArticle = allArticles[Math.floor(Math.random() * allArticles.length)];
          selectedQuestions = randomArticle || [];
        }

        setQuestions(selectedQuestions);
        setCurrentIndex(0);
        setUserSelections({});
        setIsSubmitted(false);
      }
    } catch (e: any) {
      alert('讀取題庫有點卡卡，再試一次看看～');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleReviewFromBank('Part 5');
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
      const confirmSubmit = window.confirm(`${currentUser}還有 ${unansweredCount} 題沒寫完喔，確定現在交卷嗎？`);
      if (!confirmSubmit) return;
    }

    setIsSubmitted(true);

    const nowIso = new Date().toISOString();
    const records = questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: userSelections[idx] || '未作答',
      is_correct: userSelections[idx] === q.answer,
      user_name: currentUser, // 寫入當前作答者
      created_at: nowIso,
    }));
    await supabase.from('user_answers').insert(records);
  }

  // 讀取當前使用者的歷次紀錄
  async function fetchHistory() {
    setLoadingHistory(true);
    setSelectedSession(null);
    setShowHistoryModal(true);
    try {
      const { data, error } = await supabase
        .from('user_answers')
        .select(`
          id,
          selected_option,
          is_correct,
          user_name,
          created_at,
          questions (
            question,
            options,
            answer,
            part,
            explanation
          )
        `)
        .eq('user_name', currentUser) // 依據使用者過濾
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      if (!data || data.length === 0) {
        setExamSessions([]);
        return;
      }

      const groups: any[][] = [];
      let currentGroup: any[] = [];
      let lastTime = 0;

      data.forEach((item) => {
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
        if (currentGroup.length === 0) {
          currentGroup.push(item);
          lastTime = itemTime;
        } else {
          if (Math.abs(lastTime - itemTime) <= 5000) {
            currentGroup.push(item);
          } else {
            groups.push(currentGroup);
            currentGroup = [item];
            lastTime = itemTime;
          }
        }
      });
      if (currentGroup.length > 0) groups.push(currentGroup);

      const sessions: ExamSession[] = groups.map((grp, index) => {
        const first = grp[0];
        const dateObj = first.created_at ? new Date(first.created_at) : new Date();
        const month = dateObj.getMonth() + 1;
        const date = dateObj.getDate();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const dateStr = `${month}/${date} ${hours}:${minutes}`;

        const total = grp.length;
        const correct = grp.filter((i) => i.is_correct).length;
        const accuracy = Math.round((correct / total) * 100);
        const part = total >= 40 ? '🎯 50題小模考' : first.questions?.part || 'Part 5';
        const recordIds = grp.map((i) => i.id);

        return {
          sessionId: `${first.created_at}-${index}`,
          dateStr,
          part,
          total,
          correct,
          accuracy,
          userName: first.user_name || currentUser,
          recordIds,
          items: grp,
        };
      });

      setExamSessions(sessions);
    } catch (err: any) {
      alert('讀取歷史紀錄失敗，請稍候再試～');
    } finally {
      setLoadingHistory(false);
    }
  }

  // 刪除單場次紀錄功能
  async function handleDeleteSession(e: React.MouseEvent, session: ExamSession) {
    e.stopPropagation();
    const confirmDelete = window.confirm(`確定要刪除 ${session.dateStr}（${session.part}）的作答紀錄嗎？`);
    if (!confirmDelete) return;

    try {
      const { data, error } = await supabase
        .from('user_answers')
        .delete()
        .in('id', session.recordIds)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('資料庫拒絕刪除，請確認 Supabase 是否已新增 DELETE 政策！');
      }

      setExamSessions((prev) => prev.filter((s) => s.sessionId !== session.sessionId));
      if (selectedSession?.sessionId === session.sessionId) {
        setSelectedSession(null);
      }
    } catch (err: any) {
      alert(`刪除失敗：${err.message}`);
    }
  }

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userSelections).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const correctCount = questions.filter((q, idx) => userSelections[idx] === q.answer).length;

  return (
    <main
      style={{
        backgroundColor: currentUser === '寶寶' ? '#fff1f2' : '#f0fdf4',
        minHeight: '100vh',
        padding: '24px 12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background-color 0.3s ease',
      }}
    >
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        {/* 頂部 Header */}
        <header
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '20px',
            border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '24px' }}>{currentUser === '寶寶' ? '🧸' : '🐻'}</span>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
                {currentUser === '寶寶' ? '寶寶' : '熊熊'}的多益全方位特訓室
              </h1>

              {/* 使用者身分切換器 */}
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '14px',
                  padding: '3px',
                  marginLeft: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentUser('寶寶')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: currentUser === '寶寶' ? '#f43f5e' : 'transparent',
                    color: currentUser === '寶寶' ? '#ffffff' : '#64748b',
                    boxShadow: currentUser === '寶寶' ? '0 2px 4px rgba(244,63,94,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  🧸 寶寶
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentUser('熊熊')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: currentUser === '熊熊' ? '#059669' : 'transparent',
                    color: currentUser === '熊熊' ? '#ffffff' : '#64748b',
                    boxShadow: currentUser === '熊熊' ? '0 2px 4px rgba(5,150,105,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  🐻 熊熊
                </button>
              </div>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: currentUser === '寶寶' ? '#f43f5e' : '#059669',
                fontWeight: '500',
                marginTop: '6px',
                marginBottom: 0,
              }}
            >
              💌 {cheerMsg}
            </p>
          </div>

          {/* 題型切換 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {(['Part 5', 'Part 6', 'Part 7', 'Mock 50'] as const).map((part) => {
              const isSelected = selectedPart === part;
              const activeBg = currentUser === '寶寶' ? '#ffe4e6' : '#dcfce7';
              const activeBorder = currentUser === '寶寶' ? '#f43f5e' : '#10b981';
              const activeColor = currentUser === '寶寶' ? '#e11d48' : '#047857';

              return (
                <button
                  key={part}
                  onClick={() => {
                    setSelectedPart(part);
                    handleReviewFromBank(part);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${activeBorder}` : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? activeBg : '#ffffff',
                    color: isSelected ? activeColor : '#475569',
                  }}
                >
                  {part === 'Part 5'
                    ? 'Part 5 單句'
                    : part === 'Part 6'
                    ? 'Part 6 段落'
                    : part === 'Part 7'
                    ? 'Part 7 閱讀'
                    : '🎯 小模擬考 (50題)'}
                </button>
              );
            })}
          </div>

          {/* 頂部操作按鈕 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchHistory}
              style={{
                padding: '10px 14px',
                backgroundColor: '#f1f5f9',
                color: '#1e293b',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '14px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
            >
              📊 {currentUser}的紀錄
            </button>
            <button
              onClick={() => handleReviewFromBank(selectedPart)}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: currentUser === '寶寶' ? '#f43f5e' : '#059669',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '14px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: currentUser === '寶寶' ? '0 4px 10px rgba(244, 63, 94, 0.25)' : '0 4px 10px rgba(5, 150, 105, 0.25)',
              }}
            >
              🎲 隨機換一組題
            </button>
          </div>
        </header>

        {loading && (
          <div
            style={{
              padding: '14px',
              marginBottom: '16px',
              backgroundColor: '#ffffff',
              border: currentUser === '寶寶' ? '1px solid #fecdd3' : '1px solid #a7f3d0',
              borderRadius: '20px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: currentUser === '寶寶' ? '#f43f5e' : '#059669',
            }}
          >
            {loadingText}
          </div>
        )}

        {totalQuestions > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {/* 左側作答進度面板 */}
            <div
              style={{
                flex: '1 1 240px',
                maxWidth: '280px',
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '18px',
                border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                height: 'fit-content',
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>本組進度</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: currentUser === '寶寶' ? '#f43f5e' : '#059669' }}>
                    {answeredCount} / {totalQuestions}
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '6px', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: currentUser === '寶寶' ? '#fb7185' : '#34d399',
                      height: '100%',
                      width: `${progressPercent}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* 題號按鈕格 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: totalQuestions > 10 ? 'repeat(5, 1fr)' : `repeat(${totalQuestions <= 4 ? totalQuestions : 5}, 1fr)`,
                  gap: '8px',
                  maxHeight: totalQuestions > 20 ? '360px' : 'none',
                  overflowY: totalQuestions > 20 ? 'auto' : 'visible',
                  paddingRight: totalQuestions > 20 ? '4px' : '0',
                  marginBottom: '16px',
                }}
              >
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const selectedKey = userSelections[idx];
                  const isAnswered = selectedKey !== undefined;
                  const isCorrect = isSubmitted && selectedKey === q.answer;
                  const isWrong = isSubmitted && isAnswered && !isCorrect;

                  let bgColor = '#ffffff';
                  let borderColor = '#cbd5e1';
                  let textColor = '#0f172a';
                  let boxShadow = 'none';

                  // 1. 已作答：柔和綠色底
                  if (isAnswered) {
                    bgColor = '#ecfdf5';
                    borderColor = '#a7f3d0';
                    textColor = '#065f46';
                  }

                  // 2. 當前題：深黑粗外框
                  if (isCurrent) {
                    borderColor = '#1e293b';
                    boxShadow = '0 0 0 2.5px #1e293b';
                    if (!isAnswered) {
                      bgColor = '#f8fafc';
                    }
                  }

                  // 3. 交卷後判定
                  if (isSubmitted) {
                    if (isCorrect) {
                      bgColor = '#ecfdf5';
                      borderColor = '#10b981';
                      textColor = '#065f46';
                      boxShadow = isCurrent ? '0 0 0 2.5px #10b981' : 'none';
                    } else if (isWrong) {
                      bgColor = '#fff1f2';
                      borderColor = '#fb7185';
                      textColor = '#9f1239';
                      boxShadow = isCurrent ? '0 0 0 2.5px #f43f5e' : 'none';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        position: 'relative',
                        height: '42px',
                        borderRadius: '12px',
                        border: `1.5px solid ${borderColor}`,
                        backgroundColor: bgColor,
                        color: textColor,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: boxShadow,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {idx + 1}
                      {isAnswered && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '9999px',
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            backgroundColor: currentUser === '寶寶' ? '#f43f5e' : '#059669',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        >
                          {selectedKey}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!isSubmitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: currentUser === '寶寶' ? '#f43f5e' : '#059669',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: currentUser === '寶寶' ? '0 4px 10px rgba(244, 63, 94, 0.3)' : '0 4px 10px rgba(5, 150, 105, 0.3)',
                  }}
                >
                  📝 寫完了，交卷對答案！
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: currentUser === '寶寶' ? '#f43f5e' : '#059669' }}>
                    {correctCount}
                  </span>
                  <span style={{ color: '#94a3b8' }}> / {totalQuestions}</span>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {correctCount === totalQuestions ? '🎉 滿分太神啦！' : '很棒！解析弄懂實力再躍進！'}
                  </p>
                </div>
              )}
            </div>

            {/* 右側作答卡片 */}
            <div style={{ flex: '1 1 540px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentQ && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    padding: '24px',
                    border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        backgroundColor: currentUser === '寶寶' ? '#fff1f2' : '#f0fdf4',
                        color: currentUser === '寶寶' ? '#e11d48' : '#047857',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderRadius: '9999px',
                        border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
                      }}
                    >
                      {currentQ.part} · {currentQ.topic || '題組'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      第 {currentIndex + 1} / {totalQuestions} 題
                    </span>
                  </div>

                  {currentQ.context && (
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '14px',
                        padding: '16px',
                        marginBottom: '18px',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: '#0f172a',
                        whiteSpace: 'pre-line',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {currentQ.context}
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#0f172a',
                      lineHeight: '1.6',
                      marginBottom: '18px',
                    }}
                  >
                    {currentQ.question}
                  </p>

                  {/* 選項清單 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {Object.entries(currentQ.options || {}).map(([key, val]: any) => {
                      const selected = userSelections[currentIndex] === key;
                      let itemBg = '#ffffff';
                      let itemBorder = '#e2e8f0';

                      if (!isSubmitted && selected) {
                        itemBg = currentUser === '寶寶' ? '#fff1f2' : '#f0fdf4';
                        itemBorder = currentUser === '寶寶' ? '#fb7185' : '#34d399';
                      } else if (isSubmitted) {
                        if (key === currentQ.answer) {
                          itemBg = '#ecfdf5';
                          itemBorder = '#10b981';
                        } else if (selected) {
                          itemBg = '#fff1f2';
                          itemBorder = '#fb7185';
                        }
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectOption(key)}
                          type="button"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            borderRadius: '14px',
                            border: `1.5px solid ${itemBorder}`,
                            backgroundColor: itemBg,
                            color: '#0f172a',
                            cursor: isSubmitted ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '15px',
                            outline: 'none',
                          }}
                        >
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              marginRight: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              backgroundColor: selected ? (currentUser === '寶寶' ? '#f43f5e' : '#059669') : '#f1f5f9',
                              color: selected ? '#ffffff' : '#0f172a',
                              flexShrink: 0,
                            }}
                          >
                            {key}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              color: '#0f172a',
                              fontWeight: selected ? '600' : '400',
                            }}
                          >
                            {val}
                          </span>
                          {isSubmitted && key === currentQ.answer && (
                            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold' }}>✓ 正解</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 上下題切換 */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '14px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      style={{
                        padding: '8px 14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: currentIndex === 0 ? 0.4 : 1,
                      }}
                    >
                      ← 上一題
                    </button>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      disabled={currentIndex === totalQuestions - 1}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '13px',
                        cursor: currentIndex === totalQuestions - 1 ? 'not-allowed' : 'pointer',
                        opacity: currentIndex === totalQuestions - 1 ? 0.4 : 1,
                      }}
                    >
                      下一題 →
                    </button>
                  </div>

                  {/* 解析與中文翻譯 */}
                  {isSubmitted && (
                    <div
                      style={{
                        marginTop: '18px',
                        padding: '16px',
                        backgroundColor: currentUser === '寶寶' ? '#fff1f2' : '#f0fdf4',
                        borderRadius: '14px',
                        border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
                      }}
                    >
                      <div style={{ marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '0 0 4px 0' }}>
                          中文翻譯
                        </h4>
                        <p style={{ fontSize: '14px', color: '#0f172a', margin: 0, lineHeight: '1.6' }}>
                          {currentQ.translation}
                        </p>
                      </div>
                      <div style={{ paddingTop: '8px', borderTop: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: currentUser === '寶寶' ? '#f43f5e' : '#059669', margin: '0 0 4px 0' }}>
                          考點詳解
                        </h4>
                        <p style={{ fontSize: '14px', color: '#0f172a', margin: 0, lineHeight: '1.6' }}>
                          {currentQ.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                border: '2px dashed #cbd5e1',
              }}
            >
              <p style={{ color: '#64748b', marginBottom: '14px' }}>目前沒有題組喔！</p>
            </div>
          )
        )}

        {/* 歷史作答紀錄彈窗（依據使用者隔離） */}
        {showHistoryModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 50,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                maxWidth: '680px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedSession && (
                    <button
                      onClick={() => setSelectedSession(null)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#0f172a',
                      }}
                    >
                      ← 返回列表
                    </button>
                  )}
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                    {selectedSession ? `📝 ${selectedSession.dateStr} 作答詳情` : `📊 ${currentUser}的歷次考試紀錄`}
                  </h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    border: 'none',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '10px',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#64748b',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: currentUser === '寶寶' ? '#f43f5e' : '#059669', fontWeight: 'bold' }}>
                    整理【{currentUser}】的紀錄中... 🐾
                  </div>
                ) : !selectedSession ? (
                  examSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                      【{currentUser}】目前還沒有考試紀錄喔，去寫一組試試吧！✨
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {examSessions.map((session) => (
                        <div
                          key={session.sessionId}
                          onClick={() => setSelectedSession(session)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '14px',
                            border: currentUser === '寶寶' ? '1px solid #ffe4e6' : '1px solid #bbf7d0',
                            backgroundColor: currentUser === '寶寶' ? '#fff1f2' : '#f0fdf4',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            gap: '12px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                                {session.dateStr}
                              </span>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: currentUser === '寶寶' ? '#ffe4e6' : '#dcfce7',
                                  color: currentUser === '寶寶' ? '#e11d48' : '#047857',
                                }}
                              >
                                {session.part}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              共 {session.total} 題 · 點擊查看題目光碟 🔍
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '15px', fontWeight: '900', color: currentUser === '寶寶' ? '#f43f5e' : '#059669' }}>
                                {session.correct} / {session.total} 題
                              </div>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  color: session.accuracy >= 70 ? '#059669' : '#e11d48',
                                }}
                              >
                                答對率 {session.accuracy}%
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, session)}
                              title="刪除此筆紀錄"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                color: '#e11d48',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                              }}
                            >
                              🗑️ 刪除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                        作答者：{currentUser} | 成績：{selectedSession.correct} / {selectedSession.total} ({selectedSession.accuracy}%)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, selectedSession)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #fecdd3',
                          color: '#e11d48',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️ 刪除此場紀錄
                      </button>
                    </div>

                    {selectedSession.items.map((item, idx) => {
                      const qObj = item.questions;
                      const isCorrect = item.is_correct;
                      const userChoice = item.selected_option;
                      const correctChoice = qObj?.answer;
                      const optionsMap = qObj?.options || {};

                      return (
                        <div
                          key={item.id || idx}
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            border: `1.5px solid ${isCorrect ? '#a7f3d0' : '#fecdd3'}`,
                            backgroundColor: isCorrect ? '#f0fdf4' : '#fff1f2',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: isCorrect ? '#d1fae5' : '#ffe4e6',
                                color: isCorrect ? '#065f46' : '#9f1239',
                              }}
                            >
                              第 {idx + 1} 題 · {isCorrect ? '✓ 答對' : '✕ 答錯'}
                            </span>
                          </div>

                          <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', lineHeight: '1.5' }}>
                            {qObj?.question}
                          </p>

                          {/* 完整列出 ABCD 選項 */}
                          {Object.keys(optionsMap).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                              {Object.entries(optionsMap).map(([optKey, optText]: any) => {
                                const isUserPick = userChoice === optKey;
                                const isAnswerKey = correctChoice === optKey;

                                let optBg = '#ffffff';
                                let optBorder = '#e2e8f0';
                                let tagText = '';
                                let tagBg = '#f1f5f9';
                                let tagColor = '#475569';

                                if (isAnswerKey) {
                                  optBg = '#ecfdf5';
                                  optBorder = '#10b981';
                                  tagText = '✓ 正解';
                                  tagBg = '#10b981';
                                  tagColor = '#ffffff';
                                } else if (isUserPick && !isCorrect) {
                                  optBg = '#fff1f2';
                                  optBorder = '#fb7185';
                                  tagText = `✕ ${currentUser}選這個`;
                                  tagBg = '#f43f5e';
                                  tagColor = '#ffffff';
                                }

                                return (
                                  <div
                                    key={optKey}
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '10px',
                                      border: `1.5px solid ${optBorder}`,
                                      backgroundColor: optBg,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: '13px',
                                      color: '#0f172a',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '6px',
                                          backgroundColor: isUserPick ? (isCorrect ? '#10b981' : '#f43f5e') : '#e2e8f0',
                                          color: isUserPick ? '#ffffff' : '#334155',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'bold',
                                          fontSize: '12px',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {optKey}
                                      </span>
                                      <span style={{ fontWeight: isAnswerKey || isUserPick ? '600' : '400' }}>
                                        {optText}
                                      </span>
                                    </div>
                                    {tagText && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          backgroundColor: tagBg,
                                          color: tagColor,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {tagText}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {qObj?.explanation && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', lineHeight: '1.6' }}>
                              💡 解析：{qObj?.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
