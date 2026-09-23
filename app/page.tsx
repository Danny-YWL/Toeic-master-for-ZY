'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const CHEER_MESSAGES = [
  '寶寶最棒了，慢慢寫不著急～ 🌸',
  '熊咘咘在旁邊幫妳加油打氣喔 🧸',
  '今天也離金色證書更近一步了 ✨',
  '認真的寶寶超級迷人 💖',
  '答錯也沒關係，把解析看懂就是賺到！ 🍀',
];

interface ExamSession {
  sessionId: string;
  dateStr: string;
  part: string;
  total: number;
  correct: number;
  accuracy: number;
  recordIds: number[];
  items: any[];
}

export default function Home() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSelections, setUserSelections] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [cheerMsg, setCheerMsg] = useState(CHEER_MESSAGES[0]);
  const [selectedPart, setSelectedPart] = useState<'Part 5' | 'Part 6' | 'Part 7'>('Part 5');

  // 歷史紀錄相關狀態
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const randomMsg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
    setCheerMsg(randomMsg);
  }, [currentIndex, isSubmitted]);

  // 從題庫抽取（已修復：真隨機挑選題組與題目）
  async function handleReviewFromBank(partToFilter = selectedPart) {
    setLoading(true);
    setLoadingText(`熊咘咘正在翻【${partToFilter}】題庫... 🐾`);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('part', partToFilter);

      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`${partToFilter} 題庫目前還是空的，先請熊咘咘出新題目吧！ 🧸`);
        setLoading(false);
        return;
      }

      let selectedQuestions: any[] = [];

      if (partToFilter === 'Part 5') {
        // Part 5：真正隨機打亂並取 5 題
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        selectedQuestions = shuffled.slice(0, 5);
      } else {
        // Part 6 或 Part 7：按 context (文章) 分組，隨機挑選「其中一整組題組」
        const contextMap = new Map<string, any[]>();
        data.forEach((q) => {
          const key = q.context || 'general';
          if (!contextMap.has(key)) {
            contextMap.set(key, []);
          }
          contextMap.get(key)!.push(q);
        });

        const allArticles = Array.from(contextMap.values());
        // 隨機抽出一篇完整文章的題目
        const randomArticle = allArticles[Math.floor(Math.random() * allArticles.length)];
        selectedQuestions = randomArticle || [];
      }

      setQuestions(selectedQuestions);
      setCurrentIndex(0);
      setUserSelections({});
      setIsSubmitted(false);
    } catch (e: any) {
      alert('翻題庫有點卡卡，再試一次看看～');
    } finally {
      setLoading(false);
    }
  }

  // AI 出新題組
  async function handleGenerateNewSet() {
    setLoading(true);
    const targetName =
      selectedPart === 'Part 5'
        ? '5 題單句填空'
        : selectedPart === 'Part 6'
        ? '1篇段落填空(4題)'
        : '1篇閱讀理解(3題)';
    setLoadingText(`熊咘咘正在極速生成【${targetName}】，請稍候 3~5 秒... 🧸⚡`);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part: selectedPart }),
      });

      const result = await res.json();
      if (!res.ok || !result.data || result.data.length === 0) {
        throw new Error(result.error || '生成失敗');
      }

      setQuestions(result.data);
      setCurrentIndex(0);
      setUserSelections({});
      setIsSubmitted(false);
    } catch (e: any) {
      alert(`出題遇到狀況（${e.message}），請再點一次試試看！ 🐾`);
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
      const confirmSubmit = window.confirm(`寶寶還有 ${unansweredCount} 題沒寫完喔，確定現在交卷嗎？`);
      if (!confirmSubmit) return;
    }

    setIsSubmitted(true);

    const nowIso = new Date().toISOString();
    const records = questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: userSelections[idx] || '未作答',
      is_correct: userSelections[idx] === q.answer,
      created_at: nowIso,
    }));
    await supabase.from('user_answers').insert(records);
  }

  // 讀取歷次紀錄
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
          created_at,
          questions (
            question,
            answer,
            part,
            explanation
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

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
        const part = first.questions?.part || 'Part 5';
        const recordIds = grp.map((i) => i.id);

        return {
          sessionId: `${first.created_at}-${index}`,
          dateStr,
          part,
          total,
          correct,
          accuracy,
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
      const { error } = await supabase
        .from('user_answers')
        .delete()
        .in('id', session.recordIds);

      if (error) throw error;

      setExamSessions((prev) => prev.filter((s) => s.sessionId !== session.sessionId));
      if (selectedSession?.sessionId === session.sessionId) {
        setSelectedSession(null);
      }
    } catch (err: any) {
      alert('刪除失敗，請稍候再試！');
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
        backgroundColor: '#fff1f2',
        minHeight: '100vh',
        padding: '24px 12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        {/* 頂部 Header */}
        <header
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '20px',
            border: '1px solid #ffe4e6',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🧸</span>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
                寶寶的多益全方位特訓室
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: '#f43f5e', fontWeight: '500', marginTop: '6px', marginBottom: 0 }}>
              💌 {cheerMsg}
            </p>
          </div>

          {/* 題型切換 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {(['Part 5', 'Part 6', 'Part 7'] as const).map((part) => (
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
                  border: selectedPart === part ? '2px solid #f43f5e' : '1px solid #e2e8f0',
                  backgroundColor: selectedPart === part ? '#ffe4e6' : '#ffffff',
                  color: selectedPart === part ? '#e11d48' : '#475569',
                }}
              >
                {part === 'Part 5' ? 'Part 5 單句' : part === 'Part 6' ? 'Part 6 段落' : 'Part 7 閱讀'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchHistory}
              style={{
                padding: '9px 13px',
                backgroundColor: '#f1f5f9',
                color: '#1e293b',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '14px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
            >
              📊 歷次紀錄
            </button>
            <button
              onClick={() => handleReviewFromBank(selectedPart)}
              disabled={loading}
              style={{
                padding: '9px 13px',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '14px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              📚 題庫抽題
            </button>
            <button
              onClick={handleGenerateNewSet}
              disabled={loading}
              style={{
                padding: '9px 13px',
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '14px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 10px rgba(244, 63, 94, 0.25)',
              }}
            >
              ⚡ 熊咘咘秒出題組
            </button>
          </div>
        </header>

        {loading && (
          <div
            style={{
              padding: '14px',
              marginBottom: '16px',
              backgroundColor: '#ffffff',
              border: '1px solid #fecdd3',
              borderRadius: '20px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#f43f5e',
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
                maxWidth: '260px',
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '18px',
                border: '1px solid #ffe4e6',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                height: 'fit-content',
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>本組進度</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e' }}>
                    {answeredCount} / {totalQuestions}
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '6px', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#fb7185',
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
                  gridTemplateColumns: `repeat(${totalQuestions <= 4 ? totalQuestions : 5}, 1fr)`,
                  gap: '8px',
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

                  if (isCurrent) {
                    bgColor = '#fff1f2';
                    borderColor = '#fb7185';
                    textColor = '#9f1239';
                  }

                  if (isSubmitted) {
                    if (isCorrect) {
                      bgColor = '#ecfdf5';
                      borderColor = '#10b981';
                      textColor = '#065f46';
                    } else if (isWrong) {
                      bgColor = '#fff1f2';
                      borderColor = '#fb7185';
                      textColor = '#9f1239';
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
                      }}
                    >
                      {idx + 1}
                      {isAnswered && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '1px 4px',
                            borderRadius: '9999px',
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            backgroundColor: '#f43f5e',
                            color: '#ffffff',
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
                    backgroundColor: '#f43f5e',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(244, 63, 94, 0.3)',
                  }}
                >
                  📝 寫完了，交卷對答案！
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: '#f43f5e' }}>{correctCount}</span>
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
                    border: '1px solid #ffe4e6',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#fff1f2',
                        color: '#e11d48',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderRadius: '9999px',
                        border: '1px solid #ffe4e6',
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
                        itemBg = '#fff1f2';
                        itemBorder = '#fb7185';
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
                              backgroundColor: selected ? '#f43f5e' : '#f1f5f9',
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
                        backgroundColor: '#fff1f2',
                        borderRadius: '14px',
                        border: '1px solid #ffe4e6',
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
                      <div style={{ paddingTop: '8px', borderTop: '1px solid #ffe4e6' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', margin: '0 0 4px 0' }}>
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
                border: '2px dashed #fecdd3',
              }}
            >
              <p style={{ color: '#64748b', marginBottom: '14px' }}>目前還沒有【{selectedPart}】的題組喔！</p>
              <button
                onClick={handleGenerateNewSet}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f43f5e',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🧸 請熊咘咘出題組
              </button>
            </div>
          )
        )}

        {/* 歷史作答紀錄彈窗 */}
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
                border: '1px solid #ffe4e6',
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
                    {selectedSession ? `📝 ${selectedSession.dateStr} 作答詳情` : '📊 寶寶的歷次考試紀錄'}
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
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#f43f5e', fontWeight: 'bold' }}>
                    熊咘咘整理紀錄中... 🐾
                  </div>
                ) : !selectedSession ? (
                  examSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                      目前還沒有考試紀錄喔，去寫一組試試吧！✨
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
                            border: '1px solid #ffe4e6',
                            backgroundColor: '#fff1f2',
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
                                  backgroundColor: '#ffe4e6',
                                  color: '#e11d48',
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
                              <div style={{ fontSize: '15px', fontWeight: '900', color: '#f43f5e' }}>
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
                                border: '1px solid #fecdd3',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                        成績：{selectedSession.correct} / {selectedSession.total} ({selectedSession.accuracy}%)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, selectedSession)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#fff1f2',
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

                    {selectedSession.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        style={{
                          padding: '14px',
                          borderRadius: '14px',
                          border: `1.5px solid ${item.is_correct ? '#a7f3d0' : '#fecdd3'}`,
                          backgroundColor: item.is_correct ? '#f0fdf4' : '#fff1f2',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: item.is_correct ? '#d1fae5' : '#ffe4e6',
                              color: item.is_correct ? '#065f46' : '#9f1239',
                            }}
                          >
                            第 {idx + 1} 題 · {item.is_correct ? '✓ 答對' : '✕ 答錯'}
                          </span>
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '6px', lineHeight: '1.5' }}>
                          {item.questions?.question}
                        </p>
                        <div style={{ fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                          寶寶選：<span style={{ fontWeight: 'bold', color: item.is_correct ? '#059669' : '#e11d48' }}>{item.selected_option}</span>
                          {!item.is_correct && (
                            <span style={{ marginLeft: '12px' }}>
                              正解：<span style={{ fontWeight: 'bold', color: '#059669' }}>{item.questions?.answer}</span>
                            </span>
                          )}
                        </div>
                        {item.questions?.explanation && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                            💡 解析：{item.questions?.explanation}
                          </div>
                        )}
                      </div>
                    ))}
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
