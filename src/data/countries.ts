/* دولُ العالم — اسمٌ عربيٌّ وآخرُ إنجليزيٌّ ورمزُ هاتفٍ ومنطقةٌ زمنيّة.

   ═══ لماذا وُلد هذا الملفّ ═══

   كان مُنتقي رمز الهاتف في نموذج المدرّب أحدَ عشرَ رمزا عربيّا في قائمةٍ
   منسدلةٍ عاديّة، ودولةُ الإقامة تسعَ عشرةَ دولةً عربيّة. ومن يقدّم من
   تركيا أو ماليزيا أو بريطانيا — وهم يقدّمون — لا يجد رمزَه أصلا، فيكتب
   رقمَه بلا رمزٍ أو يختار رمزا ليس رمزَه.

   وقرارُ صاحب المنصّة (١٢ سبتمبر ٢٠٢٦): كلُّ دول العالم، والبحثُ بالاسم لا
   بالرمز وحدَه — فمن لا يحفظ أنّ ماليزيا `+60` يكتب «ماليزيا» فيجدها.

   ═══ ولماذا المنطقةُ الزمنيّةُ هنا ═══

   النموذجُ يشتقّ المنطقةَ من دولة الإقامة ولا يسأل عنها (سؤالٌ أقلّ). وكانت
   الخريطةُ تسعَ عشرةَ دولةً عربيّة، فمن سكن خارجَها أُنشئ طلبُه بلا منطقةٍ
   زمنيّة — والمقابلةُ تُجدوَل بالساعة. فلكلّ دولةٍ هنا منطقتُها الكبرى.

   ⚠️ والمنطقةُ الواحدةُ لا تكفي الدولَ العريضة (أمريكا، روسيا، أستراليا):
   المكتوبُ هو منطقةُ أكبرِ حاضرةٍ فيها — تخمينٌ معلَنٌ يُصحّحه الإنسان، لا
   ادّعاءُ دقّة.

   ولا يُكتب اسمُ دولةٍ في شيفرةٍ أخرى: من أراد الإضافةَ أو التصحيحَ يفتح
   هذا الملفَّ وحدَه. */

export interface Country {
  /** رمز ISO 3166-1 alpha-2 — مفتاحُ الصفّ ومصدرُ عَلَمه */
  iso2: string
  /** الاسمُ العربيُّ — وهو المحفوظُ في القاعدة والمعروضُ في الشاشة */
  ar: string
  /** الاسمُ الإنجليزيُّ — للبحث وحدَه: من يكتب `Jordan` يجد الأردن */
  en: string
  /** رمزُ الاتّصال بصيغة `+962` */
  dial: string
  /** منطقةٌ زمنيّةٌ IANA — كبرى حواضر الدولة */
  tz: string
  /** من الجامعة العربيّة — تُعرض أوّلا، وهي جمهورُ المنصّة الأوّل */
  arab?: true
}

/* الترتيبُ هنا هو ترتيبُ العرض: العربيّةُ أوّلا (جمهورُ المنصّة)، ثمّ سائرُ
   الدول مرتَّبةً بالعربيّة في المنتقي نفسِه. */
