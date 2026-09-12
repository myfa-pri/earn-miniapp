// If we add dbQuery function
`
async function dbQuery(path, orderBy, equalTo) {
    try {
        const url = \`\${firebaseConfig.databaseURL}/\${path}.json?orderBy="\${orderBy}"&equalTo="\${equalTo}"\`;
        const options = { method: 'GET', headers: { "Content-Type": "application/json" } };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        options.signal = controller.signal;

        const response = await fetch(url, options);
        clearTimeout(timeout);

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(\`[DB Error] GET Query on \${path}:\`, error.message);
        return null;
    }
}
`
// and then use it:
`
app.get('/api/campaigns/:userId', async (req, res) => {
    const { userId } = req.params;
    const campaigns = await dbQuery('campaigns', 'userId', userId) || {};
    res.json(campaigns);
});
`
