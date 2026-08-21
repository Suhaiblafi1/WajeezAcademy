/* تهيئة الاختبارات: تثبيت الكتالوج المضمن قبل أي اختبار.
   السبب (البند ع-١): الكتالوج المضمن صار يُحمَّل كسولا في الإنتاج — احتياطيا
   عند تعذّر جلب اللقطة المنشورة — فلا يهبط في حزمة الدخول. الاختبارات لا API
   لها، فتثبّته صراحة هنا مرة واحدة لكل ملف اختبار بدل الاعتماد على استيراد
   ثابت كان يحمّله ضمنا. */

import bundled from '../data/catalog/core-catalog.v2.json'
import { installCoreCatalogRaw, type CoreCatalogRaw } from '../data/core-catalog-source'

installCoreCatalogRaw(bundled as unknown as CoreCatalogRaw)
