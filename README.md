# vitest-own-coverage

Check that each exported function and class method is fully covered by its own Vitest `describe` block

## Table of Contents

- [About](#about)
  - [Built with](#built-with)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Checks](#checks)
  - [Options](#options)
  - [Configuration](#configuration)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## About

Coverage reports tell whether code runs during the test suite, not whether the right tests exercise it. A function can reach 100% coverage through the tests of its callers while it has no test of its own. vitest-own-coverage measures coverage per test file and per `describe` block, so each unit has to be specified by its own tests.

### Built with

- [Vitest](https://vitest.dev/)
- [Vite](https://vite.dev/)
- [citty](https://github.com/unjs/citty)
- [Zod](https://zod.dev/)

## Getting started

### Prerequisites

1. Install [Node.js](https://nodejs.org/) 24.8 or later
2. Install [pnpm](https://pnpm.io/installation) (version in [package.json](package.json)), with its global bin directory in your `PATH` (see [`pnpm setup`](https://pnpm.io/cli/setup))
3. In the project to check, install [Vitest](https://vitest.dev/) 5 with a [coverage provider](https://vitest.dev/guide/coverage), and [Vite](https://vite.dev/) 8

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

3. Build the tool:

```shell
pnpm build
```

4. Add `vitest-own-coverage` and `voc` to your `PATH`:

```shell
pnpm add -g .
```

Rebuild after updating the repository to update the commands.

## Usage

Check a Vitest project:

```shell
# alias: voc
vitest-own-coverage <root> [options]
```

The process exits with code `1` when any check fails.

### Checks

For each test file of the Vitest project, paired with its source file (`example.test.ts` tests `example.ts`):

- The test file, run alone, must pass and fully cover its source file. When its tests fail, the report lists the failed tests and skips its `describe` checks.
- Each exported function, and each method of an exported class, must have a `describe` block of the same name (`describe("Class") > describe("method")` for methods), and that block, run alone, must fully cover it.

Source files with exported functions or classes and no test file, and test files without a source file, fail too.

Describe blocks are matched by the names Vitest gives them, so `describe(example, ...)` and `describe.each(...)("example", ...)` both match `example`.

### Options

| Option           | Default     | Description                                                             |
| ---------------- | ----------- | ----------------------------------------------------------------------- |
| `--test-infixes` | `test,spec` | Comma-separated infixes between the source name and test file extension |
| `--format`       | `text`      | `text` for people, `json` for tools and agents                          |

### Configuration

Tests run with the Vitest installed in `<root>`, which must satisfy the supported range of the `vitest` peer dependency, and with its configuration: its `include` and `exclude` choose the test files, and its `coverage.include` and `coverage.exclude` choose the source files to check. `coverage.include` is required. The checks use their own coverage reports directory and ignore `coverage.thresholds`.

## Contributing

Bug reports, feature requests, and pull requests are welcome.
See the [Contributing Guide](CONTRIBUTING.md).

## Security

See the [Security Policy](SECURITY.md).

## License

Distributed under the [MIT](https://choosealicense.com/licenses/mit/) License.
See [LICENSE](LICENSE) for more information.
