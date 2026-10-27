# Agent Directives & Operating Rules

## MANDATORY: Local Build & Pre-Push Verification

**NEVER push code to the remote repository without first testing and verifying the build locally.**

Before running any `git push` command, creating a pull request, or finalizing tasks with code changes:

1. **Run Local Verification**:
   Execute the verification pipeline from the workspace root:
   ```bash
   npm run verify
   ```
   This automatically validates:
   - Backend TypeScript compilation & typecheck (`npx tsc --noEmit -p backend/tsconfig.json`)
   - Frontend Next.js production build & typecheck (`npm run build:frontend`)

2. **Zero Tolerance for Build / Type Errors**:
   - If any verification check fails with errors or exit code != 0, **DO NOT PUSH**.
   - Fix all compilation, typing, lint, and build issues immediately.
   - Re-run `npm run verify` until it exits cleanly with code 0.

3. **No `--no-verify` or Hook Bypasses**:
   - Never bypass Git hooks using `--no-verify` or `-n`.
   - If a build fails locally, it will fail production deployment on Vercel/CI.

4. **Self-Audit Checklist Before Pushing**:
   - [ ] All modified TypeScript files are type-safe (no `null | undefined` assignability regressions).
   - [ ] `npm run verify` completes with exit code 0.
   - [ ] Working tree status is reviewed (`git status`) before pushing.
