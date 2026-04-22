import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replacements avoiding the URLs
content = content.replace(/Willows Tunisia/g, 'Lunaria');
content = content.replace(/Willows/g, 'Lunaria');

// Fix URLs that got broken if any
content = content.replace(/myLunaria\.com/g, 'mywillows.com');
content = content.replace(/Lunaria_10\.20/g, 'Willows_10.20');
content = content.replace(/lunaria_figgy/g, 'willows_figgy');

fs.writeFileSync('src/App.tsx', content);
