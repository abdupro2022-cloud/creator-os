import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/**
 * The creator pipeline.
 *
 * `live` marks a stage that really produces something today. `note` states the
 * exact boundary — Research fetches from a vendor only when its key is set,
 * Shorts and SEO are generated plans, and Publish builds the kit but never
 * uploads anywhere.
 */
export const PIPELINE_STAGES = [
  { id: "idea", label: "Idea", live: true },
  {
    id: "research",
    label: "Research",
    live: true,
    note: "Needs a research key",
  },
  { id: "angle", label: "Angle", live: true },
  { id: "script", label: "Script", live: true },
  { id: "shorts", label: "Shorts", live: true, note: "Cut plan" },
  { id: "seo", label: "SEO", live: true, note: "Metadata kit" },
  { id: "publish", label: "Publish", live: true, note: "No upload" },
] as const;

export const ideaStatusValidator = v.union(
  v.literal("captured"),
  v.literal("developing"),
  v.literal("developed"),
  v.literal("failed"),
);
export type IdeaStatus = Infer<typeof ideaStatusValidator>;

export const scriptStatusValidator = v.union(
  v.literal("drafting"),
  v.literal("draft"),
  v.literal("verified"),
  v.literal("failed"),
);
export type ScriptStatus = Infer<typeof scriptStatusValidator>;

export const sectionRoleValidator = v.union(
  v.literal("hook"),
  v.literal("intro"),
  v.literal("body"),
  v.literal("cta"),
  v.literal("outro"),
);
export type SectionRole = Infer<typeof sectionRoleValidator>;

export const sectionStatusValidator = v.union(
  v.literal("queued"),
  v.literal("writing"),
  v.literal("written"),
  v.literal("failed"),
);

/**
 * Every claim the assistant produces is labelled so the creator can tell a
 * verifiable fact from a model suggestion. Nothing is presented as sourced
 * material unless a real source exists.
 */
export const knowledgeKindValidator = v.union(
  v.literal("fact"),
  v.literal("inference"),
  v.literal("suggestion"),
  v.literal("unverified"),
);
export type KnowledgeKind = Infer<typeof knowledgeKindValidator>;

export const keyPointValidator = v.object({
  text: v.string(),
  kind: knowledgeKindValidator,
});

export const refinedIdeaValidator = v.object({
  title: v.string(),
  oneLiner: v.string(),
  angle: v.string(),
  hook: v.string(),
  audience: v.string(),
  format: v.union(
    v.literal("long_form"),
    v.literal("short"),
    v.literal("both"),
  ),
  whyNow: v.string(),
  keyPoints: v.array(keyPointValidator),
  openQuestions: v.array(v.string()),
  /** Claims that would need a real source before publishing. Never invented. */
  riskNotes: v.array(v.string()),
  model: v.string(),
  generatedAt: v.number(),
});
export type RefinedIdea = Infer<typeof refinedIdeaValidator>;

/** Safe, non-chain-of-thought progress labels shown to the creator. */
export const runStepLabelValidator = v.union(
  v.literal("Planning"),
  v.literal("Analyzing"),
  v.literal("Writing"),
  v.literal("Verifying"),
  v.literal("Saving"),
);

export const runStepValidator = v.object({
  label: runStepLabelValidator,
  status: v.union(
    v.literal("started"),
    v.literal("done"),
    v.literal("failed"),
  ),
  detail: v.optional(v.string()),
  at: v.number(),
});

export const runCandidateValidator = v.object({
  provider: v.string(),
  model: v.string(),
  ok: v.boolean(),
  latencyMs: v.optional(v.number()),
  error: v.optional(v.string()),
});

export const runStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);
export type RunStatus = Infer<typeof runStatusValidator>;

export const runKindValidator = v.union(
  v.literal("research"),
  v.literal("idea_development"),
  v.literal("script_outline"),
  v.literal("script_section"),
  v.literal("script_verification"),
  v.literal("publish_pack"),
);
export type RunKind = Infer<typeof runKindValidator>;

/* ----------------------------- research ----------------------------- */

/**
 * A source is only ever stored after a real fetch returned it. The URL comes
 * from the vendor, never from the model, so a citation can always be opened.
 */
