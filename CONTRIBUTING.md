# Contributing Guide

## Table of Contents

- [Guidelines](#guidelines)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Development](#development)

## Guidelines

Read the [Guidelines](GUIDELINES.md) before opening an issue or a pull request.

## Getting started

### Prerequisites

1. Install [Node.js](https://nodejs.org/) (version in [.nvmrc](.nvmrc))
2. Install [pnpm](https://pnpm.io/installation) (version in [package.json](package.json))

### Installation

1. Clone the repository:

```shell
git clone https://github.com/MrSquaare/vitest-own-coverage.git
cd vitest-own-coverage
```

2. Install the dependencies:

```shell
pnpm install
```

## Development

Check the types:

```shell
pnpm typecheck
```

Lint and check the format of the code:

```shell
pnpm check
```

Lint and format the code:

```shell
pnpm check:fix
```

Run the tests:

```shell
pnpm test
```

Run the end-to-end tests:

```shell
pnpm test:e2e
```

Check that the tool's own code is covered by its own tests:

```shell
pnpm coverage:check
```

Build the package:

```shell
pnpm build
```
