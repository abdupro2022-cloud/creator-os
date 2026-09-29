import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildPublishMessages } from "../lib/ai/prompts";
import { parseModelOutput, publishPackSchema } from "../lib/ai/schemas";
import {
  callTool,
  type ChapterPlan,
  type MetadataCheck,
  type QaScan,
} from "../lib/tools/registry";
import { countWords, estimateSeconds, formatDuration } from "../lib/script";

/** TEMPORARY diagnostic harness — deleted immediately after it runs. */

interface StepResult {
  ok: boolean;
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  candidates: { provider: string; model: string; ok: boolean; error?: string }[];
  routingReason: string;
  error?: string;
}

interface ExecResult {
  ok: boolean;
  text?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}

/**
 * Every field is optional because this harness reports a different best-effort
 * shape at each stage. The explicit annotation is load-bearing: without it the
 * handler's inference cycle poisons the generated `internal` types and every
 * `runQuery` in the app degrades to `any`.
 */
interface Probe {
  model: string;
  ok: boolean;
  stage?: string;
  error?: string;
  chaptersDerived?: number;
  chapterIssues?: string[];
  chapterSample?: string[];
  scanFindings?: number;
  titles?: number;
  titleChars?: number[];
  descriptionChars?: number;
  tags?: string[];
  tagChars?: number;
  metaIssues?: string[];
  titleNotes?: string[];
  shorts?: number;
  beats?: number;
  shortsMatched?: number;
  thumbnailOverlay?: string;
  rawChars?: number;
  rawHead?: string;
  rawTail?: string;
  routingReason?: string;
  tried?: string[];
}

const SECTIONS: {
  heading: string;
  role: "hook" | "intro" | "body" | "cta" | "outro";
  body: string;
}[] = [
  {
    heading: "المقدمة",
    role: "hook",
    body: "تخيل أنك تفتح دفتر ملاحظاتك في الصباح فتجد عشرين فكرة، وكل واحدة تبدو عظيمة، ثم لا تنتج ولا واحدة منها لأنك لا تعرف من أين تبدأ. هذا بالضبط ما يحدث لمعظم صناع المحتوى، والمشكلة ليست في الأفكار بل في الترتيب.",
  },
  {
    heading: "لماذا تتراكم الأفكار",
    role: "body",
    body: "الفكرة في لحظتها تبدو واضحة تماما، لكنها تعيش في رأسك فقط. وبعد أسبوع من تسجيلها ستنسى لماذا أثارت اهتمامك أصلا. الدفتر يحفظ الكلمات ولا يحفظ الشرارة، ولهذا تتحول قائمتك إلى أرشيف لا إلى خطة. الحل ليس أن تكتب أكثر، بل أن تكتب ما يكفي لتعود إلى الشرارة لاحقا.",
  },
  {
    heading: "تحديد الجمهور",
    role: "body",
    body: "قبل أن تكتب أي نص، اسأل نفسك سؤالا واحدا: من هو الشخص الذي سيتوقف عن التمرير ليرى هذا؟ الإجابة تحدد كل شيء بعدها، من العنوان إلى أول جملة. الجمهور العريض يبدو مغريا لكنه يجعل النص باهتا، لأنك تحاول أن ترضي الجميع فلا تلامس أحدا.",
  },
  {
    heading: "الزاوية",
    role: "body",
    body: "الموضوع هو ما تتحدث عنه، والزاوية هي ما تقوله عنه. الفرق بينهما هو الفرق بين فيديو يشرح التخطيط وفيديو يقول لك إن التخطيط الزائد هو ما يقتل الإبداع. اختر زاوية يمكن الدفاع عنها، ثم اكتب كل قسم وأنت تسأل: هل هذا يدعم الزاوية أم يشتت عنها؟",
  },
  {
    heading: "الافتتاحية في ثلاثين ثانية",
    role: "body",
    body: "أول ثلاثين ثانية تحدد إن كان المشاهد سيبقى أم لا. لا تبدأ بتعريف نفسك ولا بترحيب، ابدأ بالوعد. قل له بالضبط ما سيخرج به من هذا الفيديو، ثم ابدأ بالتنفيذ مباشرة. المشاهد يمنحك ثواني قليلة فقط، فاستخدمها على المشكلة لا على الشكليات.",
  },
  {
    heading: "البناء والتحرير",
    role: "body",
    body: "اكتب المسودة كاملة دون توقف ثم عد إليها في اليوم التالي بعين القارئ. احذف كل جملة لا تحرك الفكرة إلى الأمام، واقرأ بصوت عال. الجمل التي تتلعثم عندها هي الجمل التي تحتاج إعادة كتابة، وليست المشكلة في صوتك.",
  },
  {
    heading: "الخطوة التالية",
    role: "cta",
    body: "اختر فكرة واحدة من قائمتك الآن واكتب لها افتتاحية من ثلاثين ثانية فقط، لا أكثر. ستكتشف خلال عشر دقائق إن كانت تستحق أن تصبح فيديو كاملا أم لا. وإذا أردت أن أشرح المرحلة التالية خطوة بخطوة، أخبرني في التعليقات.",
  },
];