export const sourceValidator = v.object({
  title: v.string(),
  url: v.string(),
  snippet: v.string(),
});
export type Source = Infer<typeof sourceValidator>;

export const researchKindValidator = v.union(
  v.literal("web"),
  v.literal("transcript"),
  v.literal("page"),
);
export type ResearchKind = Infer<typeof researchKindValidator>;

/**
 * Material gathered from outside the model: a Tavily search, a Supadata
 * transcript, or a page Firecrawl rendered to markdown. The summary is written
 * by the model but every citation in it is checked against `sources` before it
 * is stored.
 */
/* --------------------------- publish kit --------------------------- */

export const publishStatusValidator = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("ready"),
  v.literal("failed"),
);
export type PublishStatus = Infer<typeof publishStatusValidator>;

/** A title option with the reason it should earn the click. */
export const titleOptionValidator = v.object({
  text: v.string(),
  rationale: v.string(),
});
export type TitleOption = Infer<typeof titleOptionValidator>;

export const thumbnailBriefValidator = v.object({
  overlayText: v.string(),
  subject: v.string(),
  composition: v.string(),
});
export type ThumbnailBrief = Infer<typeof thumbnailBriefValidator>;

/**
 * Chapter markers are derived from the real per-section duration estimates,
 * never from the model, so the timestamps always match the draft.
 */
export const chapterValidator = v.object({
  atSeconds: v.number(),
  label: v.string(),
});
export type Chapter = Infer<typeof chapterValidator>;

export const shortCutValidator = v.object({
  title: v.string(),
  hook: v.string(),
  beats: v.array(v.string()),
  /** Heading of the script section the cut is taken from, when one matches. */
  sourceHeading: v.optional(v.string()),
});
export type ShortCut = Infer<typeof shortCutValidator>;

