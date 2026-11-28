// Packs the production build (dist/) into ONE self-contained HTML page:
// CSS and JS inlined, no external requests. Used for the hosted demo link.
// Usage: npm run build && node scripts/single-file.mjs <output.html>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const out = process.argv[2] ?? 'dist/left-single.html';
const assets = readdirSync('dist/assets');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
if (assets.filter((f) => f.endsWith('.js')).length !== 1) throw new Error('expected one JS bundle');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const html = `<title>LEFT Payday Planner</title>
<meta name="description" content="What you can spend before payday. Plans stay on this device.">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
