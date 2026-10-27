# Rule: Always Test Local Build Before Pushing

## Trigger
Always active for git operations, build operations, and code modifications.

## Requirements
1. Prior to any `git push`, the agent MUST run:
   ```bash
   npm run verify
   ```
2. Both backend typecheck (`tsc --noEmit -p backend/tsconfig.json`) and frontend build (`npm run build:frontend`) must exit with 0 errors.
3. If an error is encountered, the agent must fix the issue and re-run `npm run verify`.
4. Under no circumstances should broken builds be pushed to remote or production branches.
