# How to release the VS Code extension

Everything for the extension is in `vscode/`. The first version is **0.1.0**.

## One time: publisher ID and login

1. Go to https://marketplace.visualstudio.com/manage and click on your publisher. The ID is the
   last part of the address (`.../manage/publishers/<id>`), you can also see it in the Details tab.
   The ID has no spaces. "Mohammad Hossein Heydarchi" is the display name, not the ID.
2. Make a personal access token in https://dev.azure.com: User settings, Personal access tokens.
   Organization: "All accessible organizations", scope: Marketplace > Manage.
3. Login. vsce keeps the token on your machine, it never goes into the repo.
   ```sh
   cd vscode && npx vsce login <id>
   ```

## For each release

`main` is protected, so the version change goes through a branch and a pull request.

```sh
git switch -c release/vscode-<version>
# change "version" in vscode/package.json and add "## <version> (<date>)" to vscode/CHANGELOG.md
npm test && npm run lint && npm run test:visual && npm run test:vscode
git commit -am "Release VS Code extension <version>"
git push origin release/vscode-<version>      # open a pull request and merge it
```

After the merge, on `main`:

```sh
npm run vscode:publish -- --publisher <id>    # checks, makes vscode/archi3d-<version>.vsix and publishes it
git tag vscode-v<version> && git push origin vscode-v<version>
gh release create vscode-v<version> vscode/archi3d-<version>.vsix --title "Archi3D for VS Code <version>" --notes-file vscode/CHANGELOG.md
```

`npm run vscode:publish` stops if the publisher is still the placeholder, if the changelog has no
entry for the version, or if the icon, license, notices or README images are missing. The checks
are in `scripts/release-checks.mjs`.

After a few minutes the extension is on
`https://marketplace.visualstudio.com/items?itemName=<id>.archi3d`. You can also upload the `.vsix`
by hand on the manage page (New extension > Visual Studio Code) if you don't want to use a token.
