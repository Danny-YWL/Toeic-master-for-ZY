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
    const randomMsg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
    setCheerMsg(randomMsg);
  }, [currentIndex, isSubmitted]);

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
    <main
      className="min-h-screen py-8 px-4"
      style={{
        backgroundColor: '#fff1f2',
        minHeight: '100vh',
        padding: '32px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        {/* 可愛粉萌頂部導覽列 */}
        <header
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid #ffe4e6',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🧸</span>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
                寶寶的多益專屬特訓室
              </h1>
              <span
                style={{
                  fontSize: '12px',
                  backgroundColor: '#ffe4e6',
                  color: '#e11d48',
                  fontWeight: 'bold',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                }}
              >
                Part 5 專練
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#f43f5e',
                fontWeight: '500',
                marginTop: '6px',
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>💌</span> <span>{cheerMsg}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleReviewFromBank}
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📚</span>
              <span>題庫抽 10 題複習</span>
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.25)',
              }}
            >
              <span>🧸</span>
              <span>熊咘咘出新題目</span>
            </button>
          </div>
        </header>

        {loading && (
          <div
            style={{
              padding: '16px',
              marginBottom: '24px',
              backgroundColor: '#ffffff',
              border: '1px solid #fecdd3',
              borderRadius: '24px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>🐾</span>
            <span>{loadingText}</span>
          </div>
        )}

        {totalQuestions > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {/* 左側答題狀態面板 */}
            <div
              style={{
                flex: '1 1 260px',
                maxWidth: '280px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid #ffe4e6',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                height: 'fit-content',
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em' }}>
                    作答進度
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#f43f5e',
                      backgroundColor: '#fff1f2',
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      border: '1px solid #ffe4e6',
                    }}
                  >
                    {answeredCount} / {totalQuestions}
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '8px', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#fb7185',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${progressPercent}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* 題號按鈕格 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const selectedKey = userSelections[idx];
                  const isAnswered = selectedKey !== undefined;
                  const isCorrect = isSubmitted && selectedKey === q.answer;
                  const isWrong = isSubmitted && isAnswered && !isCorrect;

                  let bgColor = '#ffffff';
                  let borderColor = '#e2e8f0';
                  let textColor = '#334155';
                  let badgeBg = '#e2e8f0';
                  let badgeText = '#475569';

                  if (isCurrent) {
                    bgColor = '#fff1f2';
                    borderColor = '#fb7185';
                    textColor = '#881337';
                  }

                  if (!isSubmitted) {
                    if (isAnswered) {
                      badgeBg = '#f43f5e';
                      badgeText = '#ffffff';
                      if (!isCurrent) borderColor = '#fecdd3';
                    }
                  } else {
                    if (isCorrect) {
                      bgColor = '#ecfdf5';
                      borderColor = '#34d399';
                      badgeBg = '#10b981';
                      badgeText = '#ffffff';
                    } else if (isWrong) {
                      bgColor = '#fff1f2';
                      borderColor = '#fb7185';
                      badgeBg = '#f43f5e';
                      badgeText = '#ffffff';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        position: 'relative',
                        height: '46px',
                        borderRadius: '14px',
                        border: `1.5px solid ${borderColor}`,
                        backgroundColor: bgColor,
                        color: textColor,
                        fontWeight: isCurrent ? 'bold' : '600',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{idx + 1}</span>
                      {isAnswered && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '1px 5px',
                            borderRadius: '9999px',
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            backgroundColor: badgeBg,
                            color: badgeText,
                          }}
                        >
                          {selectedKey}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    <span>📝</span>
                    <span>寫完了，交卷對答案！</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={handleReviewFromBank}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        borderRadius: '16px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      📚 題庫隨機再抽一組
                    </button>
                    <button
                      onClick={handleGenerateNewSet}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#f43f5e',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        borderRadius: '16px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>🧸</span>
                      <span>請熊咘咘再出新題目</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 右側作答卡片 */}
            <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 結算結合成績卡 */}
              {isSubmitted && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #ffe4e6',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                      {correctCount === totalQuestions
                        ? '🎉 哇！！全對滿分！太厲害了寶寶！'
                        : correctCount >= totalQuestions * 0.7
                        ? '✨ 答得很棒耶！超優秀！'
                        : '很棒喔！把錯題弄懂實力又更強了 💖'}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                      點擊左側題號看熊咘咘整理的考點與中譯解析喔！
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '30px', fontWeight: '900', color: '#f43f5e' }}>{correctCount}</span>
                    <span style={{ color: '#94a3b8', fontWeight: 'bold' }}> / {totalQuestions}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      正確率 {Math.round((correctCount / totalQuestions) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {/* 題目本體 */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                      {currentQ.topic || 'Part 5 單句填空'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
                      第 {currentIndex + 1} / {totalQuestions} 題
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '17px',
                      fontWeight: '600',
                      color: '#1e293b',
                      lineHeight: '1.6',
                      marginBottom: '24px',
                    }}
                  >
                    {currentQ.question}
                  </p>

                  {/* 選項列表（修正空格與間隔） */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {Object.entries(currentQ.options).map(([key, val]: any) => {
                      const selected = userSelections[currentIndex] === key;
                      let itemBg = '#ffffff';
                      let itemBorder = '#e2e8f0';
                      let itemColor = '#334155';
                      let circleBg = '#f1f5f9';
                      let circleColor = '#475569';

                      if (!isSubmitted) {
                        if (selected) {
                          itemBg = '#fff1f2';
                          itemBorder = '#fb7185';
                          itemColor = '#881337';
                          circleBg = '#f43f5e';
                          circleColor = '#ffffff';
                        }
                      } else {
                        if (key === currentQ.answer) {
                          itemBg = '#ecfdf5';
                          itemBorder = '#10b981';
                          itemColor = '#064e3b';
                          circleBg = '#10b981';
                          circleColor = '#ffffff';
                        } else if (selected && key !== currentQ.answer) {
                          itemBg = '#fff1f2';
                          itemBorder = '#fb7185';
                          itemColor = '#881337';
                          circleBg = '#f43f5e';
                          circleColor = '#ffffff';
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
                            color: itemColor,
                            cursor: isSubmitted ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '15px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {/* 選項標籤 (A / B / C / D) */}
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '10px',
                              marginRight: '14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              backgroundColor: circleBg,
                              color: circleColor,
                              flexShrink: 0,
                            }}
                          >
                            {key}
                          </span>

                          {/* 選項文字本體 */}
                          <span style={{ flex: 1, fontWeight: selected ? '600' : 'normal' }}>
                            {val}
                          </span>

                          {isSubmitted && key === currentQ.answer && (
                            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold', marginLeft: '8px' }}>
                              ✓ 正確答案
                            </span>
                          )}
                          {isSubmitted && selected && key !== currentQ.answer && (
                            <span style={{ fontSize: '13px', color: '#e11d48', fontWeight: 'bold', marginLeft: '8px' }}>
                              ✕ 寶寶選的答案
                            </span>
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
                      paddingTop: '16px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#475569',
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
                        fontWeight: '600',
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
                        marginTop: '24px',
                        padding: '20px',
                        backgroundColor: '#fff1f2',
                        borderRadius: '16px',
                        border: '1px solid #ffe4e6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '0 0 6px 0', letterSpacing: '0.05em' }}>
                          中文翻譯
                        </h4>
                        <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                          {currentQ.translation}
                        </p>
                      </div>
                      <div style={{ paddingTop: '10px', borderTop: '1px solid #ffe4e6' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', margin: '0 0 6px 0', letterSpacing: '0.05em' }}>
                          考點詳解
                        </h4>
                        <p style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.6', margin: 0 }}>
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
                padding: '80px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                border: '2px dashed #fecdd3',
              }}
            >
              <p style={{ color: '#64748b', marginBottom: '14px', fontWeight: '500', fontSize: '15px' }}>
                題庫還沒有題目喔！
              </p>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
                }}
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
