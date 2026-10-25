# PSSP Campus Map Test

This is the map test for Purdue Student Safety Patrol. You click a building, street or landmark on the map and type its name or abbreviation. The test is graded in your browser.

There are two versions:

- **Initial** is for new SPs. It covers every building, street and landmark and takes about 30 minutes.
- **Refresher** is the yearly check. It covers about 40% of the items, picked at random, and takes 10 to 15 minutes. Every required item is always included.

To pass you need at least 80% of the items you were tested on, and every required item (marked with a star) has to be right. Miss a required item and it's a retest no matter what your percentage is.

## For SPs

1. An admin opens the test for you and unlocks it. You won't need the passcode.
2. Pick Initial or Refresher, then enter your name and SP number.
3. Click something on the map. The answer box opens. Type the full name or the abbreviation and submit.
4. Answered items turn blue so you can see what's left. Streets and buildings are different shades.
5. Open spaces like malls and parks are yellow. They count as items too.
6. The word bank lists every name that could be an answer. You can filter it. Use it to check spelling, not to find the answer, since it lists everything and not just what's on your test.
7. Want to change an answer? Click the item and use Clear answer, then answer it again whenever you want.
8. When you're done, click Finish. You can come back and fix things before you confirm.

Spelling doesn't need to be perfect, and common nicknames and abbreviations are accepted. A few places have more than one name, such as Lee-Such Tower, which is also Honors Residence North. Either one counts.

## For admins

**Starting a test.** Open the page, enter the admin passcode, choose the key file and click Unlock. Ticking "Remember the key file" on your own computer saves you picking it every time. Don't do that on a shared computer. Once it's unlocked, hand the screen to the SP.

**After the test.** Do both of these every time:

1. Click Printable report, then Download report, and save the file in the SharePoint Database/Reports folder.
2. Click Save encrypted record, then upload that file to the `database` folder in this repo (Add file, Upload files, Commit).

Results only exist in the open tab. If you close it before saving, they're gone.

**Reviewing and changing a result.** Use Admin review. You'll need the passcode and your own SP number. Every admin SP number is checked, and your name goes on any change you make.

- You can mark a missed item as correct or a correct one as wrong, with a reason. Changes are only pending until you click Approve and save. Revert throws them away.
- To change the overall grade, use the Change grade button next to the grade.
- After approving, click Save encrypted record again and upload it. It has the same file name as the original, so it replaces the old copy.

**Refresher reports** are short on purpose. They show the grade and the items the SP missed. Initial reports show everything.

**Reading saved results.** Open `vault.html`, enter the vault password and choose the key file. You get a list of every saved test. You can open one, download its report, or export everything to a CSV. The records are encrypted, so the files in `database` can't be read on GitHub.

## Things to know

- The key file and passwords are not in this repo and shouldn't be. Don't share them outside the admin group.
- Anyone who has the passcode and the key file can see the answers. Treat them like a password.
- Tests aren't stored in the browser. Save before you close the tab.
