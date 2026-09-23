import { NextResponse } from 'next/server';
import { supabase } from '../../supabaseClient';

export async function POST(req: Request) {
  try {
    const { part = 'Part 5', topic = '綜合測驗', count = 5 } = await req.json();

    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    let prompt = '';
    if (part === 'Part 5') {
      prompt = `你是一位專業的多益命題老師。請為台灣學生設計 5 題高品質的【TOEIC Part 5 單句填空】。考點為：${topic}。
請輸出嚴格的 JSON Array 格式，不要加入額外的 Markdown 標籤或任何解釋文字：
[
  {
    "part": "Part 5",
    "topic": "${topic}",
    "context": null,
    "question": "The marketing director suggested that we _______ the campaign until next quarter.",
    "options": {"A": "postpone", "B": "postponing", "C": "postponed", "D": "postpones"},
    "answer": "A",
    "explanation": "suggest that + S + (should) + 原形動詞，故選 postpone。",
    "translation": "行銷總監建議我們將該活動延期至下個季度。"
  }
]`;
    } else if (part === 'Part 6') {
      prompt = `你是一位專業的多益命題老師。請設計一篇【TOEIC Part 6 段落填空】的商務情境文章（信件、備忘錄或公告），文章內挖出 4~5 個空格（如 [1], [2]），並提供對應的單選題。
請輸出嚴格的 JSON Array 格式，每個元素代表一題，context 請放完整文章：
[
  {
    "part": "Part 6",
    "topic": "段落填空",
    "context": "To: All Staff\\nFrom: Management\\n\\nPlease be informed that the main cafeteria will be closed for renovation starting Monday. During this period, [1] lunch options will be available at the annex building...",
    "question": "請為文章中空格 [1] 選擇最適當的字詞：",
    "options": {"A": "temporary", "B": "temporaryly", "C": "temporarily", "D": "temporariness"},
    "answer": "A",
    "explanation": "修飾名詞 lunch options 需使用形容詞 temporary。",
    "translation": "餐廳將進行整修，期間將於副棟提供臨時的午餐選擇。"
  }
]`;
    } else {
      // Part 7
      prompt = `你是一位專業的多益命題老師。請設計一篇【TOEIC Part 7 閱讀理解】短文（如商務 Email、廣告、行程表），並針對文章設計 3~4 題單選題。
請輸出嚴格的 JSON Array 格式，每個元素代表一題，context 放完整文章：
[
  {
    "part": "Part 7",
    "topic": "閱讀理解",
    "context": "Email\\nFrom: Alice Green\\nTo: Bob Lee\\nSubject: Budget Approval\\n\\nDear Bob, I have reviewed the revised Q3 marketing budget. While the overall numbers look reasonable, the social media allocation is slightly higher than expected. Please send me the breakdown by Friday.\\n\\nBest,\\nAlice",
    "question": "What is the main purpose of the email?",
    "options": {"A": "To request further budget details", "B": "To reject the budget outright", "C": "To schedule a meeting", "D": "To introduce a new client"},
    "answer": "A",
    "explanation": "信件中提及 Please send me the breakdown by Friday，即要求進一步細節。",
    "translation": "信件的主要目的為何？"
  }
]`;
    }

    let parsedQuestions: any[] = [];

    // 優先使用 OpenAI gpt-4o-mini (極速模式)
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
            { role: 'system', content: 'You must respond only with a valid JSON array matching the user instruction.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      const raw = await response.json();
      const content = raw.choices[0].message.content;
      const jsonRes = JSON.parse(content);
      parsedQuestions = Array.isArray(jsonRes) ? jsonRes : jsonRes.questions || jsonRes.data || Object.values(jsonRes)[0];
    } else if (geminiKey) {
      // 若無 OpenAI 則使用極速版 Gemini Flash 模型
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      const raw = await response.json();
      const text = raw.candidates[0].content.parts[0].text;
      parsedQuestions = JSON.parse(text);
    } else {
      return NextResponse.json({ error: '請設定 OPENAI_API_KEY 或 GEMINI_API_KEY' }, { status: 500 });
    }

    // 存入 Supabase 資料庫
    const records = parsedQuestions.map((q: any) => ({
      part: q.part || part,
      topic: q.topic || topic,
      context: q.context || null,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      translation: q.translation,
    }));

    const { data: insertedData, error: dbError } = await supabase
      .from('questions')
      .insert(records)
      .select();

    if (dbError) {
      // 就算題庫寫入有小差錯，依然回傳生成的題目給前端直接作答
      return NextResponse.json({ data: records });
    }

    return NextResponse.json({ data: insertedData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '出題失敗' }, { status: 500 });
  }
}
