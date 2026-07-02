# 53 — Consolidate auth state to React Query

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Delete the Zustand auth store (`store/auth.ts`) and the bridge hook (`hooks/useInitAuth.ts`). Replace with a single `useAuth()` hook wrapping `useQuery(["auth", "me"])`. Auth state has one source of truth with no divergence window. After login, call `invalidateQueries(["auth", "me"])` instead of `setAuth` (avoids relying on the login response's partial user shape). After logout/account deletion, `queryClient.clear()` is sufficient — no separate `clearAuth` needed.

## Acceptance criteria

- [ ] `hooks/useAuth.ts` exports `useAuth()` returning `{ user: AuthUser | null; isAuthenticated: boolean; isLoading: boolean }`
- [ ] `useInitAuth.ts` and `store/auth.ts` are deleted
- [ ] All consumers (`App`, `ProtectedRoute`, `LoginPage`, `AvatarDropdown`, `SettingsPage`, `FeedPage`, `AskPage`, `PostDetailPage`, `UserProfilePage`) import from `useAuth` only
- [ ] Login `onSuccess` calls `invalidateQueries({ queryKey: ["auth", "me"] })` instead of `setAuth`
- [ ] Logout and account-deletion `onSuccess` handlers drop `clearAuth()` — `queryClient.clear()` already covers it
- [ ] TypeScript compiles clean
