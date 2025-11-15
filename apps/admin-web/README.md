# Admin Web

React 19 + Vite dashboard shell that consumes the NestJS wallet API from the monorepo. The UI is themed with Tailwind CSS tokens, shadcn/ui components, and an all-rounded clickable surface policy per the admin design brief.

## Commands

Run everything from the repository root so shared `.env.*` files are respected:

| Command | Purpose |
| --- | --- |
| `pnpm --filter admin-web dev` | Start the Vite dev server with Tailwind in watch mode. |
| `pnpm --filter admin-web build` | Type-check and build the production bundle. |
| `pnpm --filter admin-web lint` | Run ESLint against the project. |
| `pnpm --filter admin-web preview` | Preview the production build locally. |

Environment variables: set `VITE_API_BASE_URL` in `.env.local` for dev and `.env.production` for builds so both the API and admin stay aligned.

## Styling stack

- **Tailwind CSS** drives utility classes with a container preset and disabled drop shadows.  
- **Tokens:** `src/index.css` defines CSS variables (`--primary`, `--primary-pink`, `--primary-fuchsia`, `--primary-purple`, etc.) that map directly to the mandated pink→purple palette and are surfaced via `tailwind.config.ts`.  
- **Rounded CTAs:** all button variants are derived from the shadcn button component, which defaults to `rounded-full`, while inputs use matching pills and focus rings colored by the primary palette.  
- **Utilities:** common helpers such as the `cn` function live under `src/lib/utils.ts`.

## shadcn/ui workflow

`components.json` at the app root keeps the CLI aligned with Tailwind and the existing folder structure. To scaffold a new component:

```bash
pnpm --filter admin-web dlx shadcn-ui@latest add <component>
```

The generated files go into `src/components`, and the CLI automatically reuses the shared tokens and styling rules.
