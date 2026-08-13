import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

/**
 * مشغل فيديو تجريبي — يحاكي التشغيل الحقيقي:
 * تقدم بالثواني، سرعات تشغيل، استئناف من آخر نقطة، وإكمال عند 90%+.
 * عند الربط الفعلي يُستبدل بمشغل (mux/cloudflare stream) مع نفس واجهة onProgress.
 */
export default function VideoPlayer({
  lessonId,
  minutes,
  initialPct,
  onProgress,
}: {
  lessonId: string;
  minutes: number;
  initialPct: number;
  onProgress: (pct: number) => void;
}) {
  // نحاكي درسا مدته minutes دقيقة بسرعة عرض مضغوطة (الثانية = دقيقة/4 من المحتوى)
  const totalSec = Math.max(20, minutes * 15);
  const [sec, setSec] = useState((initialPct / 100) * totalSec);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number | null>(null);
  const lastSaved = useRef(initialPct);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setSec((s) => {
        const next = Math.min(totalSec, s + speed);
        const pct = Math.round((next / totalSec) * 100);
        if (pct !== lastSaved.current && pct % 5 === 0) {
          lastSaved.current = pct;
          onProgress(pct);
        }
        return next;
      });
    }, 1000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, speed, totalSec, onProgress]);

  const pct = Math.round((sec / totalSec) * 100);
  const fmt = (v: number) => {
    const m = Math.floor(v / 60);
    const s = Math.floor(v % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      {/* شاشة العرض */}
      <div className="relative grid h-52 place-items-center bg-gradient-to-br from-[#123B40] via-[#0D0D0D] to-[#1A2E31] sm:h-64">
        <button
          onClick={() => {
            if (playing && pct > lastSaved.current) { lastSaved.current = pct; onProgress(pct); }
            setPlaying(!playing);
          }}
          className="grid h-16 w-16 cursor-pointer place-items-center rounded-full bg-[#38A7B4]/90 text-white shadow-[0_0_40px_-5px_#38A7B4] transition hover:scale-105"
          aria-label={playing ? "إيقاف" : "تشغيل"}
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 -translate-x-0.5" />}
        </button>
        <span className="absolute bottom-3 right-4 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/70">
          معاينة تجريبية — يُعرض الفيديو الحقيقي هنا عند الربط
        </span>
        {pct >= 90 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#38A7B4] px-3 py-1 text-xs font-black text-[#08272B]">مكتمل ✓</span>
        )}
      </div>
      {/* شريط التحكم */}
      <div className="space-y-2 p-3">
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
          className="w-full accent-[#38A7B4]"
          aria-label="شريط التقدم"
        />
        <div className="flex items-center justify-between text-xs text-white/55">
          <span>{fmt(sec)} / {fmt(totalSec)} · {pct}%</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSec(0); onProgress(0); lastSaved.current = 0; }}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1 hover:border-white/30"
            >
              <RotateCcw className="h-3 w-3" /> من البداية
            </button>
            {[1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`cursor-pointer rounded-lg border px-2 py-1 ${speed === s ? "border-[#38A7B4] text-[#6EC7D1]" : "border-white/10 hover:border-white/30"}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="hidden">{lessonId}</p>
    </div>
  );
}
