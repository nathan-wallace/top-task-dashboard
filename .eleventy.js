export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'styles.css': 'styles.css' });
  eleventyConfig.addPassthroughCopy({ 'reports': 'reports' });

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
