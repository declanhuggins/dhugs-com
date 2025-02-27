const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const linksFilePath = path.join(__dirname, '../links/links.md');
const redirectsFilePath = path.join(__dirname, '../_redirects');

const fileContent = fs.readFileSync(linksFilePath, 'utf8');
const { data } = matter(fileContent);

const redirects = Object.entries(data).map(([key, url]) => {
  const cleanedUrl = url.replace(/^“|”$/g, ''); // Remove surrounding quotes
  return `/${key}/ ${cleanedUrl} 302`;
}).join('\n');

fs.writeFileSync(redirectsFilePath, redirects);

console.log('Redirects file generated successfully.');
