# Future Improvements

Post-launch items to revisit. Not blocking for initial release.

## Monetization
- [ ] Stripe integration (subscriptions, checkout, webhooks)
- [ ] Add `plan` / `stripeCustomerId` columns to users table
- [ ] Premium feature gates: AI generation, higher rate limits, more storage
- [ ] Free tier: 30 AI generations lifetime, then require subscription

## Auth
- [✅] Migrate from Clerk to Better Auth (self-hosted, no vendor lock-in)
- [ ] Add "Forgot password" link to sign-in form

## Performance
- [ ] Replace `<img>` with `<next/image>` for automatic optimization
- [ ] Add ISR revalidation to public tier list pages
- [ ] Lazy-load `html2canvas-pro` with dynamic import()
- [ ] Add per-query staleTime configs to React Query

## UX / Accessibility
- [ ] Add aria-labels to item action buttons, OAuth provider buttons
- [ ] Improve keyboard navigation for drag-and-drop
- [ ] Pagination on dashboard, search, and discover pages
+
## Content Moderation
Public lists launch **open / unmoderated** (deliberate for initial release).
- [ ] Report button on public tier lists (flag inappropriate content)
- [ ] Moderation queue / takedown flow for reported lists

## Features
- [ ] Forgot password flow
- [ ] Email notification preferences
- [ ] Display "Remixed from" attribution on tier list pages
- [ ] Profile page, user stats, public user pages
- [ ] Comments or reactions on tier lists

## Infra
- [ ] Add health check endpoint (`/api/health`)
- [ ] Structured error logging (Sentry or similar)
- [ ] R2 bucket versioning for backup
- [ ] Rate limit monitoring and alerting
- [ ] NeonDB point-in-time recovery (paid plan)
