import { NextResponse } from 'next/server';
import { supabase } from '../../supabaseClient';

// 設定 Vercel 雲端執行最長允許時間為 60 秒，徹底解決超時問題
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { part = 'Part 5' } = await req.json();

    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    let systemInstruction = '';
    let prompt = '';

    if (part === 'Part 5') {
      systemInstruction = '你是一位專業的多益考官。請出一組 Part 5 單句填空。輸出必須是標準 JSON Array。';
      prompt = `請出 5 題【TOEIC Part 5 單句填空】，涵蓋常考文法（詞性、時態、連接詞）。
格式要求為 JSON Array：
[
  {
    "part": "Part 5",
    "topic": "詞性辨析",
    "context": null,
    "question": "The marketing team submitted a _______ proposal that outlined the quarterly strategy.",
    "options": {"A": "comprehension", "B": "comprehensively", "C": "comprehensive", "D": "comprehends"},
    "answer": "C",
    "explanation": "修飾名詞 proposal 需要形容詞，故選 (C) comprehensive。",
    "translation": "行銷團隊提交了一份詳盡的提案，概述了季度策略。"
  }
]`;
    } else if (part === 'Part 6') {
      systemInstruction = '你是一位專業的多益考官。請出一個標準的 Part 6 題組（1篇短文含4個空格題）。輸出必須是標準 JSON Array。';
      prompt = `請設計 1 篇多益【Part 6 段落填空】題組，文章長度約 80-120 字（商務信件或公司內部公告），文章內挖出 [1], [2], [3], [4] 四個空格。
輸出 4 個題目的 JSON Array，每個題目的 context 欄位都放同一篇完整文章：
[
  {
    "part": "Part 6",
    "topic": "段落填空",
    "context": "To: All Employees\\nFrom: Facilities Management\\n\\nPlease note that the parking lot will be closed this weekend for repaving. [1] Alternative parking will be available at the south lot. We apologize for any [2] this may cause...",
    "question": "請為空格 [1] 選出最佳答案：",
    "options": {"A": "Therefore", "B": "Meanwhile", "C": "Otherwise", "D": "Although"},
    "answer": "A",
    "explanation": "前後為因果關係，因此選擇 Therefore。",
    "translation": "請注意，本週末停車場將關閉進行重新鋪設。[1] 同時南側停車場將提供替代車位。"
  }
]`;
    } else {
      // Part 7 題組
      systemInstruction = '你是一位專業的多益考官。請出一個標準的 Part 7 單篇閱讀題組（1篇文章搭配3題單選）。輸出必須是標準 JSON Array。';
      prompt = `請設計 1 篇多益【Part 7 閱讀理解】短篇題組，文章長度約 90-130 字（商務 Memo、短 Email 或產品活動公告），並針對文章出 3 題單選題。
輸出 3 個題目的 JSON Array，每個題目的 context 欄位放同一篇完整文章：
[
  {
    "part": "Part 7",
    "topic": "閱讀理解",
    "context": "Subject: Revised Project Timeline\\nDear Team,\\nDue to supply delays with our hardware vendor, the delivery of the alpha units will be shifted from October 5 to October 18. Please adjust your integration testing schedule accordingly.\\nBest regards,\\nMark Vance",
    "question": "Why has the delivery date been postponed?",
    "options": {"A": "Software bugs", "B": "Vendor supply delays", "C": "Budget constraints", "D": "Client requests"},
    "answer": "B",
    "explanation": "信件第一句提及 Due to supply delays with our hardware vendor。",
    "translation": "交貨日期為何延期？"
  }
]`;
    }

    let parsedQuestions: any[] = [];

    // 優先使用 OpenAI (若有提供)
    if (openAiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction + ' Return JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      const raw = await response.json();
      const content = raw.choices[0].message.content.trim();
      const cleaned = content.replace(/^```json/i, '').replace(/```$/i, '').trim();
      const jsonRes = JSON.parse(cleaned);
      parsedQuestions = Array.isArray(jsonRes) ? jsonRes : jsonRes.questions || Object.values(jsonRes)[0];
    } else if (geminiKey) {
      // 使用 Gemini 極速 Flash 模型
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API 錯誤: ${errText}`);
      }

      const raw = await response.json();
      const text = raw.candidates[0].content.parts[0].text.trim();
      const cleaned = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
      const jsonRes = JSON.parse(cleaned);
      parsedQuestions = Array.isArray(jsonRes) ? jsonRes : jsonRes.questions || Object.values(jsonRes)[0];
    } else {
      return NextResponse.json({ error: '尚未設定 API 金鑰' }, { status: 500 });
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error('生成的題目格式不正確');
    }

    // 存入題庫資料庫
    const records = parsedQuestions.map((q: any) => ({
      part: q.part || part,
      topic: q.topic || '閱讀測驗',
      context: q.context || null,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      translation: q.translation,
    }));

    const { data: insertedData } = await supabase
      .from('questions')
      .insert(records)
      .select();

    return NextResponse.json({ data: insertedData && insertedData.length > 0 ? insertedData : records });
  } catch (error: any) {
    console.error('出題錯誤細節:', error);
    return NextResponse.json({ error: error.message || '出題失敗' }, { status: 500 });
  }
}
