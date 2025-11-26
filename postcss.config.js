module.exports = {
  // Use an array form so we can require plugin factory functions directly.
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
};