export const verificationValidator = v.object({
  summary: v.string(),
  score: v.number(),
  model: v.string(),
  checkedAt: v.number(),
  issues: v.array(
    v.object({
      severity: v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("critical"),
      ),
      kind: v.string(),
      message: v.string(),
      sectionId: v.optional(v.string()),
    }),
  ),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /** A context container. Ideas and scripts never mix across projects. */
    projects: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      niche: v.optional(v.string()),
      archived: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner", ["ownerId", "updatedAt"])
      .index("by_owner_name", ["ownerId", "name"]),

    /** One creator identity per owner: language, tone, pacing, banned styles. */
    creatorProfiles: defineTable({
      ownerId: v.id("users"),
      displayName: v.optional(v.string()),
      language: v.string(),
      dialect: v.string(),
      tone: v.array(v.string()),
      pacing: v.union(
        v.literal("slow"),
        v.literal("medium"),
        v.literal("fast"),
      ),
      storytelling: v.array(v.string()),
      audience: v.string(),
      targetLengthMin: v.number(),
      hookStyles: v.array(v.string()),
      prohibited: v.array(v.string()),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    /** Raw sparks plus the developed angle produced by the agent. */
    ideas: defineTable({
      ownerId: v.id("users"),
      projectId: v.id("projects"),
      rawInput: v.string(),
      status: ideaStatusValidator,
      refined: v.optional(refinedIdeaValidator),
      lastRunId: v.optional(v.id("aiRuns")),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_project", ["projectId", "createdAt"])
      .index("by_status", ["ownerId", "status"]),

    scripts: defineTable({
      ownerId: v.id("users"),
      projectId: v.id("projects"),
      ideaId: v.optional(v.id("ideas")),
      title: v.string(),
      status: scriptStatusValidator,
      targetDurationSec: v.number(),
      wordsPerMinute: v.number(),
      wordCount: v.number(),
      estSeconds: v.number(),
      verification: v.optional(verificationValidator),
      lastRunId: v.optional(v.id("aiRuns")),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner_updated", ["ownerId", "updatedAt"])
      .index("by_project", ["projectId", "updatedAt"]),

    scriptSections: defineTable({
      ownerId: v.id("users"),
      scriptId: v.id("scripts"),
      projectId: v.id("projects"),
      order: v.number(),
      role: sectionRoleValidator,
      heading: v.string(),
      intent: v.optional(v.string()),
      body: v.string(),
      notes: v.optional(v.string()),
      status: sectionStatusValidator,
      targetWords: v.number(),
      wordCount: v.number(),
      estSeconds: v.number(),
      updatedAt: v.number(),
    })
      .index("by_script", ["scriptId", "order"])
      .index("by_owner", ["ownerId"]),

    /**
     * One gathered research note per request. `sources` are the real URLs the
     * vendor returned; `summary` is the model's digest of them, and every
     * citation in it is verified against `sources` before saving.
     */
    researchNotes: defineTable({
      ownerId: v.id("users"),
      projectId: v.id("projects"),
      ideaId: v.optional(v.id("ideas")),
      kind: researchKindValidator,
      /** What the creator asked for: a query, a video URL, or a page URL. */
      input: v.string(),
      summary: v.string(),
      findings: v.array(v.string()),
      sources: v.array(sourceValidator),
      /** What the material does not answer — recorded, never silently dropped. */
      gaps: v.array(v.string()),
      model: v.optional(v.string()),
      lastRunId: v.optional(v.id("aiRuns")),
      createdAt: v.number(),
    })
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_idea", ["ideaId", "createdAt"]),

    /** Append-only snapshots so a draft can always be rolled back. */
    scriptRevisions: defineTable({
      ownerId: v.id("users"),
      scriptId: v.id("scripts"),
      label: v.string(),
      reason: v.string(),
      snapshot: v.string(),
      wordCount: v.number(),
      createdAt: v.number(),
    }).index("by_script", ["scriptId", "createdAt"]),

    /**
     * Observability for every model call: which provider answered, how long it
     * took, what it cost in tokens, and the safe progress labels shown in the UI.
     */
    aiRuns: defineTable({
      ownerId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      kind: runKindValidator,
      status: runStatusValidator,
      taskType: v.string(),
      steps: v.array(runStepValidator),
      candidates: v.array(runCandidateValidator),
      provider: v.optional(v.string()),
      model: v.optional(v.string()),
      promptTokens: v.number(),
      completionTokens: v.number(),
      latencyMs: v.number(),
      routingReason: v.optional(v.string()),
      targetId: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      finishedAt: v.optional(v.number()),
    })
      .index("by_owner_created", ["ownerId", "createdAt"])
      .index("by_target", ["ownerId", "targetId", "createdAt"]),

    /**
     * The publish kit for one script: what goes in the title, description, tags,
     * chapters and thumbnail, plus the Shorts cuts worth pulling out of it.
     * Nothing here is uploaded anywhere — it is copy the creator takes to YouTube.
     */
    publishPacks: defineTable({
      ownerId: v.id("users"),
      scriptId: v.id("scripts"),
      projectId: v.id("projects"),
      status: publishStatusValidator,
      titles: v.array(titleOptionValidator),
      chosenTitleIndex: v.optional(v.number()),
      description: v.string(),
      tags: v.array(v.string()),
      chapters: v.array(chapterValidator),
      pinnedComment: v.string(),
      thumbnail: v.optional(thumbnailBriefValidator),
      shorts: v.array(shortCutValidator),
      /** Findings from the deterministic checks, not model opinions. */
      titleIssues: v.array(v.string()),
      metadataIssues: v.array(v.string()),
      model: v.optional(v.string()),
      lastRunId: v.optional(v.id("aiRuns")),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_script", ["scriptId"])
      .index("by_owner_updated", ["ownerId", "updatedAt"]),

    settings: defineTable({
      ownerId: v.id("users"),
      ideaModel: v.optional(v.string()),
      scriptModel: v.optional(v.string()),
      verificationModel: v.optional(v.string()),
      routingPreference: v.union(
        v.literal("balanced"),
        v.literal("quality"),
        v.literal("speed"),
      ),
      extraModelIds: v.array(v.string()),
      autoVerify: v.boolean(),
      /** YouTube Data API: channel id, or the @handle without the @. */
      youtubeChannelId: v.optional(v.string()),
      /** Spreadsheet that receives every publish kit as a tracking row. */
      trackingSheetId: v.optional(v.string()),
      trackingSheetTab: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_owner", ["ownerId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
