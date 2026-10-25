# PSSP Campus Map Test (GitHub Pages version)

## Two folders in this zip
- **upload-to-github/** goes in your public repository.
- **KEEP-PRIVATE/** never goes on GitHub. It holds `private-data.json` (the building and street names, in plain text) and `vault-setup.html`. Keep it in the SharePoint admin folder.

## How the protection works
Nothing is readable from the public repository.
- The public test page contains only the map shapes. All building and street names, abbreviations, accepted answers, which items are required, and the list of admin SP numbers are in `private.enc.json`, encrypted.
- Two things open it: the admin passcode **and** a secret key file (`pssp-keyfile.txt`). The key file is 32 random bytes and is never put on GitHub. Because of it, a short password like `PSSPAdmin` cannot be guessed from the public files. An outsider would have to guess the key file too, which is not possible.
- Saved results are encrypted with a separate vault password plus the same key file. Only `vault.html` can read them.
- The admin passcode is no longer stored anywhere in the page. It is only the thing that unlocks `private.enc.json`.
- Results are kept in memory only, never in browser storage, so closing the tab clears them.

## One-time setup
1. On your computer, open `KEEP-PRIVATE/vault-setup.html` (double-click).
   - Choose `private-data.json` (same folder).
   - Admin passcode: leave `PSSPAdmin` (or change it).
   - Vault password: choose one. It can be the same as the admin passcode, because the key file is what makes it safe, but a different one is better.
   - Click **Create the files**. Three files download: `pssp-keyfile.txt`, `private.enc.json`, `vault-key.json`.
2. Put `pssp-keyfile.txt` in your private SharePoint admin folder. Do not upload it to GitHub. **If you lose it, the data and saved results cannot be opened.** Keep a second copy.
3. Create a public GitHub repository and upload everything in `upload-to-github/` plus `private.enc.json` and `vault-key.json` (main folder). Do not upload `private-data.json`, `vault-setup.html` or `pssp-keyfile.txt`.
4. Repository Settings, Pages: Source "Deploy from a branch", Branch `main`, folder `/ (root)`.

## Running a test
1. An admin opens the test address (or the SharePoint page that embeds it), enters the admin passcode, chooses `pssp-keyfile.txt` (tick "Remember" on the admin computer to skip this next time), and clicks Unlock.
2. The SP picks Initial or Refresher, enters name and SP number, and takes the test.
3. Afterwards the admin clicks **Printable report**, then **Download report**, and saves it in SharePoint. Then **Save encrypted record**, and uploads that file to the repository's `database` folder (GitHub: Add file, Upload files, Commit).
4. If a grade is changed later, approve it and click **Save encrypted record** again. Same file name, so it replaces the old copy.

## Reading saved results
Open `vault.html`, enter the vault password, choose the key file, and the records load.

## Changing the test data later
If the map or names change, you get a new `private-data.json`. In `vault-setup.html` use the second box ("update the test data only") with your existing key file. It makes a new `private.enc.json` to upload. Saved results stay readable.

## Embedding in SharePoint
Site settings, HTML Field Security, add `yourname.github.io`. Then add an Embed web part with:
`<iframe src="https://yourname.github.io/yourrepo/" width="100%" height="900" style="border:0"></iframe>`

## What is still not protected (honest limits)
- Anyone who has both the passcode and the key file can read the answers and the saved results. Limit who gets the key file and treat it like a password.
- An admin who unlocks the test is, for that session, holding the answer key in the browser. Do not hand an unlocked page to someone to inspect.
- Grading happens in the browser, so there is no server to stop a determined admin-level user from tampering with a test they run.
- If the key file or a password leaks, past files in the repository (including old Git history) stay readable with it. Create a new key and re-encrypt, but old copies remain readable to whoever has the old key.
- The repository shows when files were added and how many. File names are hashes, so names and SP numbers are not visible.
- Admin edits to item names (Admin mode) are saved only in the browser they were made in. To make them permanent, ask for a new `private-data.json`.
