# pnpm dedupePeers repeated-install reproduction

A zero-dependency reproduction of the pre-script dependency-check bug in **pnpm 12.15.0**. Requires Node.js and that exact pnpm version on PATH. No WordPress packages, private registry, or configuration plugins are needed.

## Reproduce

```sh
pnpm --version # Must print 12.15.0
pnpm install
pnpm run repro
pnpm run repro

# The warning also persists after another explicit install.
pnpm install
pnpm run repro
pnpm run repro
```

All four script runs perform another install, print the following warning, and then print `script ran`:

```text
[WARN] The install that ran before the script left node_modules out of date, so the next run installs again. a lockfile setting drifted from the current configuration
```

Expected behavior: after the initial successful install, subsequent script runs should use the existing installation without reinstalling or warning.

## Show the precise mismatch

This command disables automatic installation for this invocation and prints the underlying mismatch. It is expected to exit with code 1 before executing the script:

```sh
TRACE=pacquet::install=debug pnpm --config.verify-deps-before-run=error run repro
```

```text
`dedupePeers` in the lockfile (true) doesn't match the current config (false)
```

## Why these files are necessary

- `pnpm-workspace.yaml` enables `dedupePeers`. Installation correctly records `true` in the lockfile.
- `.pnpmfile.mjs` adds harmless description metadata through `readPackage`. The installed manifest differs from the manifest on disk, forcing the pre-script content check on each run.
- `optimisticRepeatInstall: false` prevents a later explicit `pnpm install` from taking the optimistic shortcut and refreshing the validation record against the manifest on disk. Without this setting, that shortcut can hide the bug after another install. Disabling it keeps the hook-induced difference present across repeated installs.
- In pnpm 12.15.0, that content check compares against a hardcoded `dedupePeers: false`, causing it to reject the successful installation repeatedly.

The relevant implementation is [the pnpm 12.15.0 pre-run dependency-status checker](https://github.com/pnpm/pnpm/blob/v12.15.0/pnpm/crates/package-manager/src/optimistic_repeat_install/deps_status.rs).

No `packageManager` or `devEngines.packageManager` declaration is included: use the installed pnpm 12.15.0 directly to avoid adding package-manager bootstrap dependencies to this minimal lockfile. Leave the default `verifyDepsBeforeRun` behavior enabled when reproducing the warning.

## Controls

In separate disposable copies, keep `optimisticRepeatInstall: false` and make either change below. Run the full reproduction sequence above, including the second explicit install:

1. Set `dedupePeers: false`, keeping the hook.
2. Remove `.pnpmfile.mjs`, keeping `dedupePeers: true`.

Both controls should run without the repeated-install warning. The combination of the hook and `dedupePeers: true` is what exposes this bug.
