/* نوعُ المصدر كما يُعرَض — أيقونةٌ واسمٌ عربيّ.

   معجمٌ واحدٌ لشاشتَين: شاشةُ المدرّب حيث يختار النوع، وشاشةُ المتعلّم حيث
   يُعرَض. ولولاه لصار «كتابٌ صوتيّ» عند أحدهما «صوت» عند الآخر — والمدرّبُ
   يختار شيئا ويرى متعلّمُه اسما غيرَه.

   وموضعُه هنا لا في `src/application`: ذاك محضٌ بلا React، وهذا يحمل
   أيقونات. ولا في ملفّ مكوّنٍ: ملفٌّ يصدّر مكوّنا وثابتا معا يكسر
   `react-refresh` — وهو ما ردّه حاجزُ التلويم فعلا. */

import { BookMarked, FileText, Film, Headphones, Instagram, Link2 } from 'lucide-react'
import type { ResourceKind } from '@/application/trainer/plan-overlay'

export const RESOURCE_META: Record<ResourceKind, { label: string; icon: typeof FileText }> = {
  link: { label: 'رابط', icon: Link2 },
  video: { label: 'فيديو', icon: Film },
  book: { label: 'كتاب', icon: BookMarked },
  audiobook: { label: 'كتاب صوتيّ', icon: Headphones },
  social: { label: 'منشور', icon: Instagram },
  file: { label: 'ملفّ', icon: FileText },
}
