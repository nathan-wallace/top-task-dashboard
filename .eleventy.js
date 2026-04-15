export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'styles.css': 'styles.css' });
  eleventyConfig.addPassthroughCopy({ 'app.js': 'app.js' });
  eleventyConfig.addPassthroughCopy({ 'reports': 'reports' });
  eleventyConfig.addPassthroughCopy({ 'prompt.html': 'prompt.html' });

  return {
    dir: {
      input: 'src/pages',
      includes: '../_includes',
      output: '_site'
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk'
  };
}