export const COUNTRIES: Country[] = [
  { iso2: 'JO', ar: 'الأردن', en: 'Jordan', dial: '+962', tz: 'Asia/Amman', arab: true },
  { iso2: 'SA', ar: 'السعودية', en: 'Saudi Arabia', dial: '+966', tz: 'Asia/Riyadh', arab: true },
  { iso2: 'AE', ar: 'الإمارات', en: 'United Arab Emirates', dial: '+971', tz: 'Asia/Dubai', arab: true },
  { iso2: 'EG', ar: 'مصر', en: 'Egypt', dial: '+20', tz: 'Africa/Cairo', arab: true },
  { iso2: 'KW', ar: 'الكويت', en: 'Kuwait', dial: '+965', tz: 'Asia/Kuwait', arab: true },
  { iso2: 'QA', ar: 'قطر', en: 'Qatar', dial: '+974', tz: 'Asia/Qatar', arab: true },
  { iso2: 'OM', ar: 'عُمان', en: 'Oman', dial: '+968', tz: 'Asia/Muscat', arab: true },
  { iso2: 'BH', ar: 'البحرين', en: 'Bahrain', dial: '+973', tz: 'Asia/Bahrain', arab: true },
  { iso2: 'IQ', ar: 'العراق', en: 'Iraq', dial: '+964', tz: 'Asia/Baghdad', arab: true },
  { iso2: 'PS', ar: 'فلسطين', en: 'Palestine', dial: '+970', tz: 'Asia/Hebron', arab: true },
  { iso2: 'LB', ar: 'لبنان', en: 'Lebanon', dial: '+961', tz: 'Asia/Beirut', arab: true },
  { iso2: 'SY', ar: 'سوريا', en: 'Syria', dial: '+963', tz: 'Asia/Damascus', arab: true },
  { iso2: 'LY', ar: 'ليبيا', en: 'Libya', dial: '+218', tz: 'Africa/Tripoli', arab: true },
  { iso2: 'TN', ar: 'تونس', en: 'Tunisia', dial: '+216', tz: 'Africa/Tunis', arab: true },
  { iso2: 'DZ', ar: 'الجزائر', en: 'Algeria', dial: '+213', tz: 'Africa/Algiers', arab: true },
  { iso2: 'MA', ar: 'المغرب', en: 'Morocco', dial: '+212', tz: 'Africa/Casablanca', arab: true },
  { iso2: 'SD', ar: 'السودان', en: 'Sudan', dial: '+249', tz: 'Africa/Khartoum', arab: true },
  { iso2: 'YE', ar: 'اليمن', en: 'Yemen', dial: '+967', tz: 'Asia/Aden', arab: true },
  { iso2: 'MR', ar: 'موريتانيا', en: 'Mauritania', dial: '+222', tz: 'Africa/Nouakchott', arab: true },
  { iso2: 'SO', ar: 'الصومال', en: 'Somalia', dial: '+252', tz: 'Africa/Mogadishu', arab: true },
  { iso2: 'DJ', ar: 'جيبوتي', en: 'Djibouti', dial: '+253', tz: 'Africa/Djibouti', arab: true },
  { iso2: 'KM', ar: 'جزر القمر', en: 'Comoros', dial: '+269', tz: 'Indian/Comoro', arab: true },

  { iso2: 'TR', ar: 'تركيا', en: 'Turkiye', dial: '+90', tz: 'Europe/Istanbul' },
  { iso2: 'IR', ar: 'إيران', en: 'Iran', dial: '+98', tz: 'Asia/Tehran' },
  { iso2: 'PK', ar: 'باكستان', en: 'Pakistan', dial: '+92', tz: 'Asia/Karachi' },
  { iso2: 'IN', ar: 'الهند', en: 'India', dial: '+91', tz: 'Asia/Kolkata' },
  { iso2: 'BD', ar: 'بنغلاديش', en: 'Bangladesh', dial: '+880', tz: 'Asia/Dhaka' },
  { iso2: 'LK', ar: 'سريلانكا', en: 'Sri Lanka', dial: '+94', tz: 'Asia/Colombo' },
  { iso2: 'NP', ar: 'نيبال', en: 'Nepal', dial: '+977', tz: 'Asia/Kathmandu' },
  { iso2: 'AF', ar: 'أفغانستان', en: 'Afghanistan', dial: '+93', tz: 'Asia/Kabul' },
  { iso2: 'MV', ar: 'المالديف', en: 'Maldives', dial: '+960', tz: 'Indian/Maldives' },
  { iso2: 'BT', ar: 'بوتان', en: 'Bhutan', dial: '+975', tz: 'Asia/Thimphu' },
  { iso2: 'CN', ar: 'الصين', en: 'China', dial: '+86', tz: 'Asia/Shanghai' },
  { iso2: 'JP', ar: 'اليابان', en: 'Japan', dial: '+81', tz: 'Asia/Tokyo' },
  { iso2: 'KR', ar: 'كوريا الجنوبية', en: 'South Korea', dial: '+82', tz: 'Asia/Seoul' },
  { iso2: 'KP', ar: 'كوريا الشمالية', en: 'North Korea', dial: '+850', tz: 'Asia/Pyongyang' },
  { iso2: 'MN', ar: 'منغوليا', en: 'Mongolia', dial: '+976', tz: 'Asia/Ulaanbaatar' },
  { iso2: 'HK', ar: 'هونغ كونغ', en: 'Hong Kong', dial: '+852', tz: 'Asia/Hong_Kong' },
  { iso2: 'MO', ar: 'ماكاو', en: 'Macao', dial: '+853', tz: 'Asia/Macau' },
  { iso2: 'TW', ar: 'تايوان', en: 'Taiwan', dial: '+886', tz: 'Asia/Taipei' },
  { iso2: 'SG', ar: 'سنغافورة', en: 'Singapore', dial: '+65', tz: 'Asia/Singapore' },
  { iso2: 'MY', ar: 'ماليزيا', en: 'Malaysia', dial: '+60', tz: 'Asia/Kuala_Lumpur' },
  { iso2: 'ID', ar: 'إندونيسيا', en: 'Indonesia', dial: '+62', tz: 'Asia/Jakarta' },
  { iso2: 'PH', ar: 'الفلبين', en: 'Philippines', dial: '+63', tz: 'Asia/Manila' },
  { iso2: 'TH', ar: 'تايلاند', en: 'Thailand', dial: '+66', tz: 'Asia/Bangkok' },
  { iso2: 'VN', ar: 'فيتنام', en: 'Vietnam', dial: '+84', tz: 'Asia/Ho_Chi_Minh' },
  { iso2: 'KH', ar: 'كمبوديا', en: 'Cambodia', dial: '+855', tz: 'Asia/Phnom_Penh' },
  { iso2: 'LA', ar: 'لاوس', en: 'Laos', dial: '+856', tz: 'Asia/Vientiane' },
  { iso2: 'MM', ar: 'ميانمار', en: 'Myanmar', dial: '+95', tz: 'Asia/Yangon' },
  { iso2: 'BN', ar: 'بروناي', en: 'Brunei', dial: '+673', tz: 'Asia/Brunei' },
  { iso2: 'TL', ar: 'تيمور الشرقية', en: 'Timor-Leste', dial: '+670', tz: 'Asia/Dili' },
  { iso2: 'KZ', ar: 'كازاخستان', en: 'Kazakhstan', dial: '+7', tz: 'Asia/Almaty' },
  { iso2: 'UZ', ar: 'أوزبكستان', en: 'Uzbekistan', dial: '+998', tz: 'Asia/Tashkent' },
  { iso2: 'TM', ar: 'تركمانستان', en: 'Turkmenistan', dial: '+993', tz: 'Asia/Ashgabat' },
  { iso2: 'KG', ar: 'قيرغيزستان', en: 'Kyrgyzstan', dial: '+996', tz: 'Asia/Bishkek' },
  { iso2: 'TJ', ar: 'طاجيكستان', en: 'Tajikistan', dial: '+992', tz: 'Asia/Dushanbe' },
  { iso2: 'AZ', ar: 'أذربيجان', en: 'Azerbaijan', dial: '+994', tz: 'Asia/Baku' },
  { iso2: 'AM', ar: 'أرمينيا', en: 'Armenia', dial: '+374', tz: 'Asia/Yerevan' },
  { iso2: 'GE', ar: 'جورجيا', en: 'Georgia', dial: '+995', tz: 'Asia/Tbilisi' },
  { iso2: 'CY', ar: 'قبرص', en: 'Cyprus', dial: '+357', tz: 'Asia/Nicosia' },
  { iso2: 'IL', ar: 'إسرائيل', en: 'Israel', dial: '+972', tz: 'Asia/Jerusalem' },

  { iso2: 'NG', ar: 'نيجيريا', en: 'Nigeria', dial: '+234', tz: 'Africa/Lagos' },
  { iso2: 'KE', ar: 'كينيا', en: 'Kenya', dial: '+254', tz: 'Africa/Nairobi' },
  { iso2: 'ET', ar: 'إثيوبيا', en: 'Ethiopia', dial: '+251', tz: 'Africa/Addis_Ababa' },
  { iso2: 'ER', ar: 'إريتريا', en: 'Eritrea', dial: '+291', tz: 'Africa/Asmara' },
  { iso2: 'SS', ar: 'جنوب السودان', en: 'South Sudan', dial: '+211', tz: 'Africa/Juba' },
  { iso2: 'GH', ar: 'غانا', en: 'Ghana', dial: '+233', tz: 'Africa/Accra' },
  { iso2: 'ZA', ar: 'جنوب أفريقيا', en: 'South Africa', dial: '+27', tz: 'Africa/Johannesburg' },
  { iso2: 'TZ', ar: 'تنزانيا', en: 'Tanzania', dial: '+255', tz: 'Africa/Dar_es_Salaam' },
  { iso2: 'UG', ar: 'أوغندا', en: 'Uganda', dial: '+256', tz: 'Africa/Kampala' },
  { iso2: 'SN', ar: 'السنغال', en: 'Senegal', dial: '+221', tz: 'Africa/Dakar' },
  { iso2: 'CI', ar: 'ساحل العاج', en: 'Cote d Ivoire', dial: '+225', tz: 'Africa/Abidjan' },
  { iso2: 'CM', ar: 'الكاميرون', en: 'Cameroon', dial: '+237', tz: 'Africa/Douala' },
  { iso2: 'ML', ar: 'مالي', en: 'Mali', dial: '+223', tz: 'Africa/Bamako' },
  { iso2: 'NE', ar: 'النيجر', en: 'Niger', dial: '+227', tz: 'Africa/Niamey' },
  { iso2: 'BF', ar: 'بوركينا فاسو', en: 'Burkina Faso', dial: '+226', tz: 'Africa/Ouagadougou' },
  { iso2: 'TD', ar: 'تشاد', en: 'Chad', dial: '+235', tz: 'Africa/Ndjamena' },
  { iso2: 'GN', ar: 'غينيا', en: 'Guinea', dial: '+224', tz: 'Africa/Conakry' },
  { iso2: 'BJ', ar: 'بنين', en: 'Benin', dial: '+229', tz: 'Africa/Porto-Novo' },
  { iso2: 'TG', ar: 'توغو', en: 'Togo', dial: '+228', tz: 'Africa/Lome' },
  { iso2: 'SL', ar: 'سيراليون', en: 'Sierra Leone', dial: '+232', tz: 'Africa/Freetown' },
  { iso2: 'LR', ar: 'ليبيريا', en: 'Liberia', dial: '+231', tz: 'Africa/Monrovia' },
  { iso2: 'GM', ar: 'غامبيا', en: 'Gambia', dial: '+220', tz: 'Africa/Banjul' },
  { iso2: 'GW', ar: 'غينيا بيساو', en: 'Guinea-Bissau', dial: '+245', tz: 'Africa/Bissau' },
  { iso2: 'CV', ar: 'الرأس الأخضر', en: 'Cabo Verde', dial: '+238', tz: 'Atlantic/Cape_Verde' },
  { iso2: 'ST', ar: 'ساو تومي وبرينسيبي', en: 'Sao Tome and Principe', dial: '+239', tz: 'Africa/Sao_Tome' },
  { iso2: 'GQ', ar: 'غينيا الاستوائية', en: 'Equatorial Guinea', dial: '+240', tz: 'Africa/Malabo' },
  { iso2: 'GA', ar: 'الغابون', en: 'Gabon', dial: '+241', tz: 'Africa/Libreville' },
  { iso2: 'CG', ar: 'الكونغو', en: 'Republic of the Congo', dial: '+242', tz: 'Africa/Brazzaville' },
  { iso2: 'CD', ar: 'الكونغو الديمقراطية', en: 'DR Congo', dial: '+243', tz: 'Africa/Kinshasa' },
  { iso2: 'AO', ar: 'أنغولا', en: 'Angola', dial: '+244', tz: 'Africa/Luanda' },
  { iso2: 'CF', ar: 'أفريقيا الوسطى', en: 'Central African Republic', dial: '+236', tz: 'Africa/Bangui' },
  { iso2: 'RW', ar: 'رواندا', en: 'Rwanda', dial: '+250', tz: 'Africa/Kigali' },
  { iso2: 'BI', ar: 'بوروندي', en: 'Burundi', dial: '+257', tz: 'Africa/Bujumbura' },
  { iso2: 'MZ', ar: 'موزمبيق', en: 'Mozambique', dial: '+258', tz: 'Africa/Maputo' },
  { iso2: 'ZM', ar: 'زامبيا', en: 'Zambia', dial: '+260', tz: 'Africa/Lusaka' },
  { iso2: 'MG', ar: 'مدغشقر', en: 'Madagascar', dial: '+261', tz: 'Indian/Antananarivo' },
  { iso2: 'ZW', ar: 'زيمبابوي', en: 'Zimbabwe', dial: '+263', tz: 'Africa/Harare' },
  { iso2: 'NA', ar: 'ناميبيا', en: 'Namibia', dial: '+264', tz: 'Africa/Windhoek' },
  { iso2: 'MW', ar: 'مالاوي', en: 'Malawi', dial: '+265', tz: 'Africa/Blantyre' },
  { iso2: 'LS', ar: 'ليسوتو', en: 'Lesotho', dial: '+266', tz: 'Africa/Maseru' },
  { iso2: 'BW', ar: 'بوتسوانا', en: 'Botswana', dial: '+267', tz: 'Africa/Gaborone' },
  { iso2: 'SZ', ar: 'إسواتيني', en: 'Eswatini', dial: '+268', tz: 'Africa/Mbabane' },
  { iso2: 'SC', ar: 'سيشل', en: 'Seychelles', dial: '+248', tz: 'Indian/Mahe' },
  { iso2: 'MU', ar: 'موريشيوس', en: 'Mauritius', dial: '+230', tz: 'Indian/Mauritius' },
  { iso2: 'RE', ar: 'لا ريونيون', en: 'Reunion', dial: '+262', tz: 'Indian/Reunion' },

  { iso2: 'GB', ar: 'المملكة المتحدة', en: 'United Kingdom', dial: '+44', tz: 'Europe/London' },
  { iso2: 'IE', ar: 'أيرلندا', en: 'Ireland', dial: '+353', tz: 'Europe/Dublin' },
  { iso2: 'FR', ar: 'فرنسا', en: 'France', dial: '+33', tz: 'Europe/Paris' },
  { iso2: 'DE', ar: 'ألمانيا', en: 'Germany', dial: '+49', tz: 'Europe/Berlin' },
  { iso2: 'ES', ar: 'إسبانيا', en: 'Spain', dial: '+34', tz: 'Europe/Madrid' },
  { iso2: 'PT', ar: 'البرتغال', en: 'Portugal', dial: '+351', tz: 'Europe/Lisbon' },
  { iso2: 'IT', ar: 'إيطاليا', en: 'Italy', dial: '+39', tz: 'Europe/Rome' },
  { iso2: 'NL', ar: 'هولندا', en: 'Netherlands', dial: '+31', tz: 'Europe/Amsterdam' },
  { iso2: 'BE', ar: 'بلجيكا', en: 'Belgium', dial: '+32', tz: 'Europe/Brussels' },
  { iso2: 'LU', ar: 'لوكسمبورغ', en: 'Luxembourg', dial: '+352', tz: 'Europe/Luxembourg' },
  { iso2: 'CH', ar: 'سويسرا', en: 'Switzerland', dial: '+41', tz: 'Europe/Zurich' },
  { iso2: 'AT', ar: 'النمسا', en: 'Austria', dial: '+43', tz: 'Europe/Vienna' },
  { iso2: 'SE', ar: 'السويد', en: 'Sweden', dial: '+46', tz: 'Europe/Stockholm' },
  { iso2: 'NO', ar: 'النرويج', en: 'Norway', dial: '+47', tz: 'Europe/Oslo' },
  { iso2: 'DK', ar: 'الدنمارك', en: 'Denmark', dial: '+45', tz: 'Europe/Copenhagen' },
  { iso2: 'FI', ar: 'فنلندا', en: 'Finland', dial: '+358', tz: 'Europe/Helsinki' },
  { iso2: 'IS', ar: 'آيسلندا', en: 'Iceland', dial: '+354', tz: 'Atlantic/Reykjavik' },
  { iso2: 'PL', ar: 'بولندا', en: 'Poland', dial: '+48', tz: 'Europe/Warsaw' },
  { iso2: 'CZ', ar: 'التشيك', en: 'Czechia', dial: '+420', tz: 'Europe/Prague' },
  { iso2: 'SK', ar: 'سلوفاكيا', en: 'Slovakia', dial: '+421', tz: 'Europe/Bratislava' },
  { iso2: 'HU', ar: 'المجر', en: 'Hungary', dial: '+36', tz: 'Europe/Budapest' },
  { iso2: 'RO', ar: 'رومانيا', en: 'Romania', dial: '+40', tz: 'Europe/Bucharest' },
  { iso2: 'BG', ar: 'بلغاريا', en: 'Bulgaria', dial: '+359', tz: 'Europe/Sofia' },
  { iso2: 'GR', ar: 'اليونان', en: 'Greece', dial: '+30', tz: 'Europe/Athens' },
  { iso2: 'HR', ar: 'كرواتيا', en: 'Croatia', dial: '+385', tz: 'Europe/Zagreb' },
  { iso2: 'SI', ar: 'سلوفينيا', en: 'Slovenia', dial: '+386', tz: 'Europe/Ljubljana' },
  { iso2: 'RS', ar: 'صربيا', en: 'Serbia', dial: '+381', tz: 'Europe/Belgrade' },
  { iso2: 'BA', ar: 'البوسنة والهرسك', en: 'Bosnia and Herzegovina', dial: '+387', tz: 'Europe/Sarajevo' },
  { iso2: 'ME', ar: 'الجبل الأسود', en: 'Montenegro', dial: '+382', tz: 'Europe/Podgorica' },
  { iso2: 'MK', ar: 'مقدونيا الشمالية', en: 'North Macedonia', dial: '+389', tz: 'Europe/Skopje' },
  { iso2: 'AL', ar: 'ألبانيا', en: 'Albania', dial: '+355', tz: 'Europe/Tirane' },
  { iso2: 'XK', ar: 'كوسوفو', en: 'Kosovo', dial: '+383', tz: 'Europe/Belgrade' },
  { iso2: 'MD', ar: 'مولدوفا', en: 'Moldova', dial: '+373', tz: 'Europe/Chisinau' },
  { iso2: 'UA', ar: 'أوكرانيا', en: 'Ukraine', dial: '+380', tz: 'Europe/Kyiv' },
  { iso2: 'BY', ar: 'بيلاروسيا', en: 'Belarus', dial: '+375', tz: 'Europe/Minsk' },
  { iso2: 'RU', ar: 'روسيا', en: 'Russia', dial: '+7', tz: 'Europe/Moscow' },
  { iso2: 'LT', ar: 'ليتوانيا', en: 'Lithuania', dial: '+370', tz: 'Europe/Vilnius' },
  { iso2: 'LV', ar: 'لاتفيا', en: 'Latvia', dial: '+371', tz: 'Europe/Riga' },
  { iso2: 'EE', ar: 'إستونيا', en: 'Estonia', dial: '+372', tz: 'Europe/Tallinn' },
  { iso2: 'MT', ar: 'مالطا', en: 'Malta', dial: '+356', tz: 'Europe/Malta' },
  { iso2: 'MC', ar: 'موناكو', en: 'Monaco', dial: '+377', tz: 'Europe/Monaco' },
  { iso2: 'AD', ar: 'أندورا', en: 'Andorra', dial: '+376', tz: 'Europe/Andorra' },
  { iso2: 'SM', ar: 'سان مارينو', en: 'San Marino', dial: '+378', tz: 'Europe/San_Marino' },
  { iso2: 'VA', ar: 'الفاتيكان', en: 'Vatican City', dial: '+379', tz: 'Europe/Vatican' },
  { iso2: 'LI', ar: 'ليختنشتاين', en: 'Liechtenstein', dial: '+423', tz: 'Europe/Vaduz' },

  { iso2: 'US', ar: 'الولايات المتحدة', en: 'United States', dial: '+1', tz: 'America/New_York' },
  { iso2: 'CA', ar: 'كندا', en: 'Canada', dial: '+1', tz: 'America/Toronto' },
  { iso2: 'MX', ar: 'المكسيك', en: 'Mexico', dial: '+52', tz: 'America/Mexico_City' },
  { iso2: 'BR', ar: 'البرازيل', en: 'Brazil', dial: '+55', tz: 'America/Sao_Paulo' },
  { iso2: 'AR', ar: 'الأرجنتين', en: 'Argentina', dial: '+54', tz: 'America/Argentina/Buenos_Aires' },
  { iso2: 'CL', ar: 'تشيلي', en: 'Chile', dial: '+56', tz: 'America/Santiago' },
  { iso2: 'CO', ar: 'كولومبيا', en: 'Colombia', dial: '+57', tz: 'America/Bogota' },
  { iso2: 'PE', ar: 'بيرو', en: 'Peru', dial: '+51', tz: 'America/Lima' },
  { iso2: 'VE', ar: 'فنزويلا', en: 'Venezuela', dial: '+58', tz: 'America/Caracas' },
  { iso2: 'EC', ar: 'الإكوادور', en: 'Ecuador', dial: '+593', tz: 'America/Guayaquil' },
  { iso2: 'BO', ar: 'بوليفيا', en: 'Bolivia', dial: '+591', tz: 'America/La_Paz' },
  { iso2: 'PY', ar: 'باراغواي', en: 'Paraguay', dial: '+595', tz: 'America/Asuncion' },
  { iso2: 'UY', ar: 'أوروغواي', en: 'Uruguay', dial: '+598', tz: 'America/Montevideo' },
  { iso2: 'GY', ar: 'غيانا', en: 'Guyana', dial: '+592', tz: 'America/Guyana' },
  { iso2: 'SR', ar: 'سورينام', en: 'Suriname', dial: '+597', tz: 'America/Paramaribo' },
  { iso2: 'PA', ar: 'بنما', en: 'Panama', dial: '+507', tz: 'America/Panama' },
  { iso2: 'CR', ar: 'كوستاريكا', en: 'Costa Rica', dial: '+506', tz: 'America/Costa_Rica' },
  { iso2: 'NI', ar: 'نيكاراغوا', en: 'Nicaragua', dial: '+505', tz: 'America/Managua' },
  { iso2: 'HN', ar: 'هندوراس', en: 'Honduras', dial: '+504', tz: 'America/Tegucigalpa' },
  { iso2: 'SV', ar: 'السلفادور', en: 'El Salvador', dial: '+503', tz: 'America/El_Salvador' },
  { iso2: 'GT', ar: 'غواتيمالا', en: 'Guatemala', dial: '+502', tz: 'America/Guatemala' },
  { iso2: 'BZ', ar: 'بليز', en: 'Belize', dial: '+501', tz: 'America/Belize' },
  { iso2: 'CU', ar: 'كوبا', en: 'Cuba', dial: '+53', tz: 'America/Havana' },
  { iso2: 'DO', ar: 'جمهورية الدومينيكان', en: 'Dominican Republic', dial: '+1809', tz: 'America/Santo_Domingo' },
  { iso2: 'HT', ar: 'هايتي', en: 'Haiti', dial: '+509', tz: 'America/Port-au-Prince' },
  { iso2: 'JM', ar: 'جامايكا', en: 'Jamaica', dial: '+1876', tz: 'America/Jamaica' },
  { iso2: 'TT', ar: 'ترينيداد وتوباغو', en: 'Trinidad and Tobago', dial: '+1868', tz: 'America/Port_of_Spain' },
  { iso2: 'BS', ar: 'الباهاما', en: 'Bahamas', dial: '+1242', tz: 'America/Nassau' },
  { iso2: 'BB', ar: 'بربادوس', en: 'Barbados', dial: '+1246', tz: 'America/Barbados' },
  { iso2: 'PR', ar: 'بورتوريكو', en: 'Puerto Rico', dial: '+1787', tz: 'America/Puerto_Rico' },

  { iso2: 'AU', ar: 'أستراليا', en: 'Australia', dial: '+61', tz: 'Australia/Sydney' },
  { iso2: 'NZ', ar: 'نيوزيلندا', en: 'New Zealand', dial: '+64', tz: 'Pacific/Auckland' },
  { iso2: 'FJ', ar: 'فيجي', en: 'Fiji', dial: '+679', tz: 'Pacific/Fiji' },
  { iso2: 'PG', ar: 'بابوا غينيا الجديدة', en: 'Papua New Guinea', dial: '+675', tz: 'Pacific/Port_Moresby' },
  { iso2: 'SB', ar: 'جزر سليمان', en: 'Solomon Islands', dial: '+677', tz: 'Pacific/Guadalcanal' },
  { iso2: 'VU', ar: 'فانواتو', en: 'Vanuatu', dial: '+678', tz: 'Pacific/Efate' },
  { iso2: 'NC', ar: 'كاليدونيا الجديدة', en: 'New Caledonia', dial: '+687', tz: 'Pacific/Noumea' },
  { iso2: 'PF', ar: 'بولينيزيا الفرنسية', en: 'French Polynesia', dial: '+689', tz: 'Pacific/Tahiti' },
  { iso2: 'WS', ar: 'ساموا', en: 'Samoa', dial: '+685', tz: 'Pacific/Apia' },
  { iso2: 'TO', ar: 'تونغا', en: 'Tonga', dial: '+676', tz: 'Pacific/Tongatapu' },
  { iso2: 'KI', ar: 'كيريباتي', en: 'Kiribati', dial: '+686', tz: 'Pacific/Tarawa' },
  { iso2: 'FM', ar: 'ميكرونيزيا', en: 'Micronesia', dial: '+691', tz: 'Pacific/Chuuk' },
  { iso2: 'MH', ar: 'جزر مارشال', en: 'Marshall Islands', dial: '+692', tz: 'Pacific/Majuro' },
  { iso2: 'PW', ar: 'بالاو', en: 'Palau', dial: '+680', tz: 'Pacific/Palau' },
  { iso2: 'NR', ar: 'ناورو', en: 'Nauru', dial: '+674', tz: 'Pacific/Nauru' },
  { iso2: 'TV', ar: 'توفالو', en: 'Tuvalu', dial: '+688', tz: 'Pacific/Funafuti' },
  { iso2: 'GU', ar: 'غوام', en: 'Guam', dial: '+1671', tz: 'Pacific/Guam' },
]

