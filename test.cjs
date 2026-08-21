const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const code = html.split('<script>')[2].split('</script>')[0];
console.log(code.substring(0, 1500));
