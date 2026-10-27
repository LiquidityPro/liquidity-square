# Gemini Agent Rules

## Mandatory Pre-Push Build Verification

Always test and verify the local build before pushing any commit or branch to remote:

1. **Verification Command**:
   Run `npm run verify` from the workspace root.
   - Validates Backend TypeScript (`npx tsc --noEmit -p backend/tsconfig.json`)
   - Validates Frontend Next.js Build (`npm run build:frontend`)

2. **Strict Rule**:
   - Do NOT run `git push` if `npm run verify` fails.
   - Always diagnose and fix any compiler or type errors before pushing.
   - Do not bypass hooks with `--no-verify`.
