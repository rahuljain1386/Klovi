'use client';

import { useState, useRef } from 'react';

interface Props {
  onTranscript: (text: string) => void;
  lang?: string;
  small?: boolean;
}

export default function MicButton({ onTranscript, lang = 'en', small = false }: Props) {
  const [rec, setRec] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const ch = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      mr.current = r;
      ch.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) ch.current.push(e.data); };
      r.onstop = async () => {
        s.getTracks().forEach(t => t.stop());
        const fd = new FormData();
        fd.append('audio', new Blob(ch.current, { type: 'audio/webm' }), 'r.webm');
        fd.append('language', lang === 'hi' ? 'hi' : lang === 'es' ? 'es' : 'en');
        try {
          const res = await fetch('/api/ai/voice', { method: 'POST', body: fd });
          if (res.ok) {
            const { text } = await res.json();
            if (text) onTranscript(text);
          }
        } catch {}
      };
      r.start();
      setRec(true);
    } catch {}
  };

  const stop = () => { mr.current?.stop(); setRec(false); };

  const sz = small ? 'w-9 h-9' : 'w-12 h-12';

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        rec
          ? 'bg-rose text-white scale-110 animate-pulse'
          : 'bg-cream text-warm-gray hover:bg-amber/20'
      }`}
      title="Hold to speak"
    >
      <svg
        width={small ? 16 : 20}
        height={small ? 16 : 20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
  );
}
