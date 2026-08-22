# Contributing to Codex Usage Profile

All contributions are welcome—code, documentation, bug reports, design
feedback, and ideas. You do not need to write code to help improve the project.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Choose the right place

- Ask usage and setup questions in [Q&A](https://github.com/postmelee/codex-usage-profile/discussions/categories/q-a).
- Share card design ideas in [Profile Card Customization Ideas](https://github.com/postmelee/codex-usage-profile/discussions/115).
- Show a published card or README setup in [Show and tell](https://github.com/postmelee/codex-usage-profile/discussions/116).
- Report reproducible bugs or propose a concrete feature through the [issue chooser](https://github.com/postmelee/codex-usage-profile/issues/new/choose).
- Report security vulnerabilities privately by following the [Security Policy](SECURITY.md). Do not disclose them in a public issue or discussion.

Ideas are welcome in Discussions before they are fully scoped. Once a change is
specific enough to implement, use an Issue to agree on its goal and boundaries.
For substantial changes, please wait for scope agreement before starting work.

## Development setup

You need Node.js 20 or newer.

```bash
npm install
npm run dev
npm run dev:runtime
```

`npm run dev` starts the Vite frontend. `npm run dev:runtime` starts the
same-origin local runtime used for frontend and `/api/*` development.

Before opening a pull request, run the checks relevant to your change. The
standard baseline is:

```bash
npm test
npm run build
```

If you change the npm package or public release surface, also run the release
verification commands documented in the root README.

## Pull requests

1. Fork the repository and create a focused branch from `devel`.
2. Keep commits limited to the agreed scope.
3. Add or update tests and documentation when behavior changes.
4. Run the relevant validation commands and record the results.
5. Open a pull request targeting `devel` and use the repository's
   `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` template.

In the pull request, explain the problem, the chosen solution, the validation
you ran, and any remaining limitations. Include screenshots for visible changes.
External contributors are not expected to create the project's internal
Hyper-Waterfall planning or stage-report documents.

Maintainers may ask to narrow a change, add tests, or move early exploration
back to a Discussion before review continues.

## License

By contributing, you agree that your contributions will be licensed under the
repository's [MIT License](LICENSE).
