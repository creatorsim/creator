# Developing CREATOR

> [!TIP]
> You can find this information, and more at the [Developer Guide section](https://creatorsim.github.io/creator-wiki/development/setup.html) on the [CREATOR documentation](https://creatorsim.github.io/creator-wiki/).


## Project Setup
> [!WARNING]
> Make sure to initialize the [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules).
> 
> You can either add the `--recurse-submodules` flag when doing `git clone` or
> do `git submodule update --init --recursive` once it is already cloned.

This project uses [Bun](https://bun.sh) (for Web) and
[Deno](https://deno.com/) (for CLI).

> [!IMPORTANT]
> Building the assembler dependency requires installing
> [rustup](https://rustup.rs/) and [Deno](https://deno.com/)

```sh
bun install  # install dependencies
bun dev:wasm  # build wasm dependencies
```

### Compile Web and Hot-Reload for Development (with [Vite](https://vite.dev/))
```sh
bun dev:web
```

### Run CLI and Hot-Reload for Development (with [Deno](https://deno.com/))
```sh
bun dev:cli
```

> [!NOTE]
> Remember to pass the extra arguments, e.g:
> ```sh
> bun dev:cli -a ./architecture/RISCV/RV32IMFD.yml -I -c creatorconfig.yml
> ```


### Building Web version for production
```sh
bun build:web
```

The resulting bundle will be saved to `dist/web/`.

> [!TIP]
> To test locally the bundle version, as it will be deployed in GitHub Pages:
> ```bash
> REPO="creator" bun build:web
> cd dist/web
> python -m http.server 8080
> ```
> And go to [localhost:8080/creator/](https://localhost:8080/creator/)

<!--
TODO: when the code is type-safe, replace build:web to:
```
"build:web": "run-p type-check \"build-only {@}\" --",
"build-only": "vite build",
```
-->

### Building CLI version
```sh
bun build:cli
```

### Lint with [ESLint](https://eslint.org/)

```sh
bun lint
```

### Format with [Prettier](https://prettier.io/)

```sh
bun format <file/directory>
```

### Run Tests

Unit tests (with [Deno](https://deno.com/))

```sh
deno test -A --unstable-node-globals --parallel
```

Integration tests use [Deno's snapshot testing](https://docs.deno.com/examples/snapshot_test_tutorial/).
They store the last known good result, and compare new results against the
stored snapshots to verify them (showing the differences if they don't match).
For this reason, the snapshots should always be committed to the repo. They are
run along with the other tests using the command above. The snapshots can be
created/updated automatically with:

```sh
deno test -A --unstable-node-globals --parallel -- --update
```