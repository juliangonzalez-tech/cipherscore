# Third-party notices

CipherScore's own code is licensed under the [MIT License](./LICENSE). The material below was written by others and is **not** covered by that license; it keeps its own terms.

## EFF Large Wordlist for Passphrases

- **File:** `lib/wordlists/eff-large.ts`
- **Copyright:** Electronic Frontier Foundation
- **License:** [Creative Commons Attribution 3.0 United States (CC BY 3.0 US)](https://creativecommons.org/licenses/by/3.0/us/)
- **Source:** <https://www.eff.org/dice> (<https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt>)
- **Changes:** the dice numbers were removed and the 7,776 words are stored in their original order. No word was added, removed or edited.

Anyone reusing this file must keep this attribution and indicate any changes they make, as CC BY 3.0 US requires. The app footer and the README credit the EFF as well.

## Other credits

- **zxcvbn-ts** (`@zxcvbn-ts/core`, `@zxcvbn-ts/language-common`, `@zxcvbn-ts/language-en`) is used as a dependency under the MIT License.
- **Have I Been Pwned: Pwned Passwords**, by Troy Hunt, is used through its public range API. No data from it is included in this repository.
- The other runtime and development dependencies (Next.js, React, Tailwind CSS, Vitest and others) are installed from npm under their own licenses and are not redistributed here.
