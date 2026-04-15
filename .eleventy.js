export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ reports: 'reports' });
  eleventyConfig.addPassthroughCopy({ 'prompt.html': 'prompt.html' });
  eleventyConfig.addPassthroughCopy({ 'styles.css': 'styles.css' });

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      output: '_site'
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk'
  };
}
