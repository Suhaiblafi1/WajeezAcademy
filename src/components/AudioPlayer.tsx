import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play } from "lucide-react";

/**
 * مشغل صوتي تجريبي لملخصات كتب وجيز — يحاكي الاستماع الحقيقي:
 * تقدم بالثواني، سرعات استماع، واكتمال عند 90%+.
 * عند الربط الفعلي يُستبدل مصدر الصوت بملف الملخص من واجهة وجيز البرمجية
 * مع بقاء واجهة onProgress نفسها.
 */
export default function AudioPlayer({
  minutes,
  onProgress,
}: {
  minutes: number;
  onProgress: (pct: number) => void;
}) {
  // محاكاة مضغوطة: الدقيقة المحتوى = 3 ثوان استماع تجريبي
  const totalSec = Math.max(18, minutes * 3);
  const [sec, setSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number | null>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setSec((s) => {
        const next = Math.min(totalSec, s + speed);
        const pct = Math.round((next / totalSec) * 100);
        if (pct !== lastSaved.current && pct % 10 === 0) {
          lastSaved.current = pct;
          onProgress(pct);
        }
        return next;
      });
    }, 1000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, speed, totalSec, onProgress]);

  const pct = Math.round((sec / totalSec) * 100);
  const fmt = (v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-l from-panel/60 to-black/40 p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (playing && pct > lastSaved.current) { lastSaved.current = pct; onProgress(pct); }
            setPlaying(!playing);
          }}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-[#38A7B4] text-[#08272B] shadow-[0_0_25px_-5px_#38A7B4] transition hover:scale-105"
          aria-label={playing ? "إيقاف الاستماع" : "استمع للملخص"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 -translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px] text-white/50">
            <span className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-[#6EC7D1]" />
              {pct >= 90 ? <span className="font-bold text-[#6EC7D1]">اكتمل الاستماع ✓</span> : `استماع ${pct}%`}
            </span>
            <span>{fmt(sec)} / {fmt(totalSec)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={totalSec}
            value={sec}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSec(v);
              const p = Math.round((v / totalSec) * 100);
              if (p > lastSaved.current) { lastSaved.current = p; onProgress(p); }
            }}
            className="mt-1.5 w-full accent-[#38A7B4]"
            aria-label="شريط تقدم الاستماع"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-white/30">معاينة تجريبية — يُشغَّل صوت الملخص الحقيقي هنا عند الربط</p>
        <div className="flex items-center gap-1.5">
          {[1, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`cursor-pointer rounded-lg border px-2 py-0.5 text-[11px] transition ${speed === s ? "border-[#38A7B4] text-[#6EC7D1]" : "border-white/10 text-white/45 hover:border-white/30"}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
