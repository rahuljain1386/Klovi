import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;
  const language = formData.get('language') as string;

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  // Forward to OpenAI Whisper for transcription
  const whisperForm = new FormData();
  whisperForm.append('file', audioFile);
  whisperForm.append('model', 'whisper-1');
  if (language) {
    whisperForm.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: whisperForm,
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({ text: data.text, language: data.language });
}