const flat = (text: string, limit: number) => {
  const value = text.trim().replace(/\s+/g, " ");
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

function build(threshold: number | undefined) {
  const sections = SECTIONS.map((entry, index) => {
    const words = countWords(entry.body);
    return {
      id: `synthetic-${index}`,
      heading: entry.heading,
      role: entry.role,
      words,
      estSeconds: estimateSeconds(words, 150),
      body: entry.body,
    };
  });
  const totalSeconds = sections.reduce((sum, s) => sum + s.estSeconds, 0);
  const wordCount = sections.reduce((sum, s) => sum + s.words, 0);
  return { sections, totalSeconds, wordCount, threshold };
}

export const test = internalAction({
  args: { model: v.optional(v.string()), mode: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Probe> => {
    // A deliberately trivial JSON request, to tell "this family cannot return
    // JSON through the gateway" apart from "this particular prompt broke it".
    if (args.mode === "plain") {
      const probe: ExecResult = await ctx.runAction(internal.ai.exec.complete, {
        model: args.model ?? "openai/gpt-5.4-mini",
        messages: [
          { role: "system", content: "Reply with one short Arabic sentence." },
          { role: "user", content: "اكتب جملة واحدة قصيرة عن الإبداع." },
        ],
        temperature: 0.5,
        maxTokens: 120,
      });
      return {
        model: args.model ?? "openai/gpt-5.4-mini",
        ok: probe.ok,
        stage: "plain",
        error: probe.error,
        rawChars: probe.text?.length ?? 0,
        rawHead: probe.text,
      };
    }

    if (args.mode === "simple") {
      const probe: ExecResult = await ctx.runAction(internal.ai.exec.complete, {
        model: args.model ?? "openai/gpt-5.4-mini",
        messages: [
          {
            role: "system",
            content:
              'Reply with JSON only: {"ok": true, "word": "مرحبا"}',
          },
          { role: "user", content: "Give me that object." },
        ],
        temperature: 0.2,
        maxTokens: 100,
      });
      return {
        model: args.model ?? "openai/gpt-5.4-mini",
        ok: probe.ok,
        stage: "simple",
        error: probe.error,
        rawChars: probe.text?.length ?? 0,
        rawHead: probe.text,
      };
    }

    const { sections, totalSeconds, wordCount } = build(undefined);
    const title = "لماذا تتراكم أفكارك ولا تنتج منها شيئا";

    const planResult = await callTool("publish.chapter_plan", {
      sections: sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        role: section.role,
        estSeconds: section.estSeconds,
      })),
    });
    const plan = planResult.data as ChapterPlan;

    const scanResult = await callTool("script.qa_scan", {
      sections: sections.map((section) => ({
        id: section.id,
        role: section.role,
        heading: section.heading,
        body: section.body,
      })),
      prohibited: [],
      pacing: "medium",
    });
    const scan = scanResult.data as QaScan;

    const messages = buildPublishMessages({
      title,
      angle: "",
      hook: flat(sections[0].body, 400),
      wordCount,
      estSeconds: totalSeconds,
      targetDurationSec: 300,
      format: "long_form",
      sections: sections.map((section) => ({
        heading: section.heading,
        role: section.role,
        words: section.words,
        excerpt: flat(section.body, 240),
      })),
      chapterLabels: plan.chapters.map(
        (chapter) => `${formatDuration(chapter.atSeconds)} ${chapter.label}`,
      ),
      deterministicFindings: scan.issues.map(
        (issue) => `${issue.severity} (${issue.kind}): ${issue.message}`,
      ),
      profile: null,
    });

    // Exercised through the real routing chain, exactly as the action calls it.
    const attempt: StepResult = await ctx.runAction(internal.agent.step.run, {
      taskType: "publish_pack",
      messages,
      temperature: 0.7,
      maxTokens: 2600,
      preference: "balanced",
      preferredModelId: args.model,
      extraModelIds: [],
    });
    const tried = attempt.candidates.map(
      (candidate) => `${candidate.model}${candidate.ok ? " (ok)" : " (failed)"}`,
    );

    if (!attempt.ok || !attempt.text) {
      return {
        model: attempt.model || "none answered",
        ok: false,
        error: attempt.error,
        chaptersDerived: plan.chapters.length,
        chapterIssues: plan.issues.map((i) => `${i.severity}: ${i.message}`),
        routingReason: attempt.routingReason,
        tried,
      };
    }

    const parsed = parseModelOutput(attempt.text, publishPackSchema);
    if (!parsed.ok || !parsed.data) {
      return {
        model: attempt.model,
        ok: false,
        stage: "parse",
        error: parsed.error,
        chaptersDerived: plan.chapters.length,
        rawChars: attempt.text.length,
        rawHead: attempt.text.slice(0, 400),
        rawTail: attempt.text.slice(-200),
        routingReason: attempt.routingReason,
        tried,
      };
    }

    const checkResult = await callTool("publish.metadata_check", {
      titles: parsed.data.titles.map((entry) => entry.text),
      tags: parsed.data.tags,
      description: parsed.data.description,
    });
    const check = checkResult.data as MetadataCheck;
    const headings = new Set(
      sections.map((section) => section.heading.trim().toLowerCase()),
    );

    return {
      model: attempt.model,
      ok: true,
      routingReason: attempt.routingReason,
      tried,
      chaptersDerived: plan.chapters.length,
      chapterIssues: plan.issues.map((i) => `${i.severity}: ${i.message}`),
      chapterSample: plan.chapters.map(
        (chapter) => `${formatDuration(chapter.atSeconds)} ${chapter.label}`,
      ),
      scanFindings: scan.issues.length,
      titles: parsed.data.titles.length,
      titleChars: parsed.data.titles.map((entry) => entry.text.length),
      descriptionChars: parsed.data.description.length,
      tags: check.cleanTags,
      tagChars: check.tagCharacters,
      metaIssues: check.issues.map((i) => `${i.severity}: ${i.message}`),
      titleNotes: check.titles.flatMap((entry) => entry.issues),
      shorts: parsed.data.shorts.length,
      beats: parsed.data.shorts.reduce((sum, cut) => sum + cut.beats.length, 0),
      shortsMatched: parsed.data.shorts.filter(
        (cut) =>
          cut.sourceHeading &&
          headings.has(cut.sourceHeading.trim().toLowerCase()),
      ).length,
      thumbnailOverlay: parsed.data.thumbnail.overlayText,
    };
  },
});
