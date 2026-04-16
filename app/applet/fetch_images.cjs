import https from 'https';

https.get('https://mywillows.com/collections/all', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const regex = /src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g;
    let match;
    const urls = new Set();
    while ((match = regex.exec(data)) !== null) {
      if (match[1].includes('cdn.shopify.com')) {
        let url = match[1];
        if (url.startsWith('//')) {
            url = 'https:' + url;
        }
        urls.add(url);
      }
    }
    console.log(Array.from(urls).slice(0, 15).join('\n'));
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