/** أسماءُ الدول العربيّة — جمهورُ «أين تريد أن تُدرّب» كما كان */
export const ARAB_COUNTRY_NAMES: string[] = COUNTRIES.filter((c) => c.arab).map((c) => c.ar)

/* الترتيبُ العربيُّ مرّةً واحدةً لا في كلّ ضغطةِ مفتاح: `Intl.Collator`
   يُبنى مرّةً، والقائمةُ المرتَّبةُ تُحسب مرّةً عند تحميل الوحدة. */
const arabicOrder = new Intl.Collator('ar').compare

/** كلُّ الدول: العربيّةُ أوّلا، ثمّ سائرُها مرتَّبةً بالعربيّة */
export const COUNTRIES_SORTED: Country[] = [
  ...COUNTRIES.filter((c) => c.arab),
  ...COUNTRIES.filter((c) => !c.arab).sort((a, b) => arabicOrder(a.ar, b.ar)),
]

const BY_NAME = new Map(COUNTRIES.map((c) => [c.ar, c]))

/** المنطقةُ الزمنيّةُ من اسم الدولة — و`undefined` لمن لم يختر أو اختار «أخرى» */
export function timezoneOf(countryName: string): string | undefined {
  return BY_NAME.get(countryName)?.tz
}

/** الدولةُ باسمها العربيّ */
export function countryByName(countryName: string): Country | undefined {
  return BY_NAME.get(countryName)
}

/** عَلَمُ الدولة — يُشتقّ من ISO لا يُخزَّن: حرفان يصيران رمزَي مؤشِّرٍ إقليميّ */
export function flagOf(iso2: string): string {
  if (!/^[A-Z]{2}$/.test(iso2)) return ''
  return String.fromCodePoint(...[...iso2].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/* البحثُ يُطبّع الهمزاتِ والتاءَ المربوطةَ والألفَ المقصورة: من كتب «الامارات»
   أو «مصر » أو «تركيه» يجد ما يبحث عنه. ومن كتب `+90` أو `90` يجدها كذلك. */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
}

/** تصفيةُ الدول ببحثٍ واحد: الاسمُ العربيُّ أو الإنجليزيُّ أو رمزُ الهاتف أو ISO */
export function searchCountries(query: string, list: Country[] = COUNTRIES_SORTED): Country[] {
  const q = normalize(query)
  if (!q) return list
  const digits = q.replace(/[^\d]/g, '')
  return list.filter((c) =>
    normalize(c.ar).includes(q)
    || normalize(c.en).includes(q)
    || c.iso2.toLowerCase() === q
    || (digits.length > 0 && c.dial.slice(1).startsWith(digits)),
  )
}
