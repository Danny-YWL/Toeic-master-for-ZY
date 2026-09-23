import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { supabase } from '../../supabaseClient';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    part: { type: Type.STRING },
    topic: { type: Type.STRING },
    question: { type: Type.STRING },
    options: {
      type: Type.OBJECT,
      properties: {
        A: { type: Type.STRING },
        B: { type: Type.STRING },
        C: { type: Type.STRING },
        D: { type: Type.STRING },
      },
      required: ['A', 'B', 'C', 'D'],
    },
    answer: { type: Type.STRING },
    translation: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['part', 'topic', 'question', 'options', 'answer', 'translation', 'explanation'],
};

export async function POST(req: Request) {
  try {
    const { topic = '詞性辨析', count = 5 } = await req.json();

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      console.log(`[嘗試請求] 模型: ${model} 生成 ${count} 題...`);
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: `請扮演資深多益出題官，生成 ${count} 題 TOEIC Part 5 單句填空題，考點請聚焦在「${topic}」，難度符合多益 750~850 分標準。中文翻譯力求流暢，考點詳解力求精煉易懂。`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: questionSchema,
              },
            },
          });
          if (response?.text) break;
        } catch (err: any) {
          lastError = err;
          const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE');
          if (is503 && attempt < 2) {
            console.warn(`[${model}] 遇尖峰流量 (503)，等待 1.5 秒重試...`);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } else {
            console.warn(`[${model}] 請求失敗 (${err?.status || err?.message})，切換備援...`);
            break;
          }
        }
      }
      if (response?.text) break;
    }

    if (!response?.text) {
      throw lastError || new Error('出題線路繁忙，請稍候重試');
    }

    console.log('題目生成完畢，解析 JSON...');
    const questions = JSON.parse(response.text || '[]');

    console.log('正在寫入 Supabase 資料庫保存...');
    const { data, error } = await supabase.from('questions').insert(questions).select();
    if (error) throw error;

    console.log(`成功將 ${data.length} 題存入專屬題庫！`);
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err: any) {
    console.error('出題異常：', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
