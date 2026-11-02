import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = new URL(process.env.SITE_URL);
if (base.protocol !== 'https:') throw new Error('Expected an HTTPS deployment URL');
const digest = text => createHash('sha256').update(text).digest('hex');
const files = ['index.html', 'styles.css', 'app.js', 'cloth-pro.png', 'board-approved.png', 'window-cleaning.png'];
const expected = new Map(await Promise.all(files.map(async file => [file, digest(await readFile(file))])));

for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    for (const file of files) {
      const url = new URL(file === 'index.html' ? './' : file, base);
      url.searchParams.set('release', process.env.GITHUB_SHA);
      url.searchParams.set('attempt', attempt);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (digest(body) !== expected.get(file)) throw new Error(`${file}: published content differs from this release`);
      if (file === 'index.html' && (!body.toString('utf8').includes('id="hero-title"') || !body.toString('utf8').includes('Тряпка Pro.'))) {
        throw new Error('Expected the course landing page');
      }
    }
    console.log(`Verified live landing page, CSS, JavaScript and product illustration: ${base.href}`);
    process.exit(0);
  } catch (error) {
    console.log(`Verification ${attempt}/12: ${error.message}`);
    if (attempt === 12) throw error;
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
