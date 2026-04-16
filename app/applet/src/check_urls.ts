import https from 'https';

const urls = [
  'https://mywillows.com/cdn/shop/products/ROSEQUARTZ_1024x1024.jpg',
  'https://mywillows.com/cdn/shop/products/AMETHYST_1024x1024.jpg',
  'https://mywillows.com/cdn/shop/products/CITRINE_1024x1024.jpg',
  'https://mywillows.com/cdn/shop/products/MOONSTONE_1024x1024.jpg',
  'https://mywillows.com/cdn/shop/products/EMERALD_1024x1024.jpg',
  'https://mywillows.com/cdn/shop/products/CLEARQUARTZ_1024x1024.jpg'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(url + " -> " + res.statusCode);
  }).on('error', (e) => {
    console.error(url + " -> Error: " + e.message);
  });
});
