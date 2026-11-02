/* ═══ وما لا يُشترى هذا الموسم: بديلان لكلّ دورة (٢ نوفمبر ٢٠٢٦) ═══
   القاعدةُ في `application/catalog/season-replacements.ts`، وهنا ما تقرؤه الشاشتان — نتيجةُ التشخيص وصفحةُ المسار
   التي ينتهي إليها — من جواب الخادم. والبديلُ يحلّ محلّها بالاستبدال نفسِه (`onSwapPick`). */

import { useMemo } from 'react'
import { availableThisSeason } from '@/application/catalog/listed-courses'
import { seasonReplacements } from '@/application/catalog/season-replacements'
import { termTitleOfKey } from '@/application/terms/season'
import type { CourseSuggestion } from '@/components/CourseJourney'
import { courseById, courses } from '@/data/courses'
import { pathwayDomain } from '@/data/pathways'
import { useListedCourses } from './listed-courses'

export function useSeasonReplacements(planIds: readonly string[], gaps: readonly string[] = []) {
  const listed = useListedCourses()
  return useMemo(() => {
    const map = seasonReplacements({
      planIds, catalog: courses, gaps, domainOf: pathwayDomain,
      available: (id) => availableThisSeason(id, listed),
    })
    const unavailable: Record<string, CourseSuggestion[]> = {}
    for (const [id, picks] of map) {
      unavailable[id] = picks.flatMap((x) => {
        const c = courseById(x)
        return c ? [{ id: c.id, name: c.name, note: `${c.skill} · من مسار ${c.pathwayName}` }] : []
      })
    }
    const seasonTitleAr = listed.state === 'ready' && listed.season ? termTitleOfKey(listed.season) : null
    return { unavailable, seasonTitleAr }
  }, [planIds, gaps, listed])
}
