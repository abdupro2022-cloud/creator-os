/**
 * Arabic translations, keyed by the English source string.
 *
 * Keying on the source string (rather than generated ids) means a missing
 * translation degrades to readable English instead of a raw key on screen, and
 * it keeps the JSX diff small: `t("Ideas")` instead of `t("nav.ideas")`.
 */
export const ar: Record<string, string> = {
  // ---- generic -----------------------------------------------------------
  Loading: "جارٍ التحميل…",
  "Loading…": "جارٍ التحميل…",
  Cancel: "إلغاء",
  Save: "حفظ",
  "Save changes": "حفظ التغييرات",
  Close: "إغلاق",
  Delete: "حذف",
  Edit: "تعديل",
  Copy: "نسخ",
  Copied: "تم النسخ",
  Retry: "إعادة المحاولة",
  Back: "رجوع",
  Next: "التالي",
  Search: "بحث",
  Optional: "اختياري",
  "None": "لا شيء",
  yes: "نعم",
  no: "لا",

  // ---- landing -----------------------------------------------------------
  Pipeline: "المسار",
  "What works": "ما يعمل فعلاً",
  Roadmap: "خارطة الطريق",
  "Personal creator workspace": "مساحة عمل المُنشئ",
  Workspace: "مساحة العمل",
  "Sign in": "تسجيل الدخول",
  "Get started": "ابدأ الآن",
  Idea: "فكرة",
  Research: "بحث",
  Script: "نص",
  Shorts: "شورتس",
  Publish: "نشر",
  later: "لاحقاً",
  "Personal AI operating system for one creator":
    "نظام تشغيل ذكاء اصطناعي شخصي لمُنشئ واحد",
  "From a raw idea to a script you can actually film.":
    "من فكرة خام إلى نص يمكنك تصويره فعلاً.",
  "ABDO CREATOR OS is a working creator workspace, not a chat wrapper. Capture a spark, let the agent develop the angle with every claim labelled, then draft a real script section by section — with word counts, a duration estimate, verification findings and revisions.":
    "‏ABDO CREATOR OS مساحة عمل مُنشئ حقيقية، لا مجرد غلاف لدردشة. التقط الشرارة، ودع الوكيل يطوّر الزاوية مع وسم كل ادّعاء، ثم اكتب نصاً حقيقياً قسماً بقسم — مع عدّاد كلمات، وتقدير للمدة، ونتائج تحقّق، ومراجعات.",
  "Open the workspace": "ادخل مساحة العمل",
  "Start building": "ابدأ البناء",
  "See the pipeline": "شاهد المسار",
  "No fabricated sources or statistics": "لا مصادر أو إحصاءات مُختلقة",
  "No exposed chain-of-thought": "لا كشف لسلسلة التفكير",
  "API keys never reach the browser": "مفاتيح API لا تصل المتصفح أبداً",
  "The pipeline, honestly labelled": "المسار، بموضوعية",
  "Version 1 ships idea → angle → script end to end. Everything else is marked as not built, because a plan is not a product.":
    "الإصدار الأول يشحن فكرة ← زاوية ← نص بشكل متكامل. وكل ما عداه معلَّم كغير مبنيّ، لأن الخطة ليست منتجاً.",
  Capture: "التقاط",
  "Write the thought the way you would say it. It is stored before any model runs, so nothing is lost if a provider fails.":
    "اكتب الفكرة بالطريقة التي تقولها بها. تُحفظ قبل تشغيل أي نموذج، فلا تضيع إن فشل مزوّد.",
  "The agent returns a title, angle, spoken hook, audience and labelled key points — plus a list of claims that still need a real source.":
    "يعيد الوكيل عنواناً وزاوية وهوكاً منطوقاً والجمهور والنقاط الأساسية الموسومة — إضافة إلى قائمة الادّعاءات التي ما زالت تحتاج مصدراً حقيقياً.",
  "An outline is validated against your target length, then each section is written into Script Studio where you edit, rewrite and verify it.":
    "يُتحقّق من المخطّط مقابل الطول المطلوب، ثم يُكتب كل قسم في استوديو النص حيث تعدّله وتعيد صياغته وتتحقّق منه.",
  "What is actually implemented": "ما هو منفَّذ فعلاً",
  "Every item below runs against a real database and real model calls. Nothing on this page is a mock-up.":
    "كل بند أدناه يعمل على قاعدة بيانات حقيقية واستدعاءات نماذج حقيقية. لا شيء هنا نموذج تجريبي.",
  "Idea development that labels its claims":
    "تطوير الأفكار مع وسم الادّعاءات",
  "A raw spark becomes a working title, an angle, a spoken hook and key points — each labelled FACT, INFERENCE, AI SUGGESTION or UNVERIFIED, with the risky ones pulled into a separate list.":
    "شرارة خام تتحوّل إلى عنوان عملي وزاوية وهوك منطوق ونقاط أساسية — كلٌّ موسوم كـ«حقيقة» أو «استنتاج» أو «اقتراح الذكاء الاصطناعي» أو «غير متحقّق»، مع فصل الادّعاءات الخطرة في قائمة مستقلة.",
  "Capability-based model routing": "توجيه النماذج حسب القدرة",
  "Tasks declare what they need (structured output, reasoning, speed). The router picks a model across OpenAI, Anthropic, Google, DeepSeek, Kimi and MiniMax, and falls back automatically when one is unavailable.":
    "كل مهمة تعلن ما تحتاجه (مخرجات منظّمة، تفكير، سرعة). يختار الموجّه نموذجاً بين OpenAI وAnthropic وGoogle وDeepSeek وKimi وMiniMax، ويعود تلقائياً إلى بديل عند تعذّر أحدها.",
  "Script Studio, not a textarea": "استوديو نصّ، لا مربع كتابة",
  "Outline first, then one model call per section written straight into the database. Real word counts, a narration estimate from your pacing, per-section rewrites, reordering and revisions.":
    "المخطّط أولاً، ثم استدعاء نموذج واحد لكل قسم يُكتب مباشرة في قاعدة البيانات. عدّاد كلمات حقيقي، وتقدير زمن الإلقاء من إيقاعك، وإعادة صياغة لكل قسم، وإعادة ترتيب ومراجعات.",
  "Verification you can trust": "تحقّق يمكنك الوثوق به",
  "A deterministic scan checks structure, prohibited style, filler openers and unsourced evidence claims. Then a model review pass runs and both sets of findings are stored on the script.":
    "فحص حتمي للبنية والأسلوب المحظور والافتتاحيات الفارغة والادّعاءات بلا مصدر. ثم تمرّ مراجعة بالنموذج، وتُحفظ المجموعتان من النتائج على النص.",
  "Your voice, enforced": "صوتك، مُطبَّق",
  "Language, dialect, tone, pacing, storytelling, hooks and prohibited styles are injected into every prompt — and the page shows the exact text the model receives.":
    "اللغة واللهجة والنبرة والإيقاع والسرد والخطافات والأنماط المحظورة تُحقن في كل موجّه — وتعرض الصفحة النصّ الحرفي الذي يصل النموذج.",
  "Projects keep context apart": "المشاريع تفصل السياق",
  "Every idea, script and agent run belongs to one project, so a second channel never inherits the first one's angle, voice or history.":
    "كل فكرة ونص وتشغيل وكيل ينتمي إلى مشروع واحد، فلا ترث القناة الثانية زاوية أو صوتاً أو تاريخ القناة الأولى.",
  "Not built yet — and listed as such": "غير مبنيّ بعد — ومُدرج كذلك",
  "These modules are designed but deliberately excluded from version 1. There are no placeholder buttons and no fake data for them anywhere in the app.":
    "هذه الوحدات مصمَّمة لكنها مستبعدة عمداً من الإصدار الأول. لا توجد أزرار وهمية ولا بيانات مزوّرة لها في أي مكان من التطبيق.",
  "Web research, sources and citations": "بحث الويب والمصادر والاستشهادات",
  "YouTube research and competitor analysis": "بحث يوتيوب وتحليل المنافسين",
  "Shorts generation and SEO metadata": "توليد الشورتس وبيانات SEO",
  "Files, PDFs and retrieval": "الملفات وملفات PDF والاسترجاع",
  "Long-term memory and background tasks": "ذاكرة طويلة الأمد ومهام خلفية",
  "How it is put together": "كيف بُني",
  "A modular stack, so a new tool or provider is an addition rather than a rewrite.":
    "بنية معيارية، فإضافة أداة أو مزوّد جديد إضافة لا إعادة كتابة.",
  "Keys are read server-side only, in the Convex Node runtime.":
    "تُقرأ المفاتيح في الخادم فقط، ضمن بيئة Convex على Node.",
  "External content is treated as untrusted data, never as instructions.":
    "يُعامَل المحتوى الخارجي كبيانات غير موثوقة، لا كتعليمات.",
  "Open the workspace and turn one idea into a script tonight.":
    "ادخل مساحة العمل وحوّل فكرة واحدة إلى نصّ الليلة.",
  "Back to the Command Center": "العودة إلى مركز القيادة",
  "Create your workspace": "أنشئ مساحة عملك",
  "ABDO CREATOR OS — a personal creator operating system.":
    "‏ABDO CREATOR OS — نظام تشغيل شخصي للمُنشئين.",
  "Built on Convex, React and a provider-agnostic AI gateway.":
    "مبني على Convex وReact وبوابة ذكاء اصطناعي محايدة المزوّدين.",

  // ---- app shell ---------------------------------------------------------
  "Command Center": "مركز القيادة",
  Ideas: "الأفكار",
  Scripts: "النصوص",
  Projects: "المشاريع",
  "Style Profile": "ملف الأسلوب",
  Tools: "الأدوات",
  Settings: "الإعدادات",
  "Script Studio": "استوديو النص",
  "Publish Kit": "حزمة النشر",
  "Creator workspace": "مساحة عمل المُنشئ",
  Navigation: "التنقّل",
  "Move between the creator workspace sections.":
    "انتقل بين أقسام مساحة عمل المُنشئ.",
  "Open navigation": "افتح القائمة",
  Theme: "المظهر",
  Guest: "ضيف",
  "Guest session": "جلسة ضيف",
  "Signed in": "مُسجَّل الدخول",
  "Creator": "مُنشئ",
  "Sign out": "تسجيل الخروج",
  "Switch to dark mode": "التبديل إلى الوضع الداكن",
  "Switch to light mode": "التبديل إلى الوضع الفاتح",
  "Switch to Arabic": "التبديل إلى العربية",
  "Switch to English": "التبديل إلى الإنجليزية",
  Language: "اللغة",
  "Live pipeline": "المسار الحيّ",
  "Idea → Angle → Script → Publish Kit is wired end to end. Research is not built, and nothing is ever uploaded to YouTube.":
    "فكرة ← زاوية ← نص ← حزمة نشر متصلة بالكامل. البحث غير مبنيّ بعد، ولا يُرفع أي شيء إلى يوتيوب.",

  // ---- pipeline map ------------------------------------------------------
  "Creator pipeline": "مسار المُنشئ",
  "Idea → angle → script → publish kit, end to end. Research is not built.":
    "فكرة ← زاوية ← نص ← حزمة نشر، من البداية إلى النهاية. البحث غير مبنيّ بعد.",
  "Cut plan": "خطة مونتاج",
  "Metadata kit": "حزمة البيانات",
  "No upload": "بدون رفع",
  Live: "يعمل",
  "Not built": "غير مبنيّ",
  "Manage projects": "إدارة المشاريع",

  // ---- not found ---------------------------------------------------------
  "Page not found": "الصفحة غير موجودة",
  "That screen does not exist": "هذه الشاشة غير موجودة",
  "Nothing broke — this address simply is not part of the workspace. The page you asked for was not opened.":
    "لا شيء معطوب — هذا العنوان ببساطة ليس جزءاً من مساحة العمل. الصفحة التي طلبتها لم تُفتح.",
  "This screen hit an error": "واجهت هذه الشاشة خطأ",
  "Only this screen is affected — the rest of the workspace is fine.":
    "هذه الشاشة فقط متأثرة — بقية مساحة العمل سليمة.",
  "Unknown runtime error": "خطأ غير معروف أثناء التشغيل",

  // ---- auth gate ---------------------------------------------------------
  "Sign in to continue": "سجّل الدخول للمتابعة",
  "This page is only available to signed-in users.":
    "هذه الصفحة متاحة فقط للمستخدمين المسجّلين.",
  "You'll come straight back to this page once you're signed in.":
    "ستعود إلى هذه الصفحة مباشرة بعد تسجيل الدخول.",
  "Sign in to open your workspace": "سجّل الدخول لفتح مساحة عملك",
  "Your projects, ideas, scripts and agent runs live here.":
    "مشاريعك وأفكارك ونصوصك وتشغيلات الوكيل موجودة هنا.",
  "Back to home": "العودة للرئيسية",

  // ---- command centre ----------------------------------------------------
  "Welcome back, {name}": "أهلاً بعودتك، {name}",
  "Welcome back": "أهلاً بعودتك",
  "Capture raw ideas here, develop them into a real angle, then draft the script. Every number below comes from your own workspace.":
    "التقط أفكارك الخام هنا، وطوّرها إلى زاوية حقيقية، ثم اكتب النص. كل رقم أدناه يأتي من مساحة عملك أنت.",
  "Open Script Studio": "افتح استوديو النص",
  "Loading your workspace…": "جارٍ تحميل مساحة عملك…",
  "Workspace unavailable — try signing in again.":
    "مساحة العمل غير متاحة — حاول تسجيل الدخول مجدداً.",
  "Ideas in progress": "أفكار قيد العمل",
  "{developed} developed · {waiting} waiting":
    "{developed} مُطوَّرة · {waiting} في الانتظار",
  "Nothing developed yet — start with one idea":
    "لا شيء مُطوَّر بعد — ابدأ بفكرة واحدة",
  "All ideas": "كل الأفكار",
  "No ideas yet. Write one above — it takes ten seconds.":
    "لا أفكار بعد. اكتب واحدة في الأعلى — عشر ثوانٍ فقط.",
  "Re-develop": "إعادة التطوير",
  Develop: "تطوير",
  "Draft script": "اكتب النص",
  "Recent drafts": "المسودّات الأخيرة",
  "{verified} verified · {drafts} in draft":
    "{verified} متحقَّق · {drafts} مسودة",
  "No scripts drafted yet": "لا نصوص مكتوبة بعد",
  "All scripts": "كل النصوص",
  "Drafts land here with real word counts and a duration estimate based on your pacing.":
    "تظهر المسودّات هنا بعدّاد كلمات حقيقي وتقدير للمدة مبني على إيقاعك.",
  "{n} words": "{n} كلمة",
  narration: "إلقاء",
  sections: "قسم",
  "{n} min target": "هدف {n} دقيقة",
  "{pacing} pacing": "إيقاع {pacing}",
  Missing: "ناقص",
  "Profile complete — every field is set.": "الملف مكتمل — كل الحقول معبّأة.",
  "Edit profile": "تعديل الملف",
  "Set up profile": "إنشاء الملف",
  "Creator style profile": "ملف أسلوب المُنشئ",
  "Injected into every model call — the single biggest quality lever.":
    "يُحقن في كل استدعاء نموذج — أقوى رافعة جودة لديك.",
  "Agent activity": "نشاط الوكيل",
  "Every model call, with the provider that answered.":
    "كل استدعاء نموذج، مع المزوّد التي ردّ.",

  // ---- idea capture / dialog --------------------------------------------
  "Describe the idea in at least a few words.":
    "اكتب الفكرة في بضعة كلمات على الأقل.",
  "Idea captured": "تم التقاط الفكرة",
  "Develop it to get an angle, hook and key points.":
    "طوّرها للحصول على زاوية وهوك ونقاط أساسية.",
  "Could not save the idea.": "تعذّر حفظ الفكرة.",
  "Could not capture the idea": "تعذّر التقاط الفكرة",
  "Capture a raw idea": "التقط فكرة خام",
  "A topic, a question, a half-formed thought — write it the way you would say it out loud.":
    "موضوع أو سؤال أو فكرة نصف مكتملة — اكتبها بالطريقة التي تقولها بها بصوت عالٍ.",
  "مثال: ليش أغلب القنوات تموت بعد أول 10 فيديوهات؟":
    "مثال: لماذا تموت معظم القنوات بعد أول عشرة فيديوهات؟",
  Project: "المشروع",
  "A default project will be created automatically.":
    "سيُنشأ مشروع افتراضي تلقائياً.",
  "Capture idea": "التقط الفكرة",
  "Copy {label}": "نسخ {label}",
  "{label} copied": "تم نسخ {label}",
  "Clipboard is not available in this browser.":
    "الحافظة غير متاحة في هذا المتصفح.",
  "Idea updated": "تم تحديث الفكرة",
  "The previous development was cleared so it cannot go stale.":
    "مُسح التطوير السابق حتى لا يصير قديماً.",
  "Could not update the idea": "تعذّر تحديث الفكرة",
  "Updated {when}": "حُدِّث {when}",
  "Raw idea": "فكرة خام",
  "Review the angle before drafting. Every key point is labelled, and anything that needs a real source is listed separately.":
    "راجع الزاوية قبل الصياغة. كل نقطة أساسية موسومة، وكل ما يحتاج مصدراً حقيقياً مُدرج على حدة.",
  "This idea has not been developed yet. The agent will turn it into an angle, a hook and labelled key points.":
    "لم تُطوَّر هذه الفكرة بعد. سيحوّلها الوكيل إلى زاوية وهوك ونقاط أساسية موسومة.",
  "Loading idea…": "جارٍ تحميل الفكرة…",
  "This idea no longer exists.": "لم تعد هذه الفكرة موجودة.",
  "Last run failed": "فشل آخر تشغيل",
  "Your spark": "شرارتك",
  "Cancel editing": "إلغاء التعديل",
  "Saving resets the development — re-develop afterwards.":
    "الحفظ يعيد ضبط التطوير — أعد التطوير بعدها.",
  "Edit the raw idea": "تعديل الفكرة الخام",
  "One line": "سطر واحد",
  Angle: "زاوية",
  "Hook (first 15 seconds)": "الهوك (أول ١٥ ثانية)",
  Audience: "الجمهور",
  Format: "الصيغة",
  "Long form": "فيديو طويل",
  Short: "قصير",
  "Long form + short": "طويل + قصير",
  "Why now": "لماذا الآن",
  "Key points": "النقاط الأساسية",
  "Needs a real source before publishing": "يحتاج مصدراً حقيقياً قبل النشر",
  "Check before filming": "تحقّق قبل التصوير",
  "Developed with {model} · {when}": "طُوِّر بـ {model} · {when}",
  "Scripts from this idea": "نصوص من هذه الفكرة",
  "Delete this idea?": "حذف هذه الفكرة؟",
  "The raw spark and its developed angle are removed permanently. Scripts already drafted from it are kept.":
    "تُحذف الشرارة الخام والزاوية المطوّرة نهائياً. وتبقى النصوص المكتوبة منها.",
  "Delete idea": "احذف الفكرة",
  "Develop with AI": "طوّر بالذكاء الاصطناعي",

  // ---- workflow toasts ----------------------------------------------------
  "Something went wrong.": "حدث خطأ ما.",
  "Developing the idea — planning, analyzing, saving…":
    "جارٍ تطوير الفكرة — تخطيط، تحليل، حفظ…",
  "Development failed": "فشل التطوير",
  "Angle ready": "الزاوية جاهزة",
  "Developed with {model}. Open the idea to review the angle, key points and anything that still needs a source.":
    "طُوِّر بـ {model}. افتح الفكرة لمراجعة الزاوية والنقاط الأساسية وكل ما يحتاج مصدراً.",
  "Drafting the script — outline, sections, verification…":
    "جارٍ كتابة النص — مخطّط، أقسام، تحقّق…",
  "Drafting failed": "فشلت الكتابة",
  "Drafting finished without a script": "انتهت الكتابة دون نص",
  "Drafted {n} section(s)": "كُتب {n} قسم",
  "{n} section(s) failed — open the studio to retry them.":
    "فشل {n} قسم — افتح الاستوديو لإعادة المحاولة.",
  "Verification score {score}/100.": "نتيجة التحقّق {score}/١٠٠.",
  "Verification did not complete — run it from the studio.":
    "لم يكتمل التحقّق — شغّله من الاستوديو.",
  "Idea deleted": "تم حذف الفكرة",
  "Could not delete the idea": "تعذّر حذف الفكرة",
  Hook: "الهوك",
  Intro: "المقدمة",
  Body: "المتن",
  "Call to action": "الدعوة للفعل",
  Outro: "الخاتمة",

  // ---- ideas / scripts ----------------------------------------------------
  All: "الكل",
  Waiting: "قيد الانتظار",
  "Step 1 · Idea": "الخطوة ١ · الفكرة",
  "Step 3 · Script": "الخطوة ٣ · النص",
  "Raw sparks in, developed angles out. Nothing reaches a script until you have reviewed the angle and the points that still need a real source.":
    "شرارات خام تدخل، زوايا مُطوَّرة تخرج. لا شيء يصل إلى نص قبل أن تراجع الزاوية والنقاط التي ما زالت تحتاج مصدراً حقيقياً.",
  "Loading ideas…": "جارٍ تحميل الأفكار…",
  "No ideas yet": "لا أفكار بعد",
  "No ideas with this status": "لا أفكار بهذه الحالة",
  "Write a topic, a question or a problem your audience has. The agent handles the structure.":
    "اكتب موضوعاً أو سؤالاً أو مشكلة جمهورك. الوكيل يتولّى البنية.",
  Details: "التفاصيل",
  "Give the script a title first.": "اكتب عنواناً للنص أولاً.",
  "Script created": "تم إنشاء النص",
  "Write it yourself or draft sections with the agent.":
    "اكتبه بنفسك أو استخدم الوكيل لكتابة الأقسام.",
  "Could not create the script": "تعذّر إنشاء النص",
  "Drafts keep real word counts, a narration estimate from your pacing, section-level rewrites, verification findings and revisions.":
    "تحتفظ المسودّات بعدّاد كلمات حقيقي، وتقدير للإلقاء من إيقاعك، وإعادة صياغة لكل قسم، ونتائج تحقّق ومراجعات.",
  "New script": "نص جديد",
  "Loading scripts…": "جارٍ تحميل النصوص…",
  "No scripts yet": "لا نصوص بعد",
  "Develop an idea and press “Draft script”, or start one from scratch and write it yourself — the metrics and revisions work either way.":
    "طوّر فكرة واضغط «اكتب النص»، أو ابدأ نصاً من الصفر واكتبه بنفسك — الإحصاءات والمراجعات تعمل في الحالتين.",
  "Go to ideas": "اذهب إلى الأفكار",
  target: "الهدف",
  "sections written": "قسم مكتوب",
  "Start empty and write it yourself. You can draft individual sections with the agent once it exists.":
    "ابدأ فارغاً واكتب بنفسك. يمكنك صياغة أقسام بعينها بالوكيل بعد إنشائه.",
  Title: "العنوان",
  "Working title": "عنوان مؤقت",
  "Create script": "أنشئ النص",

  // ---- auth --------------------------------------------------------------
  "Failed to send verification code. Please try again.":
    "تعذّر إرسال رمز التحقق. حاول مجدداً.",
  "The verification code you entered is incorrect.":
    "رمز التحقق الذي أدخلته غير صحيح.",
  "Failed to sign in as guest: {reason}": "تعذّر الدخول كضيف: {reason}",
  "Unknown error": "خطأ غير معروف",
  "Get Started": "لنبدأ",
  "Enter your email to log in or sign up":
    "أدخل بريدك الإلكتروني لتسجيل الدخول أو إنشاء حساب",
  Or: "أو",
  "Continue as Guest": "المتابعة كضيف",
  "Check your email": "تحقّق من بريدك",
  "We've sent a code to {email}": "أرسلنا رمزاً إلى {email}",
  "Didn't receive a code?": "لم تصلك الرمز؟",
  "Try again": "حاول مجدداً",
  "Verifying...": "جارٍ التحقّق…",
  "Verify code": "تحقّق من الرمز",
  "Use different email": "استخدم بريداً آخر",
  "Secured by": "محميّ بواسطة",

  // ---- script studio ------------------------------------------------------
  "Could not save the section": "تعذّر حفظ القسم",
  "Drafting the remaining sections — watch them fill in live…":
    "جارٍ صياغة الأقسام المتبقّية — راقبها تمتلئ مباشرة…",
  "Wrote {n} section(s)": "كُتب {n} قسم",
  "{n} section(s) still failed — retry or write them yourself.":
    "لا يزال {n} قسم فاشلاً — أعد المحاولة أو اكتبه بنفسك.",
  "Verification did not complete.": "لم يكتمل التحقّق.",
  "Verifying — scanning then reviewing…": "جارٍ التحقّق — مسح ثم مراجعة…",
  "Verification complete — {score}/100": "اكتمل التحقّق — {score}/١٠٠",
  "{n} finding(s) recorded.": "سُجّل {n} ملاحظة.",
  "Verification did not complete": "لم يكتمل التحقّق",
  "Verification failed": "فشل التحقّق",
  "Rewriting this section…": "جارٍ إعادة صياغة هذا القسم…",
  "Rewritten with {model}": "أُعيدت الصياغة بـ {model}",
  "Rewrite failed": "فشلت إعادة الصياغة",
  "Loading script…": "جارٍ تحميل النص…",
  "This script no longer exists.": "لم يعد هذا النص موجوداً.",
  "Back to scripts": "العودة إلى النصوص",
  "Title updated": "تم تحديث العنوان",
  "Could not update the title": "تعذّر تحديث العنوان",
  "Script title": "عنوان النص",
  "{n} words/min": "{n} كلمة/دقيقة",
  "Target set to {n} minutes": "ضُبط الهدف على {n} دقيقة",
  "Could not update the target": "تعذّر تحديث الهدف",
  "Target length": "الطول المستهدف",
  Verify: "تحقّق",
  "Draft sections": "اكتب الأقسام",
  "Draft {n} missing": "اكتب {n} ناقص",
  "Publish kit": "حزمة النشر",
  "The last run did not finish cleanly": "لم ينته آخر تشغيل بشكل سليم",
  "Agent working": "الوكيل يعمل",
  "Sections appear as they are written. You can keep editing finished sections while this runs.":
    "تظهر الأقسام فور كتابتها. يمكنك متابعة تعديل الأقسام المكتملة أثناء التشغيل.",
  "Sections ({n})": "الأقسام ({n})",
  "Full script copied": "نُسخ النص كاملاً",
  "Copy script": "انسخ النص",
  "Could not reorder sections": "تعذّر إعادة ترتيب الأقسام",
  "Section removed": "تم حذف القسم",
  "Could not remove the section": "تعذّر حذف القسم",
  "New section role": "دور القسم الجديد",
  "New section heading": "عنوان القسم الجديد",
  "Section added": "تمت إضافة القسم",
  "Could not add the section": "تعذّرت إضافة القسم",
  Add: "إضافة",
  "Where this came from": "من أين جاء هذا",
  "Copy hook": "نسخ الهوك",
  "Hook copied": "نُسخ الهوك",
  "Clipboard unavailable.": "الحافظة غير متاحة.",
  "Open the idea": "افتح الفكرة",
  "This script was started manually, so there is no source idea attached. Metrics and revisions still work.":
    "بدأ هذا النص يدوياً، فلا توجد فكرة مصدر مرفقة. الإحصاءات والمراجعات تعمل رغم ذلك.",
  Section: "القسم",
  "No findings — nothing was flagged.": "لا ملاحظات — لم يُرفع شيء.",
  "Not verified yet. Verification runs a deterministic scan (structure, prohibited style, unsourced evidence claims) and then a model review pass.":
    "لم يُتحقَّق بعد. يشغّل التحقّق مسحاً حتمياً (البنية، الأسلوب المحظور، ادّعاءات بلا مصدر) ثم مراجعة بالنموذج.",
  Revisions: "المراجعات",
  "Manual save from Script Studio": "حفظ يدوي من استوديو النص",
  "Revision saved": "حُفظت المراجعة",
  "Could not save a revision": "تعذّر حفظ مراجعة",
  "Save revision": "احفظ مراجعة",
  "No revisions yet. Snapshots let you roll a draft back after a rewrite.":
    "لا مراجعات بعد. اللقطات تتيح التراجع عن مسودة بعد إعادة صياغة.",
  "Revision restored": "تمت استعادة المراجعة",
  "Could not restore the revision": "تعذّرت استعادة المراجعة",
  Restore: "استعادة",
  "Revision deleted": "حُذفت المراجعة",
  "Could not delete the revision": "تعذّر حذف المراجعة",
  "Danger zone": "منطقة الخطر",
  "Deleting removes the script, its sections and all revisions.":
    "الحذف يزيل النص وأقسامه وكل المراجعات.",
  "Script deleted": "حُذف النص",
  "Could not delete the script": "تعذّر حذف النص",
  "Delete script": "احذف النص",
  Model: "النموذج",
  Latency: "زمن الاستجابة",
  Tokens: "التوكنات",
  unavailable: "غير متاح",
  "Waiting for the first step…": "في انتظار الخطوة الأولى…",
  "Loading run…": "جارٍ تحميل التشغيل…",
  "Provider fallback used": "استُخدم مزوّد بديل",

  // ---- section editor ----------------------------------------------------
  Saving: "جارٍ الحفظ",
  Saved: "تم الحفظ",
  "Not saved": "لم يُحفظ",
  "Rewrite this section with AI": "أعد صياغة هذا القسم بالذكاء الاصطناعي",
  "Move section up": "حرّك القسم لأعلى",
  "Move section down": "حرّك القسم لأسفل",
  "Delete section": "احذف القسم",
  "Section heading": "عنوان القسم",
  Goal: "الهدف",
  "Write this section the way you would say it out loud…":
    "اكتب هذا القسم بالطريقة التي تقولها بها بصوت عالٍ…",
  "Hide production note": "أخفِ ملاحظة الإنتاج",
  "Production note": "ملاحظة الإنتاج",
  "Notes for the edit, b-roll, on-screen text…":
    "ملاحظات للمونتاج، أو لقطات B-roll، أو نص على الشاشة…",
  "This hook is {n} words — the opening usually lands better under 45.":
    "الهوك {n} كلمة — الافتتاحية عادةً أفضل تحت ٤٥ كلمة.",

  // ---- projects ----------------------------------------------------------
  Context: "السياق",
  "New project": "مشروع جديد",
  "Edit project": "تعديل المشروع",
  "Loading projects…": "جارٍ تحميل المشاريع…",
  "No projects yet": "لا توجد مشاريع بعد",
  "{n} ideas": "{n} فكرة",
  "{n} developed": "{n} مُطوَّر",
  "{n} scripts": "{n} نص",
  "Give the project a name with at least 2 characters.":
    "اكتب اسمًا للمشروع من حرفين على الأقل.",
  "A project is a context boundary. Ideas, scripts, runs and style stay scoped to it, so two channels never bleed into each other.":
    "المشروع هو حدود السياق. الأفكار والنصوص والتشغيلات والأسلوب تبقى مرتبطة به، فلا تختلط قناتان أبدًا.",
  "One is created automatically the first time you capture an idea, but you can split work by channel, series or client at any time.":
    "يُنشأ مشروع تلقائيًا أول مرة تلتقط فيها فكرة، ويمكنك تقسيم العمل حسب القناة أو السلسلة أو العميل في أي وقت.",
  "Project updated": "تم تحديث المشروع",
  "Project created": "تم إنشاء المشروع",
  "Project restored": "تم استرجاع المشروع",
  "Project archived": "تم أرشفة المشروع",
  "Project deleted": "تم حذف المشروع",
  "Ideas and scripts stay scoped to this project.":
    "الأفكار والنصوص تبقى مرتبطة بهذا المشروع.",
  "Could not save the project": "تعذّر حفظ المشروع",
  "Could not update the project": "تعذّر تحديث المشروع",
  "Could not delete the project": "تعذّر حذف المشروع",
  "Delete “{name}”?": "حذف «{name}»؟",
  "This permanently deletes the project plus {ideas} idea(s) and {scripts} script(s) inside it, including their sections and revisions. It cannot be undone.":
    "سيؤدي هذا إلى حذف المشروع نهائيًا مع {ideas} فكرة و{scripts} نص بداخله، بما في ذلك أقسامها ومراجعاتها. لا يمكن التراجع.",
  "Keep one project per channel, series or client so context never mixes.":
    "اجعل لكل قناة أو سلسلة أو عميل مشروعًا مستقلًا حتى لا يختلط السياق.",
  "Main channel": "القناة الرئيسية",
  "Tech reviews, history, self-improvement…":
    "مراجعات تقنية، تاريخ، تطوير ذات…",
  "What is this channel or series about?": "عمّ تتحدث هذه القناة أو السلسلة؟",
  "Create project": "إنشاء مشروع",

  // ---- tools -------------------------------------------------------------
  "Tools & connections": "الأدوات والتكاملات",
  "Checking your connections…": "جارٍ التحقق من تكاملاتك…",
  "Connections unavailable": "التكاملات غير متاحة",
  "Sign in again and reload.": "سجّل الدخول مجددًا وأعد التحميل.",
  "How to add a key": "كيفية إضافة مفتاح",
  "Copy the variable name shown under the tool you want.":
    "انسخ اسم المتغيّر الظاهر تحت الأداة التي تريدها.",
  "Open this project's Keys tab and add it as a new key with exactly that name.":
    "افتح تبويب المفاتيح في هذا المشروع وأضفه كمفتاح جديد بهذا الاسم بالضبط.",
  "Come back here and press “Test” — it calls the real API.":
    "ارجع إلى هنا واضغط «اختبار» — سيستدعي الـ API الحقيقي.",
  "{n} key(s) not added yet": "{n} مفتاح لم يُضَف بعد",
  "{configured} of {total} keys present": "{configured} من {total} مفتاح متوفر",
  "Keys are stored in this project's environment, never in the code and never in your browser. This page only tells you whether a key is present, and — for most of them — whether the vendor actually accepts it.":
    "تُخزَّن المفاتيح في بيئة هذا المشروع، لا في الكود ولا في متصفحك. هذه الصفحة تخبرك فقط بوجود المفتاح، 그리고 لمعظمها هل يقبله المزوّد فعلًا.",
  "Service account": "حساب خدمة",
  "Key present": "المفتاح موجود",
  "No key": "لا مفتاح",
  "Test passed": "نجح الاختبار",
  "Test failed": "فشل الاختبار",
  Testing: "جارٍ الاختبار",
  Test: "اختبار",
  Variable: "المتغيّر",
  "{var} copied — paste it in the Keys tab":
    "تم نسخ {var} — الصقه في تبويب المفاتيح",
  "{label} responded": "استجاب {label}",
  "{label} did not pass": "لم يجتز {label}",
  "{label} test failed": "فشل اختبار {label}",
  "No cheap test endpoint for this one, so “Test” only confirms the key is present.":
    "لا توجد نقطة اختبار رخيصة لهذه الأداة، لذا «اختبار» يؤكد فقط وجود المفتاح.",
  "A key being present is not the same as a tool being in use. These are not connected to the pipeline yet — each one still needs the feature that calls it.":
    "وجود المفتاح لا يعني أن الأداة مستخدمة. هذه الأدوات غير موصولة بالمسار بعد — كل واحدة منها تحتاج الميزة التي تستدعيها.",

  // ---- tool catalog ------------------------------------------------------
  "Channel analytics, competitor channels, and uploading a finished video.":
    "تحليلات القناة وقنوات المنافسين ورفع الفيديو النهائي.",
  "Enable the YouTube Data API v3 in a Google Cloud project, then paste an API key.":
    "فعّل YouTube Data API v3 في مشروع Google Cloud ثم الصق مفتاح API.",
  "A second model provider, independent of the platform gateway.":
    "مزوّد نماذج ثانٍ، مستقل عن بوابة المنصّة.",
  "Paste the key from the DeepSeek platform.":
    "الصق المفتاح من منصّة DeepSeek.",
  "A second model provider, with very large context for long scripts.":
    "مزوّد نماذج ثانٍ بسياق ضخم للنصوص الطويلة.",
  "Paste an API key from Google AI Studio.":
    "الصق مفتاح API من Google AI Studio.",
  "One key that reaches many model providers at once.":
    "مفتاح واحد يصل إلى عدة مزوّدين للنماذج دفعة واحدة.",
  "Paste the key from openrouter.ai.": "الصق المفتاح من openrouter.ai.",
  "Web search, so research answers can be sourced instead of guessed.":
    "بحث في الويب، فتكون إجابات البحث موثّقة لا مُخمَّنة.",
  "Paste the key from the Tavily dashboard.":
    "الصق المفتاح من لوحة تحكم Tavily.",
  "Turn a YouTube URL into a transcript, so a reference video becomes usable input.":
    "يحوّل رابط يوتيوب إلى نص تفريغ، فيصبح فيديو المرجع مدخلًا قابلًا للاستخدام.",
  "Paste the key from supadata.ai.": "الصق المفتاح من supadata.ai.",
  "Read a web page as clean markdown, including pages that need JavaScript to render.":
    "يقرأ صفحة ويب كـ markdown نظيف، بما فيها الصفحات التي تحتاج JavaScript للظهور.",
  "Paste the key from firecrawl.dev.": "الصق المفتاح من firecrawl.dev.",
  "Push a publish kit into a tracking sheet — title, publish date, status.":
    "يدفع حزمة النشر إلى جدول تتبّع — العنوان، تاريخ النشر، الحالة.",
  "Not a simple key: create a Google Cloud service account and paste its JSON credentials.":
    "ليس مفتاحًا بسيطًا: أنشئ حساب خدمة في Google Cloud والصق بيانات JSON الخاصة به.",

  // ---- publish kit -------------------------------------------------------
  Description: "الوصف",
  Chapters: "الفصول",
  "Pinned comment": "تعليق مثبّت",
  "Loading publish kit…": "جارٍ تحميل حزمة النشر…",
  "Back to Script Studio": "العودة إلى استوديو النص",
  "{time} narration": "{time} إلقاء",
  "target {time}": "المستهدف {time}",
  "{written}/{total} sections written": "{written}/{total} قسم مكتوب",
  "Regenerate kit": "إعادة توليد الحزمة",
  "Build publish kit": "بناء حزمة النشر",
  "No upload — by design": "لا رفع — بالتصميم",
  "This workspace never connects to your YouTube account. Everything here is copy you paste in yourself, and the chapter timestamps are derived from this draft rather than guessed.":
    "هذه المساحة لا تتصل بحساب يوتيوب إطلاقًا. كل ما هنا نصّ تنسخه بنفسك، وأوقات الفصول مُستخرَجة من هذه المسوّدة لا مُخمَّنة.",
  "Chapters and the metadata check run first, then the copy is written.":
    "تُحسب الفصول وفحص البيانات الوصفية أولًا، ثم يُكتب النصّ.",
  "No publish kit yet": "لا توجد حزمة نشر بعد",
  "Draft the script first — the kit is built from the finished narration, so nothing is invented about a video that does not exist yet.":
    "اكتب المسوّدة أولًا — الحزمة تُبنى من الإلقاء النهائي، فلا يُخترع شيء عن فيديو لم يوجد بعد.",
  "Build the kit to get title options, a description, tags, real chapter markers, a thumbnail brief and the Shorts cuts worth pulling out of this script.":
    "ابنِ الحزمة لتحصل على عناوين مقترحة ووصف ووسوم وعلامات فصول حقيقية وموجز للصورة المصغّرة وقاطع Shorts.",
  "Building the publish kit — chapters, titles, description and Shorts cuts…":
    "جارٍ بناء حزمة النشر — الفصول والعناوين والوصف وقاطع Shorts…",
  "The publish kit could not be built": "تعذّر بناء حزمة النشر",
  "{titles} titles, {chapters} chapters, {shorts} Shorts cuts":
    "{titles} عنوانًا، {chapters} فصلًا، {shorts} قاطع Shorts",
  "{n} thing(s) to fix before you publish — see the notes below.":
    "{n} أمر يحتاج إصلاحًا قبل النشر — راجع الملاحظات أدناه.",
  "Nothing flagged by the metadata check.":
    "لم يرصد فحص البيانات الوصفية أي شيء.",
  "Publish kit deleted": "تم حذف حزمة النشر",
  "Could not delete the kit": "تعذّر حذف الحزمة",
  "Could not save that choice": "تعذّر حفظ هذا الاختيار",
  "Title options ({n})": "عناوين مقترحة ({n})",
  "No title options were produced. Regenerate the kit.":
    "لم تُنتَج عناوين. أعد توليد الحزمة.",
  "Description with chapters": "الوصف مع الفصول",
  "With chapters": "مع الفصول",
  "{n} characters. Written to be pasted as-is — no links or statistics were invented.":
    "{n} حرف. مكتوب ليُلصق كما هو — لم يُخترع أي رابط أو إحصائية.",
  "Chapters ({n})": "الفصول ({n})",
  "No chapters could be derived — this draft is too short for a chapter list to help.":
    "تعذّر استخراج فصول — المسوّدة قصيرة جدًا لي تكون قائمة الفصول مفيدة.",
  "Timestamps are calculated from each section's real narration length, so they line up with the edit.":
    "الأوقات محسوبة من الطول الحقيقي لإلقاء كل قسم، فتتطابق مع المونتاج.",
  "Tags ({n})": "الوسوم ({n})",
  "No usable tags.": "لا توجد وسوم صالحة.",
  "{n} chars": "{n} حرف",
  "Thumbnail brief": "موجز الصورة المصغّرة",
  "Overlay text": "النصّ فوق الصورة",
  Subject: "الموضوع",
  Composition: "التكوين",
  "Art direction for a human designer — no image was generated.":
    "توجيه فني لمصمّم بشري — لم تُولَّد أي صورة.",
  "No thumbnail brief was produced.": "لم يُنتَج موجز للصورة المصغّرة.",
  "Shorts cuts ({n})": "قاطعات Shorts ({n})",
  "No Shorts cuts were proposed.": "لم تُقترح أي قاطع Shorts.",
  "Copy this Shorts cut": "نسخ قاطع Shorts هذا",
  "Shorts cut": "قاطع Shorts",
  "From the section “{heading}”": "من القسم «{heading}»",
  "Before you publish": "قبل النشر",
  "The metadata check measured everything against YouTube's real field limits and found nothing to fix.":
    "قاس فحص البيانات الوصفية كل شيء مقابل حدود يوتيوب الفعلية ولم يجد ما يحتاج إصلاحًا.",
  "Deleting the kit leaves the script untouched. You can build a fresh one at any time.":
    "حذف الحزمة لا يؤثر على النص. يمكنك بناء حزمة جديدة في أي وقت.",
  "Delete publish kit": "حذف حزمة النشر",
  "{what} copied": "تم نسخ {what}",
  Metadata: "البيانات الوصفية",

  // ---- settings ----------------------------------------------------------
  Configuration: "الإعدادات",
  "Model routing": "توجيه النماذج",
  "Loading settings…": "جارٍ تحميل الإعدادات…",
  "Routing bias": "ميل التوجيه",
  "Balanced — sound output at reasonable cost":
    "متوازن — ناتج متين بتكلفة معقولة",
  "Quality — stronger models, slower and pricier":
    "الجودة — نماذج أقوى، أبطأ وأغلى",
  "Speed — fastest documented models first":
    "السرعة — أسرع النماذج الموثّقة أولًا",
  "Outline + section writing": "المخطّط + كتابة الأقسام",
  "Auto (capability routed)": "تلقائي (توجيه حسب القدرة)",
  "Custom model ids": "معرّفات نماذج مخصّصة",
  "Verify automatically after drafting": "تحقّق تلقائي بعد المسوّدة",
  "Runs the deterministic QA scan plus a model review pass once every section is written.":
    "يشغّل فحص الجودة الحتمي إضافةً إلى مراجعة بالنموذج بعد كتابة كل الأقسام.",
  "Routing preview": "معاينة التوجيه",
  Pinned: "مثبّت",
  "Fallback: {model}": "البديل: {model}",
  "Pinned {model} for this task, with {fallback} as the fallback.":
    "تم تثبيت {model} لهذه المهمة، مع {fallback} كبديل.",
  "Automatically routed to {model}.": "تم توجيهه تلقائيًا إلى {model}.",
  "One per line. The agent treats them as OpenAI-compatible endpoints and falls back to {model} if a call fails.":
    "واحد في كل سطر. يتعامل معها الوكيل كنهايات متوافقة مع OpenAI ويعود إلى {model} إذا فشل الطلب.",
  "Supported providers: {providers}. The provider credential is read on the server from the platform integration key; it is never sent to the browser.":
    "المزوّدون المدعومون: {providers}. تُقرأ بيانات المزوّد على الخادم من مفتاح التكامل، ولا تصل إلى المتصفح أبدًا.",
  "Gateway availability": "توفّر البوابة",
  "Asks the AI gateway which models this deployment can reach right now, rather than trusting a static list. {n} of them are catalogued with a curated routing strength.":
    "تسأل بوابة الذكاء الاصطناعي أي النماذج يمكن الوصول إليها الآن، بدل الاعتماد على قائمة ثابتة. منها {n} مُدرج بقوة توجيه مُنسّقة.",
  "{n} models reachable": "{n} نموذجًا متاحًا",
  "Could not reach the gateway": "تعذّر الوصول إلى البوابة",
  "Could not check the gateway": "تعذّر فحص البوابة",
  "Check gateway": "فحص البوابة",
  "Vision, tool-calling and context-length values in the catalog are conservative planning hints — the gateway does not publish capability descriptors, so they are never presented as verified.":
    "قيم الرؤية واستدعاء الأدوات وطول السياق في الكتالوج هي تلميحات تخطيطية متحفّظة — البوابة لا تنشر وصفات للقدرات، لذا لا تُعرض أبدًا كمدقّقة.",
  "Registered tools ({n})": "الأدوات المسجّلة ({n})",
  "Only tools that are fully implemented are registered. Each declares a permission level the agent core enforces before running it.":
    "لا تُسجَّل إلا الأدوات المنفَّذة بالكامل. كل أداة تعلن مستوى صلاحية يطبّقه نواة الوكيل قبل تشغيلها.",
  READ: "قراءة",
  WRITE: "كتابة",
  "Needs confirmation": "تحتاج تأكيدًا",
  Auto: "تلقائي",
  "Tools with EXTERNAL_ACTION or DESTRUCTIVE permission require explicit confirmation; none are registered yet, so no external action can run without your approval.":
    "الأدوات بصلاحية EXTERNAL_ACTION أو DESTRUCTIVE تتطلب تأكيدًا صريحًا؛ لا توجد منها مسجّلة بعد، فلا يمكن تنفيذ أي إجراء خارجي دون موافقتك.",
  "Recent agent runs": "آخر تشغيلات الوكيل",
  "No runs yet. Each model call is recorded with its model, latency and token usage.":
    "لا توجد تشغيلات بعد. كل استدعاء نموذج يُسجَّل مع النموذج وزمن الاستجابة واستهلاك الرموز.",
  "Settings saved": "تم حفظ الإعدادات",
  "Routing and verification preferences apply immediately.":
    "تُطبَّق تفضيلات التوجيه والتحقّق فورًا.",
  "Could not save settings": "تعذّر حفظ الإعدادات",

  // ---- registered tools --------------------------------------------------
  "Counts words, sentences and paragraphs and derives a narration duration estimate from the creator's pacing.":
    "يعدّ الكلمات والجمل والفقرات ويقدّر زمن الإلقاء من إيقاع المبدع.",
  "Normalises a generated outline and rescales section lengths so it fits the requested duration.":
    "يوحّد المخطّط المولّد ويعيد ضبط أطوال الأقسام ليناسب المدة المطلوبة.",
  "Deterministic quality and safety scan: empty sections, prohibited style, filler openers, repeated lines and unsourced evidence claims.":
    "فحص حتمي للجودة والسلامة: أقسام فارغة، أسلوب ممنوع، افتتاحية حشو، أسطر مكرّرة، وادّعاءات بلا مصدر.",
  "Derives YouTube chapter markers from the real per-section duration estimates, so the timestamps always match the draft.":
    "يستخرج علامات فصول يوتيوب من تقديرات المدة الحقيقية لكل قسم، فتتطابق الأوقات مع المسوّدة دائمًا.",
  "Measures titles, tags and description against YouTube's real field limits and normalises the tag list. Findings are measurements, not opinions.":
    "يقيس العناوين والوسوم والوصف مقابل حدود يوتيوب الفعلية ويوحّد قائمة الوسوم. النتائج قياسات لا آراء.",
  "Verifies that every [n] citation in a research summary points at a source that was really fetched, and reports the ones that do not.":
    "يتحقّق أن كل استشهاد [n] في ملخّص البحث يشير إلى مصدر استُرجع فعلًا، ويبلّغ عن ما لا ينطبق.",

  // ---- style profile ----------------------------------------------------
  "Creator identity": "هوية المبدع",
  "Creator name": "اسم المبدع",
  Dialect: "اللهجة",
  Tone: "النبرة",
  Pacing: "الإيقاع",
  "Storytelling style": "أسلوب السرد",
  "Preferred hooks": "الافتتاحية المفضّلة",
  "Prohibited styles": "أساليب ممنوعة",
  "Anything else": "أي شيء آخر",
  "Loading profile…": "جارٍ تحميل الملف…",
  "Save profile": "حفظ الملف",
  "Profile completeness — {filled}/{total}": "اكتمال الملف — {filled}/{total}",
  "Still missing: {fields}": "ما زال ناقصًا: {fields}",
  "Complete. The agent has everything it needs to match your voice.":
    "مكتمل. يملك الوكيل كل ما يحتاجه ليطابق صوتك.",
  "Style profile saved": "تم حفظ ملف الأسلوب",
  "Every future idea and script will use it.":
    "ستستخدمه كل فكرة ونص لاحق.",
  "Could not save the profile": "تعذّر حفظ الملف",
  "This is the difference between a generic assistant and a writer that sounds like you. It is attached to every idea development, script section and verification call.":
    "هذا هو الفرق بين مساعد عام وكاتب يشبهك. يُرفق بكل تطوير فكرة وكل قسم نصي وكل عملية تحقّق.",
  "How you refer to yourself": "كيف تسمّي نفسك",
  "Egyptian Arabic, Gulf, MSA…": "مصري، خليجي، فصحى…",
  "Slow — 130 words/min": "بطيء — 130 كلمة/دقيقة",
  "Medium — 150 words/min": "متوسط — 150 كلمة/دقيقة",
  "Fast — 175 words/min": "سريع — 175 كلمة/دقيقة",
  "Target video length (minutes)": "طول الفيديو المستهدف (بالدقائق)",
  "Who is this for?": "لمن هذا المحتوى؟",
  "direct, warm, factual, humour with restraint":
    "مباشر، دافئ، واقعي، فكاهة بحدود",
  "Separate with commas or new lines.": "افصل بينها بفاصلة أو سطر جديد.",
  "problem → proof → payoff, personal anecdote first":
    "مشكلة ← دليل ← نتيجة، يبدأ بقصة شخصية",
  "bold claim, contradiction, question the audience asks":
    "ادعاء جريء، مفارقة، سؤال يسأله المشاهد",
  "clickbait, overhyped promises, corporate jargon":
    "إثارة زائفة، وعود مبالغ فيها، مصطلحات ربر",
  "The verification scan flags any of these when it finds them in a draft.":
    "يرصد فحص التحقّق أيًا من هذه الأساليب عند وجودها في المسوّدة.",
  "Words you never use, recurring segments, sponsor rules…":
    "كلمات لا تستخدمها أبدًا، مقاطع متكررة، قواعد الرعاة…",
  "What the model actually receives": "ما الذي يصل إلى النموذج فعليًا",
  "Exact text appended to the system prompt. Secret keys never appear here — they stay on the server.":
    "النص الدقيق الذي يُضاف إلى موجّه النظام. لا تظهر المفاتيح السرية هنا أبدًا — تبقى على الخادم.",

  // ---- status pills ------------------------------------------------------
  Captured: "ملتقطة",
  Developing: "قيد التطوير",
  Developed: "مُطوَّرة",
  Drafting: "قيد الصياغة",
  Draft: "مسودة",
  Verified: "متحقَّق",
  "Needs attention": "يحتاج انتباهاً",
  Queued: "في الانتظار",
  Writing: "قيد الكتابة",
  Written: "مكتوب",
  Failed: "فشل",
  Running: "قيد التشغيل",
  Completed: "مكتمل",
  "Not generated": "غير مُولَّد",
  Generating: "قيد التوليد",
  "Ready to publish": "جاهز للنشر",
  Fact: "حقيقة",
  Inference: "استنتاج",
  "AI suggestion": "اقتراح الذكاء الاصطناعي",
  Unverified: "غير متحقّق",
  Critical: "حرج",
  Warning: "تحذير",
  Note: "ملاحظة",
  "Idea development": "تطوير الفكرة",
  "Script outline": "مخطّط النص",
  "Section writing": "كتابة القسم",
  Verification: "التحقّق",
};

export const dictionaries = {
  en: {} as Record<string, string>,
  ar,
};

export type Lang = keyof typeof dictionaries;