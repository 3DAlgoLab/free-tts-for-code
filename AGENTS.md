# For Agent

Check `TODO.md` to know what you should do.

## `references` folder

- `Piper_TTS`: Previous codebase to look up to implement this project


## Release Process

When releasing a new version:

1. Increase the last digit of `version` in `package.json`
2. Update `README.md` with changed/new features
3. `npx vsce package` to build the `.vsix`
4. `git add . && git commit -m "feat: vX.Y.Z - short summary" && git push`
5. Publish to marketplace: `npx vsce login 3dalgolab-8201` → `npx vsce publish`

