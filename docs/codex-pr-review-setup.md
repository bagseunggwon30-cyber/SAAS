# Codex PR Review Setup

This repository includes a GitHub Actions workflow at:

- `.github/workflows/codex-pr-review.yml`

It runs Codex on pull requests and posts the review result back as a PR comment.

## Required GitHub setup

1. Open the repository on GitHub.
2. Go to `Settings -> Secrets and variables -> Actions`.
3. Create a new repository secret named `OPENAI_API_KEY`.
4. Paste a valid OpenAI API key.
5. Make sure GitHub Actions are enabled for the repository.

## How review runs

- Trigger: PR `opened`, `synchronize`, `reopened`, `ready_for_review`
- Scope: reviews only the PR diff
- Output: one upserted PR comment titled `Codex PR Review`

## Intended behavior

- Reports bugs, regressions, runtime risks, risky state issues, missing tests, and security issues.
- Avoids style-only nitpicks.
- Updates the same PR comment on new pushes instead of spamming multiple comments.

## Notes

- This workflow assumes the PR branch is in the same repository.
- If `OPENAI_API_KEY` is missing, the workflow will fail until the secret is added.
