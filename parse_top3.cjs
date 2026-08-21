const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const code = html.split('<script>')[2].split('</script>')[0];
const acorn = require('acorn');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
ast.body.forEach(node => {
    if (node.loc.start.line < (2246 - 216)) {
        if (node.type !== 'FunctionDeclaration') {
            const snippet = code.substring(node.start, node.end);
            console.log(`Line ${node.loc.start.line + 216}: ${node.type} -> ${snippet.substring(0, 100).replace(/\n/g, ' ')}...`);
        }
    }
});
