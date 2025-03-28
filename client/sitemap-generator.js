// scripts/sitemap-generator.js
const fs = require('fs');
const paths = [
  { url: '/', priority: 1.0 },
  { url: '/who-we-are', priority: 0.8 },
  { url: '/services', priority: 0.9 },
  { url: '/contact-us', priority: 0.7 },
  { url: '/login', priority: 0.5 },
  { url: '/signup', priority: 0.5 }
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(path => `
  <url>
    <loc>https://www.welzyne.com${path.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path.priority}</priority>
  </url>
`).join('')}
</urlset>`;

fs.writeFileSync('./public/sitemap.xml', sitemap);
console.log('Sitemap generated!');