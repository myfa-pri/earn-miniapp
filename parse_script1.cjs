const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const code = html.split('<script>')[2].split('</script>')[0];
const acorn = require('acorn');
try {
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
    ast.body.forEach(node => {
        if (node.type !== 'FunctionDeclaration' && node.type !== 'VariableDeclaration' && node.type !== 'ExpressionStatement') {
            console.log(node.type, node.loc.start.line);
        }
    });
    console.log("Parse successful");
} catch(e) {
    console.error(e);
}
