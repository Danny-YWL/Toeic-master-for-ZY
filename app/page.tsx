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
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const randomMsg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
    setCheerMsg(randomMsg);
  }, [currentIndex, isSubmitted]);

  async function handleReviewFromBank(partToFilter = selectedPart) {
    setLoading(true);
    setLoadingText(`熊咘咘正在翻【${partToFilter}】題庫挑 5 題精選題目... 🐾`);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('part', partToFilter)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (data && data.length > 0) {
        const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, 5);
        setQuestions(shuffled);
        setCurrentIndex(0);
        setUserSelections({});
        setIsSubmitted(false);
      } else {
        alert(`${partToFilter} 題庫目前還是空的，先請熊咘咘出題目吧！ 🧸`);
      }
    } catch (e: any) {
      alert('翻題庫有點卡卡，再試一次看看～');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateNewSet() {
    setLoading(true);
    setLoadingText(`熊咘咘正在極速生成 5 題【${selectedPart}】，請稍候 3~5 秒... 🧸⚡`);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part: selectedPart, count: 5 }),
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
      alert('出題稍微卡了一下，請再點一次讓他重新出題！ 🐾');
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

    const records = questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: userSelections[idx] || '未作答',
      is_correct: userSelections[idx] === q.answer,
    }));
    await supabase.from('user_answers').insert(records);
  }

  // 讀取歷史作答紀錄
  async function fetchHistory() {
    setLoadingHistory(true);
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
        .limit(50);

      if (error) throw error;
      setHistoryRecords(data || []);
    } catch (err: any) {
      alert('讀取歷史紀錄失敗，請稍候再試～');
    } finally {
      setLoadingHistory(false);
    }
  }

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userSelections).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const correctCount = questions.filter((q, idx) => userSelections[idx] === q.answer).length;

  const totalHistoryCount = historyRecords.length;
  const totalHistoryCorrect = historyRecords.filter((r) => r.is_correct).length;
  const historyAccuracy = totalHistoryCount > 0 ? Math.round((totalHistoryCorrect / totalHistoryCount) * 100) : 0;

  return (
    <main
      style={{
        backgroundColor: '#fff1f2',
        minHeight: '100vh',
        padding: '32px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        {/* 可愛頂部導覽列 */}
        <header
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid #ffe4e6',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '26px' }}>🧸</span>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
                寶寶的多益全方位特訓室
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: '#f43f5e', fontWeight: '500', marginTop: '6px', marginBottom: 0 }}>
              💌 {cheerMsg}
            </p>
          </div>

          {/* 題型切換按鈕組 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(['Part 5', 'Part 6', 'Part 7'] as const).map((part) => (
              <button
                key={part}
                onClick={() => {
                  setSelectedPart(part);
                  handleReviewFromBank(part);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: selectedPart === part ? '2px solid #f43f5e' : '1px solid #e2e8f0',
                  backgroundColor: selectedPart === part ? '#ffe4e6' : '#ffffff',
                  color: selectedPart === part ? '#e11d48' : '#64748b',
                }}
              >
                {part === 'Part 5' ? 'Part 5 單句' : part === 'Part 6' ? 'Part 6 段落' : 'Part 7 閱讀'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchHistory}
              style={{
                padding: '10px 14px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
              }}
            >
              📊 答題紀錄
            </button>
            <button
              onClick={() => handleReviewFromBank(selectedPart)}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '16px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              📚 題庫抽 5 題
            </button>
            <button
              onClick={handleGenerateNewSet}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '16px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.25)',
              }}
            >
              ⚡ 熊咘咘秒出 5 題
            </button>
          </div>
        </header>

        {loading && (
          <div
            style={{
              padding: '14px',
              marginBottom: '20px',
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {/* 左側作答卡清單 */}
            <div
              style={{
                flex: '1 1 240px',
                maxWidth: '260px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid #ffe4e6',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                height: 'fit-content',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>作答進度</span>
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

              {/* 題號按鈕 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const selectedKey = userSelections[idx];
                  const isAnswered = selectedKey !== undefined;
                  const isCorrect = isSubmitted && selectedKey === q.answer;
                  const isWrong = isSubmitted && isAnswered && !isCorrect;

                  let bgColor = '#ffffff';
                  let borderColor = '#e2e8f0';
                  let textColor = '#334155';

                  if (isCurrent) {
                    bgColor = '#fff1f2';
                    borderColor = '#fb7185';
                    textColor = '#881337';
                  }

                  if (isSubmitted) {
                    if (isCorrect) {
                      bgColor = '#ecfdf5';
                      borderColor = '#34d399';
                    } else if (isWrong) {
                      bgColor = '#fff1f2';
                      borderColor = '#fb7185';
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
                    borderRadius: '16px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
                  }}
                >
                  📝 寫完了，交卷對答案！
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: '#f43f5e' }}>{correctCount}</span>
                  <span style={{ color: '#94a3b8' }}> / {totalQuestions}</span>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {correctCount === totalQuestions ? '🎉 滿分太神啦！' : '很棒！把解析看懂就掌握了！'}
                  </p>
                </div>
              )}
            </div>

            {/* 右側作答卡片 */}
            <div style={{ flex: '1 1 560px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentQ && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    padding: '28px',
                    border: '1px solid #ffe4e6',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#fff1f2',
                        color: '#e11d48',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderRadius: '9999px',
                        border: '1px solid #ffe4e6',
                      }}
                    >
                      {currentQ.part} · {currentQ.topic || '閱讀'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      第 {currentIndex + 1} / {totalQuestions} 題
                    </span>
                  </div>

                  {currentQ.context && (
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '18px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        lineHeight: '1.7',
                        color: '#334155',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {currentQ.context}
                    </div>
                  )}

                  <p style={{ fontSize: '17px', fontWeight: '600', color: '#1e293b', lineHeight: '1.6', marginBottom: '20px' }}>
                    {currentQ.question}
                  </p>

                  {/* 選項清單 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
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
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '14px 18px',
                            borderRadius: '16px',
                            border: `1.5px solid ${itemBorder}`,
                            backgroundColor: itemBg,
                            cursor: isSubmitted ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '15px',
                          }}
                        >
                          <span
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '10px',
                              marginRight: '14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              backgroundColor: selected ? '#f43f5e' : '#f1f5f9',
                              color: selected ? '#ffffff' : '#475569',
                              flexShrink: 0,
                            }}
                          >
                            {key}
                          </span>
                          <span style={{ flex: 1 }}>{val}</span>
                          {isSubmitted && key === currentQ.answer && (
                            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold' }}>✓ 正解</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 上下題切換 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '13px',
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
                        padding: '8px 16px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
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
                    <div style={{ marginTop: '20px', padding: '18px', backgroundColor: '#fff1f2', borderRadius: '16px', border: '1px solid #ffe4e6' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '0 0 4px 0' }}>中文翻譯</h4>
                        <p style={{ fontSize: '14px', color: '#334155', margin: 0 }}>{currentQ.translation}</p>
                      </div>
                      <div style={{ paddingTop: '10px', borderTop: '1px solid #ffe4e6' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', margin: '0 0 4px 0' }}>考點詳解</h4>
                        <p style={{ fontSize: '14px', color: '#1e293b', margin: 0 }}>{currentQ.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#ffffff', borderRadius: '24px', border: '2px dashed #fecdd3' }}>
              <p style={{ color: '#64748b', marginBottom: '14px' }}>目前沒有【{selectedPart}】的題目喔！</p>
              <button
                onClick={handleGenerateNewSet}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f43f5e',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  borderRadius: '16px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🧸 請熊咘咘出 5 題
              </button>
            </div>
          )
        )}

        {/* 歷史作答紀錄彈窗 (Modal) */}
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
              {/* 彈窗頂部 */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                    📊 寶寶的答題歷程
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                    累計作答 {totalHistoryCount} 題 · 整體正確率 {historyAccuracy}%
                  </p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    border: 'none',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '12px',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#64748b',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* 彈窗內容區塊 */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#f43f5e', fontWeight: 'bold' }}>
                    熊咘咘翻筆記本中... 🐾
                  </div>
                ) : historyRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    目前還沒有歷史答題紀錄，快去寫寫看吧！✨
                  </div>
                ) : (
                  historyRecords.map((item, i) => (
                    <div
                      key={item.id || i}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: `1.5px solid ${item.is_correct ? '#a7f3d0' : '#fecdd3'}`,
                        backgroundColor: item.is_correct ? '#f0fdf4' : '#fff1f2',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
                          {item.questions?.part || 'TOEIC'} · {item.is_correct ? '✓ 答對' : '✕ 答錯'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString('zh-TW', { hour12: false }) : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px', lineHeight: '1.5' }}>
                        {item.questions?.question}
                      </p>
                      <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
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
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
