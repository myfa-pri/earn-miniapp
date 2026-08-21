const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('script1.js', 'utf8');
try {
    new vm.Script(code);
    console.log("Syntax OK");
} catch(e) {
    const lines = code.split('\n');
    console.log(e.toString());
    const match = e.stack.match(/evalmachine\.<anonymous>:(\d+)/);
    if(match) {
        const line = parseInt(match[1]);
        console.log("\nContext:");
        for(let i=Math.max(0, line-5); i<Math.min(lines.length, line+5); i++) {
            console.log(`${i+1}: ${lines[i]}`);
        }
    }
}
