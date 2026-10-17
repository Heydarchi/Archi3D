# Releasing the VS Code extension

The extension's version, changelog and checks live in `vscode/`. Base version: **0.1.0**.

## Once: find your publisher ID and log in

1. Open https://marketplace.visualstudio.com/manage and select your publisher. The **ID** is the
   short name in the address (`…/manage/publishers/<id>`) and on the *Details* tab. It has no
   spaces — "Mohammad Hossein Heydarchi" is the *display name*, shown on the Marketplace page.
2. Create a personal access token at https://dev.azure.com → *User settings → Personal access
   tokens*: Organization **All accessible organizations**, scope **Marketplace → Manage**.
3. Log in (the token is stored by vsce on your machine, never in the repository):
   ```sh
   cd vscode && npx vsce login <id>
   ```

## Every release

```sh
git switch -c release/vscode-<version>
# 1. bump "version" in vscode/package.json and add "## <version> — <date>" to vscode/CHANGELOG.md
npm test && npm run lint && npm run test:visual && npm run test:vscode
npm run vscode:publish -- --publisher <id>    # checks, packages vscode/archi3d-<version>.vsix, publishes
git commit -am "Release VS Code extension <version>"   # then merge into main as usual
git tag vscode-v<version> && git push origin main vscode-v<version>
gh release create vscode-v<version> vscode/archi3d-<version>.vsix --title "Archi3D for VS Code <version>" --notes-file vscode/CHANGELOG.md
```

`npm run vscode:publish` refuses to publish while the publisher is the placeholder, the version has
no changelog entry, or the icon, licence, notices or README images are missing
(`scripts/release-checks.mjs`).

The extension appears at `https://marketplace.visualstudio.com/items?itemName=<id>.archi3d`
within a few minutes. Without a token you can also upload the `.vsix` by hand on the manage page
(*New extension → Visual Studio Code*).
