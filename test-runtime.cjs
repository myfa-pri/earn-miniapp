const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const code = html.split('<script>')[2].split('</script>')[0];

const vm = require('vm');
const context = {
    window: {
        onerror: null,
        addEventListener: () => {},
        location: { search: '' },
        renderedPages: {}
    },
    document: {
        addEventListener: () => {},
        getElementById: () => null,
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    console: console
};
vm.createContext(context);
try {
    vm.runInContext(code, context);
    console.log("Runtime OK");
} catch(e) {
    console.error("Runtime Error:", e);
}
