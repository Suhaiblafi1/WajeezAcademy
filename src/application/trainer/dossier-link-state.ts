/* حالُ رابطِ السجلّ كما تُقرأ — قرارٌ يُفحص، لا شرطٌ في JSX.

   للرابط ثلاثةُ تواريخَ وحقلُ إلغاء، ومنها تُشتقّ جملةٌ واحدةٌ يقرؤها
   المسؤول: أُلغي، أم انتهى أجلُه، أم لم يُفتح بعد، أم فُتح آخرَ مرّةٍ متى.

   وأُخرجت من المكوّن لأنّ شرطا في JSX لا يُفحص إلّا بمطابقة نصِّ ملفّ — وهي
   المطابقةُ التي مرّ منها حرّاسٌ خضرٌ لأسبابٍ خاطئة في هذه المنصّة. */

import { fmtDateTime } from '../text/format-ar'

export interface DossierLinkTimes {
  expiresAt: string
  revokedAt: string | null
  firstOpenedAt: string | null
  lastOpenedAt: string | null
}

export interface DossierLinkState {
  textAr: string
  /** انقضى: لا يُفتح ولا يُلغى — فلا يُعرض له زرّ */
  spent: boolean
}

export function dossierLinkState(row: DossierLinkTimes, now = Date.now()): DossierLinkState {
  /* والإلغاءُ يسبق الأجل: من أُلغي رابطُه أُلغي وإن كان أجلُه باقيا،
     وقولُ «انتهى أجلُه» عنه يُخفي أنّ إنسانا ألغاه عمدا. */
  if (row.revokedAt) return { textAr: 'أُلغي', spent: true }
  if (new Date(row.expiresAt).getTime() <= now) return { textAr: 'انتهى أجلُه', spent: true }
  if (!row.firstOpenedAt) return { textAr: 'لم يُفتح بعد', spent: false }
  return {
    textAr: `فُتح آخرَ مرّةٍ ${fmtDateTime(new Date(row.lastOpenedAt ?? row.firstOpenedAt))}`,
    spent: false,
  }
}
