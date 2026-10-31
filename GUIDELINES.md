# Guidelines

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Git](#git)
  - [Branches](#branches)
  - [Commits](#commits)
- [Issues](#issues)
- [Pull requests](#pull-requests)

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Git

### Branches

This project follows the [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow):

- `main` contains the latest stable version. It is protected.
- `<issue-number>-<short-description>` resolves an issue. It is created from `main` and merged into `main`.

### Commits

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Issues

Before opening an issue, search for a similar issue, open or closed. If one exists, comment only to add useful information. Otherwise, [open an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-an-issue).

## Pull requests

Before opening a pull request, search for a similar pull request. If one exists, contribute to it instead. Otherwise:

1. For non-trivial changes, open an issue first by following the [Issues](#issues) section
2. [Fork the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)
3. Create a branch by following the [Branches](#branches) section (Tip: [create a branch for an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-a-branch-for-an-issue)):

```shell
git checkout -b <issue-number>-<short-description>
```

4. Make your changes by following the [Contributing Guide](CONTRIBUTING.md)
5. Commit your changes by following the [Commits](#commits) section
6. Push your branch:

```shell
git push -u origin <issue-number>-<short-description>
```

7. [Open a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)
