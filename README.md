## Overview

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.


## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```


## Common Convex Mistakes To Avoid

When using convex, make sure:
- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.

---

# ABDO CREATOR OS — version 1

A personal AI operating system for one solo YouTube creator. Version 1 ships exactly one slice
end to end: **IDEA → ANGLE → SCRIPT**, plus the workspace around it.

## What actually works

| Step | Where | What happens |
| --- | --- | --- |
| Capture | Command Center, Ideas | A raw spark is written to the database **before** any model runs, so a provider failure never loses work. |
| Develop | Ideas, idea dialog | Real model call → title, angle, spoken hook, audience, why-now, key points each labelled FACT / INFERENCE / AI SUGGESTION / UNVERIFIED, plus `openQuestions` and `riskNotes`. |
| Outline | Drafting agent | Model produces a section plan; the `script.outline_validate` tool clamps and rescales it to the requested duration. |
| Write | Drafting agent | One model call per section, written straight to the database, so Script Studio fills in progressively. A failed section is marked failed and the rest continue. |
| Verify | Script Studio | `script.qa_scan` (deterministic: empty sections, prohibited style, filler openers, repeated lines, unsourced evidence claims) + a model review pass. Both sets of findings are stored on the script. |
| Revise | Script Studio | Section editing with debounced autosave, per-section AI rewrite, reordering, add/remove, snapshots and restore, live word count and duration estimate. |

The **first screen** (Command Center) shows the pipeline with real counts, an inline capture box, ideas
in progress, recent drafts with progress, style-profile completeness and the real agent run log.

## Not built (and not stubbed)

Research/sources, YouTube + competitor analysis, Shorts, SEO, publishing, files/PDFs, long-term memory,
chat threads, background tasks. No placeholder buttons, no fake data, no mock dashboards anywhere —
the landing page lists these as not built.

## Architecture

```
Frontend (Vite + React + Tailwind)
  → Convex API (queries / mutations / actions)
    → Agent core      src/convex/agent/{step,ideas,scripts}.ts
      → Tool registry  src/lib/tools/registry.ts        (3 real, deterministic tools)
      → AI providers   src/convex/ai/exec.ts            ("use node" — the only vendor call site)
        → Router       src/lib/ai/router.ts             (capability + strength routing)
        → Catalog      src/lib/ai/models.ts             (gateway-verified ids and strengths)
      → Database       src/convex/schema.ts
```

Data model: `projects`, `creatorProfiles`, `ideas`, `scripts`, `scriptSections`, `scriptRevisions`,
`aiRuns`, `settings` (+ the Convex Auth tables). Every idea, script and run carries a `projectId`,
which is what keeps project contexts from mixing.

Only `src/convex/ai/exec.ts` touches the provider SDK, and it runs in the Convex Node runtime, so
`VLY_INTEGRATION_KEY` never reaches the browser. The frontend only ever sends a model id.

## Safety rules enforced in code

- **No fabricated sources.** The system prompt forbids inventing citations, statistics or tool results;
the QA scan flags any evidence claim (`studies show`, `وفقاً ل`, `% of`, …) with no source attached and
files it as `needs_source`.
- **No chain-of-thought.** Run steps are limited to the `Planning / Analyzing / Writing / Verifying /
Saving` union at the schema level, so private reasoning cannot be persisted or displayed.
- **Untrusted data stays data.** External and creator-supplied text is wrapped in `<untrusted_data>`
tags with an explicit instruction never to follow instructions found inside it.
- **Permissions.** Every tool declares READ / LOW_RISK_WRITE / EXTERNAL_ACTION / DESTRUCTIVE; the
registry rejects anything that needs confirmation the caller did not provide. No external-action tool
is registered yet.
- **No silent failure.** A failed run is written to `aiRuns` with the error, and the idea or script is
marked failed and retryable rather than left looking successful.

## Model routing

Tasks declare required capabilities (`text`, `structuredOutput`) and curated strengths (`reasoning`,
`writing`, `longContext`, `speed`, `cost`). Verified ids are preferred, the creator can pin a model per
task in Settings, and the chain always ends with `openai/gpt-5.4-mini` so an unavailable provider
degrades into a real answer. Every attempt — including the ones that failed — is recorded on the run.

Settings → *Check gateway* calls `ai.exec:inventory` to show how many models this deployment can
really reach (the gateway serves 390; 12 are catalogued).

## Verifying it yourself

```bash
bun convex dev --once && bun tsc -b --noEmit   # backend codegen + full typecheck
bun convex run ai/exec:listModels              # live model inventory
```

The drafting path was verified against the live gateway end to end (idea development, outline,
8/8 sections, QA scan, verification with an Arabic idea and a full style profile), and every internal
mutation the agent calls was exercised against the real database before shipping.

## Known boundaries

- Style-profile capabilities (vision, tool calling, context length) are conservative planning hints:
the gateway does not publish capability descriptors, so they are labelled as hints, not verified facts.
- Section writing returns plain text rather than JSON on purpose — a long paragraph inside a JSON
string can be truncated or mis-escaped and silently corrupt a draft.
- Verification is advisory. It never edits a draft or blocks publishing.
- Uploading/publishing to YouTube is deliberately out of scope for version 1.
