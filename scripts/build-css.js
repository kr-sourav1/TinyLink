const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'src', 'input.css');
const output = path.join(root, 'public', 'tailwind.css');

async function build() {
  try {
    const css = fs.readFileSync(input, 'utf8');
    const result = await postcss([tailwind(root), autoprefixer]).process(css, {
      from: input,
      to: output,
      map: false,
    });

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, result.css, 'utf8');
    console.log('Built', output);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

build();
