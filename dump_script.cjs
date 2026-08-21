const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const regex = /<script>([\s\S]*?)<\/script>/g;
let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
    if (count === 1) {
        fs.writeFileSync('script1.js', match[1]);
        console.log("Dumped script1.js");
    }
    count++;
}
