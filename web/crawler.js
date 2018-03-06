const SitemapGenerator = require('sitemap-generator');
const path = require('path');

// create generator
const generator = SitemapGenerator('https://flick.tips', {
  stripQuerystring: false,
  filepath: path.join(process.cwd(), '/sitemaps/sitemap.xml')
});

// register event listeners
generator.on('done', () => {
  // sitemaps created
});

// start the crawler
generator.start();