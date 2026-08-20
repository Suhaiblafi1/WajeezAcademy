/**
 * مصادر الدورة — Course Resources Adapter
 * -------------------------------------------------------
 * طبقة موحدة فوق كل أنواع المصادر التعليمية للدورة:
 * ملخصات وجيز، كتب، بودكاست، فيديو، أدوات، قوالب.
 *
 * الآن: النوع الوحيد ذو البيانات الفعلية هو «ملخصات وجيز» عبر
 * WajeezBooksAdapter الحالي — لا يُكسر ولا يُستبدل، بل يُغلَّف.
 * عند توفر نوع جديد مستقبلا: يُضاف مصدره هنا ويُحوَّل إلى CourseResource،
 * فتظهر تبويبته في الواجهة تلقائيا دون تعديل مكونات العرض.
 *
 * قاعدة صارمة: لا موارد Placeholder — نوع بلا بيانات لا يظهر إطلاقا.
 */

import { wajeezBooks, type BookSummary } from "@/services/wajeezBooks";

export type CourseResourceType = "summary" | "book" | "podcast" | "video" | "tool" | "template";

export type ResourceNecessity = "required" | "recommended" | "optional";

export interface CourseResource {
  id: string;
  type: CourseResourceType;
  title: string;
  /** الزمن التقريبي للاستهلاك بالدقائق عند توفره */
  estimatedMinutes?: number;
  /** لماذا رُشح لك هذا المصدر */
  whyRecommended?: string;
  /** متى يكون استخدامه أنفع داخل رحلتك */
  whenToUse?: string;
  necessity: ResourceNecessity;
  /** نص فعل البطاقة عند وجود فعل مباشر */
  actionLabel?: string;
  /** البيانات الأصلية للنوع (BookSummary لنوع summary) — للمكوّن المتخصص */
  payload?: unknown;
}

export interface CourseResourcesAdapter {
  getResourcesForCourse(courseId: string): Promise<CourseResource[]>;
}

/* ملخصات وجيز → CourseResource — التغليف الوحيد المفعّل حاليا */
function fromBookSummary(b: BookSummary): CourseResource {
  return {
    id: b.id,
    type: "summary",
    title: b.title,
    estimatedMinutes: b.minutes,
    whyRecommended: "يبني أرضية مفاهيم الدورة في دقائق استماع مركزة.",
    whenToUse: "قبل بدء وحدات الدورة أو بين درسين متتاليين.",
    necessity: "recommended",
    actionLabel: "اسمع الملخص",
    payload: b,
  };
}

const DefaultAdapter: CourseResourcesAdapter = {
  async getResourcesForCourse(courseId) {
    const books = await wajeezBooks.getBooksForCourse(courseId).catch(() => [] as BookSummary[]);
    return books.map(fromBookSummary);
    /* مستقبلا: تُدمج هنا مصادر الكتب والبودكاست والفيديو والأدوات والقوالب
       من محولاتها الخاصة بنفس الشكل — والواجهة تتوسع تلقائيا. */
  },
};

export const courseResources: CourseResourcesAdapter = DefaultAdapter;
