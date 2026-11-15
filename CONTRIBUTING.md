# Contributing to Sulfuric

Thanks for helping make Sulfuric better.

## Getting started

1. Fork and clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add a bot token for local testing.
4. Create a feature branch: `git checkout -b feat/your-idea`.

## Guidelines

- **One change per pull request.** Keep fixes and features separate.
- **Run `npm run check`** before opening a PR.
- **Do not commit secrets.** `.env`, `database.json`, tokens, and credentials must never be committed.
- **Match the existing style.** Plain CommonJS, no TypeScript, no linter config required.
- **Be kind in review.** This is a community project.

## Reporting bugs

Open an issue with:

- The command or action that triggered the problem.
- The expected and actual behavior.
- Node.js version and whether you ran it with `npm start` or Docker.
- Relevant log output with tokens redacted.

## Feature requests

Open an issue describing the feature and the problem it solves. Small, well-scoped requests are more likely to land than large rewrites.
