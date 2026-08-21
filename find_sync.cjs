const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
if (scriptMatch && scriptMatch.length > 2) {
    const code = scriptMatch[2].replace(/<\/?script>/g, '');
    const acorn = require('acorn');
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
    ast.body.forEach(node => {
        console.log(node.type, node.loc.start.line);
    });
}
