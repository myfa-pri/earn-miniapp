const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const code = html.split('<script>')[2].split('</script>')[0];
const acorn = require('acorn');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
ast.body.forEach(node => {
    if (node.type === 'ExpressionStatement' || node.type === 'VariableDeclaration') {
        const snippet = code.substring(node.start, node.end);
        if (!snippet.startsWith('window.onerror') && !snippet.startsWith('window.addEventListener') && !snippet.startsWith('let errCount')) {
            console.log(`Line ${node.loc.start.line}: ${snippet.substring(0, 100)}...`);
        }
    }
});
