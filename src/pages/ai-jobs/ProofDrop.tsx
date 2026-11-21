/* مربّعُ رفع صورة الحوالة أو الإيصال — في نموذج الحجز وفي خطوة الدفع (٢١ نوفمبر ٢٠٢٦).
   مكوّنٌ واحدٌ يُقرأ في الموضعين فلا يفترق شكلُهما: صورةٌ أو لقطةُ شاشةٍ أو PDF، تُسحب أو تُختار، ومعاينتُها فيه. */

import { useState } from 'react'
import { PROOF_ACCEPT } from '@/application/private-course/ai-jobs'
import type { Proof } from './proof-file'

export default function ProofDrop({ id, label, hint, proof, busy, invalid, onPick }: {
  id: string
  label: string
  hint: string
  proof: Proof | null
  busy: boolean
  invalid?: boolean
  onPick: (file: File | undefined) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div className="aij-field">
      <span className="aij-label" id={`${id}-label`}>{label} <em>— {hint}</em></span>
      <label className={`aij-drop${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0]) }}>
        <input id={id} type="file" accept={`${PROOF_ACCEPT},image/*`} aria-labelledby={`${id}-label`}
          aria-invalid={invalid || undefined} onChange={(e) => onPick(e.target.files?.[0])} />
        <span className="thumb" aria-hidden="true">
          {proof?.preview
            ? <img src={proof.preview} alt="" />
            : proof?.pdf
              ? <b style={{ fontSize: 14 }}>PDF</b>
              : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#142240" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>}
        </span>
        <span className="txt">
          <b>{busy ? 'نجهّز الملف…' : proof ? 'تم اختيار الملف — اضغط لتغييره' : 'اضغط لاختيار صورة الحوالة'}</b>
          <small>{proof ? proof.name : 'من الهاتف أو الكمبيوتر'}</small>
        </span>
      </label>
    </div>
  )
}
