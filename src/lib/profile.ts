/**
 * Creator style profile completeness.
 *
 * The profile is injected into every model call, so knowing exactly what is
 * still missing is directly actionable — nothing here is decorative.
 */

export interface ProfileLike {
  displayName?: string;
  language?: string;
  dialect?: string;
  tone?: string[];
  pacing?: string;
  storytelling?: string[];
  audience?: string;
  targetLengthMin?: number;
  hookStyles?: string[];
  prohibited?: string[];
  notes?: string;
}

export interface ProfileCompleteness {
  percent: number;
  filled: number;
  total: number;
  missing: string[];
}

const LABELS = [
  "Language",
  "Dialect",
  "Tone",
  "Pacing",
  "Storytelling style",
  "Audience",
  "Preferred hooks",
  "Prohibited styles",
] as const;

export function profileCompleteness(
  profile: ProfileLike | null | undefined,
): ProfileCompleteness {
  if (!profile) {
    return {
      percent: 0,
      filled: 0,
      total: LABELS.length,
      missing: [...LABELS],
    };
  }

  const checks: boolean[] = [
    Boolean(profile.language && profile.language.trim().length > 0),
    Boolean(profile.dialect && profile.dialect.trim().length > 0),
    Array.isArray(profile.tone) && profile.tone.length > 0,
    Boolean(profile.pacing),
    Array.isArray(profile.storytelling) && profile.storytelling.length > 0,
    Boolean(profile.audience && profile.audience.trim().length > 0),
    Array.isArray(profile.hookStyles) && profile.hookStyles.length > 0,
    Array.isArray(profile.prohibited) && profile.prohibited.length > 0,
  ];

  const missing = LABELS.filter((_, index) => !checks[index]);
  const filled = checks.filter(Boolean).length;

  return {
    percent: Math.round((filled / LABELS.length) * 100),
    filled,
    total: LABELS.length,
    missing,
  };
}
