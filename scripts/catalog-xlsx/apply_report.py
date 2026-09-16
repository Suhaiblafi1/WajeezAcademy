#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تطبيقُ تقريرِ القارئِ على ملفّاتِ الكتالوج.

   `read_workbook.py` يقرأ ولا يكتب — عمدا: يُرى الفرقُ قبل أن يمسّ شيئا.
   وهذه تكتب **ما قَبِله هو**، لا ما تقرؤه من الكرّاسة ثانية: مصدرُها ملفُّ
   `--json` الخارجُ منه. فقواعدُ التحقّقِ تبقى في موضعٍ واحد، ولا تفترق
   نسختانِ منها بعد شهر.

   ولا تكتب شيئا وفي التقرير مردودٌ واحد — لأنّ الاستيرادَ النصفيَّ أسوأُ من
   المردود: يترك الكتالوجَ بين صورتَين لا يعرف أحدٌ أيَّهما المقصودة.

الاستعمال:
    python3 scripts/catalog-xlsx/read_workbook.py العائد.xlsx --json تقرير.json
    python3 scripts/catalog-xlsx/apply_report.py تقرير.json [--sheets الدورات,المحاور] [--dry-run]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from read_workbook import (  # noqa: E402
    CATALOG, SKILLS, PROPOSED, INT_FIELDS, LIST_FIELDS,
)

# الورقةُ ← (الملفّ، المجموعةُ داخله، حقلُ المعرّف)
TARGETS = {
    "الدورات": (CATALOG, "courses", "course_id"),
    "المحاور": (CATALOG, "modules", "module_id"),
    "محتوى_الدروس": (CATALOG, "modules", "module_id"),
    "المهارات": (SKILLS, "skills", "skill_id"),
    "مهارات_بلا_دورة": (SKILLS, "skills", "skill_id"),
    "دورات_مقترحة": (PROPOSED, "courses", "proposed_id"),
}


def coerce(field: str, value: str, clear: bool):
    """نصُّ الكرّاسةِ إلى شكلِ الحقلِ في JSON — بالقوائمِ والأعدادِ كما يتوقّعها المستهلك."""
    if clear:
        return [] if field in LIST_FIELDS else None
    if field in LIST_FIELDS:
        return [ln.strip() for ln in value.split("\n") if ln.strip()]
    if field in INT_FIELDS:
        f = float(value)
        return int(f) if f.is_integer() else f
    return value


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    report_path = sys.argv[1]
    dry = "--dry-run" in sys.argv
    only = None
    if "--sheets" in sys.argv:
        only = {s.strip() for s in sys.argv[sys.argv.index("--sheets") + 1].split(",") if s.strip()}

    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)

    problems = report.get("problems") or []
    if problems:
        print(f"✗ في التقريرِ {len(problems)} مردودا — لا يُكتب شيءٌ حتّى تُحلَّ.")
        for p in problems[:5]:
            print(f"    [{p.get('sheet')}] {p.get('id')} · {p.get('field')}: {p.get('reason') or p.get('blocked')}")
        return 1

    changes = report.get("changes") or []
    if only is not None:
        skipped = [c for c in changes if c["sheet"] not in only]
        changes = [c for c in changes if c["sheet"] in only]
        if skipped:
            print(f"· أُجّل {len(skipped)} تغييرا خارجَ الورقاتِ المطلوبة.")

    unknown = sorted({c["sheet"] for c in changes} - set(TARGETS))
    if unknown:
        print(f"✗ ورقاتٌ لا وجهةَ لها: {unknown}")
        return 1

    # تُحمَّل الملفّاتُ مرّةً وتُكتب مرّةً — لا قراءةَ لكلِّ تغيير
    docs: dict[str, dict] = {}
    index: dict[tuple[str, str], dict] = {}
    for path, bucket, key in {TARGETS[s] for s in {c["sheet"] for c in changes}}:
        if path not in docs:
            with open(path, encoding="utf-8") as f:
                docs[path] = json.load(f)
        for rec in docs[path].get(bucket, []):
            index[(path, rec[key])] = rec

    applied = 0
    per_sheet: dict[str, int] = {}
    for ch in changes:
        path, bucket, _ = TARGETS[ch["sheet"]]
        rec = index.get((path, ch["id"]))
        if rec is None:
            print(f"✗ {ch['id']} في {ch['sheet']} لا أصلَ له — أُوقف بلا كتابة.")
            return 1
        field, clear = ch["field"], bool(ch.get("clear"))
        value = coerce(field, ch["to"], clear)
        if clear and field not in LIST_FIELDS:
            rec.pop(field, None)
        else:
            rec[field] = value
        applied += 1
        per_sheet[ch["sheet"]] = per_sheet.get(ch["sheet"], 0) + 1

    print(f"تغييراتٌ طُبّقت: {applied}")
    for s, n in sorted(per_sheet.items(), key=lambda x: -x[1]):
        print(f"    [{s}] {n}")
    if dry:
        print("— تجربةٌ جافّة: لم يُكتب شيء.")
        return 0

    for path, doc in docs.items():
        with open(path, "w", encoding="utf-8") as f:
            f.write(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        print(f"كُتب {os.path.relpath(path, os.path.dirname(os.path.dirname(os.path.dirname(path))))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
