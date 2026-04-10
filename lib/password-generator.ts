const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/|";

const WORD_BANK = [
  "anchor",
  "harbor",
  "violet",
  "ember",
  "signal",
  "forest",
  "silver",
  "summit",
  "planet",
  "cinder",
  "lumen",
  "orbit",
  "meadow",
  "cipher",
  "marble",
  "delta",
  "raven",
  "aurora",
  "spruce",
  "north"
];

function randomInt(max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function generatePassword(options: {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}) {
  const pools = [
    options.lowercase ? LOWERCASE : "",
    options.uppercase ? UPPERCASE : "",
    options.numbers ? NUMBERS : "",
    options.symbols ? SYMBOLS : ""
  ].filter(Boolean);

  if (!pools.length) {
    return "";
  }

  let combined = pools.join("");
  if (!options.excludeAmbiguous) {
    combined += "O0Il1";
  }

  const chars = [
    ...pools.map((pool) => pool[randomInt(pool.length)])
  ];

  while (chars.length < options.length) {
    chars.push(combined[randomInt(combined.length)]);
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars.join("").slice(0, options.length);
}

export function generatePassphrase(words: number, separator: "-" | "." = "-") {
  const picked = Array.from({ length: words }, () => WORD_BANK[randomInt(WORD_BANK.length)]);
  const number = String(randomInt(90) + 10);
  return [...picked, number].join(separator);
}
