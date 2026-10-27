# Study Gacha

A website that ties real study effort to gacha rewards. Log study time against a project, take a short quiz on the material, and earn pull shards that are spent on pixel-art collectibles.

Core loop: Study (timer) -> Quiz (score) -> Reward (shards -> pulls).

## Setup

```bash
npm install                    # also generates the Prisma client
cp .env.example .env           # local SQLite path
npm run db:migrate             # create the database
```

## Commands

```bash
npm run dev        # start the dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
npm run build      # production build
npm run db:migrate # apply Prisma migrations (dev)
npm run db:generate # regenerate the Prisma client
```

## Design tokens

Colors, spacing, type sizes and border widths live in `theme/tokens.ts`. Tailwind reads that file, so only token values exist as classes.
