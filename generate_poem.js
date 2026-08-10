const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL = 'gemini-3.5-flash';
const CROP_SIZE = 250;
const POEM_MIN_LENGTH = 7;
const POEM_MAX_LENGTH = 25;

const GEMINI_SCHEMA = {
    type: 'object',
    properties: {
        indices: { type: 'array', items: { type: 'integer' } }
    },
    required: ['indices']
};

const START_RE = /\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i;
const END_RE = /\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i;

async function fetchJson(url) {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    const routes = [
        { label: 'direct', build: u => u },
        { label: 'corsproxy.io', build: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u) },
        { label: 'codetabs', build: u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u) },
        { label: 'allorigins', build: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) }
    ];

    let lastErr = null;
    for (let i = 0; i < routes.length; i++) {
        try {
            const res = await fetch(routes[i].build(url), { headers });
            if (res.ok) return await res.json();
            throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr;
}

function getPlainTextUrl(formats) {
    if (!formats) return null;
    const keys = Object.keys(formats);
    for (let i = 0; i < keys.length; i++) {
        const mime = keys[i].toLowerCase();
        const url = formats[keys[i]];
        if (mime.indexOf('text/plain') === 0 && !/\.zip($|\?)/i.test(url)) return url;
    }
    return null;
}

async function pickRandomBook() {
    const params = new URLSearchParams({
        languages: 'en',
        mime_type: 'text/plain',
        copyright: 'false',
        sort: 'ascending',
        topic: 'literature,arts,religion'
    });
    const base = 'https://gutendex.com/books?' + params.toString();
    const first = await fetchJson(base);
    const perPage = (first.results || []).length || 32;
    const total = first.count || perPage;
    const maxPage = Math.max(1, Math.ceil(total / 32));

    for (let attempt = 0; attempt < 8; attempt++) {
        let data = first;
        if (attempt > 0) {
            const page = 1 + Math.floor(Math.random() * maxPage);
            data = await fetchJson(base + '&page=' + page);
        }
        const candidates = (data.results || []).filter(b => !!getPlainTextUrl(b.formats));
        if (candidates.length) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
    }
    throw new Error('could not find a book with a plain-text file');
}

async function fetchTextSmart(url) {
    const routes = [
        { label: 'direct', build: u => u },
        { label: 'a reader proxy', build: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) },
        { label: 'a second reader proxy', build: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u) }
    ];
    let lastErr = null;
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        try {
            console.log(`Trying to fetch text via ${route.label}...`);
            const res = await fetch(route.build(url));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const text = await res.text();
            if (text && text.length > 2000) return text;
            throw new Error('response too short');
        } catch (e) {
            lastErr = e;
            console.log(`Route ${route.label} failed: ${e.message}`);
        }
    }
    throw lastErr || new Error('all routes failed');
}

function extractBody(raw) {
    let text = raw;
    const startMatch = START_RE.exec(text);
    if (startMatch) text = text.slice(startMatch.index + startMatch[0].length);
    const endMatch = END_RE.exec(text);
    if (endMatch) text = text.slice(0, endMatch.index);
    return text;
}

function tokenize(text) {
    return text.split(/\s+/).filter(w => w && /[A-Za-z0-9]/.test(w));
}

function cropRandom(words) {
    const margin = Math.floor(words.length * 0.03) + 20;
    const lo = margin;
    const hi = words.length - CROP_SIZE - margin;
    let start;
    if (hi <= lo) {
        start = Math.floor(Math.random() * Math.max(1, words.length - CROP_SIZE));
    } else {
        start = lo + Math.floor(Math.random() * (hi - lo));
    }
    return { start: start, slice: words.slice(start, start + CROP_SIZE) };
}

async function askGeminiForIndices(words, apiKey, model) {
    const prompt = [
        `You are a blackout poet. Below are ${CROP_SIZE} words (indices 0-${CROP_SIZE - 1}), copied verbatim and in order from a random page of a public-domain book.`,
        '',
        JSON.stringify(words),
        '',
        `Pick between ${POEM_MIN_LENGTH} and ${POEM_MAX_LENGTH} of these indices. Read strictly in ascending order, the chosen words must read as a short, striking poem: evocative, a little strange, emotionally alive. Do not reorder, edit, combine, or invent words — choose only from the list above. Prefer concrete, charged words over articles and prepositions, but a small connector is fine if a line needs it to breathe.`,
        '',
        'Respond with JSON only, matching the schema.'
    ].join('\n');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 1,
                responseMimeType: 'application/json',
                responseSchema: GEMINI_SCHEMA
            }
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error((data.error && data.error.message) || `HTTP ${res.status}`);
    }

    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
    if (!text) {
        const reason = candidate && candidate.finishReason;
        throw new Error(reason ? `Gemini stopped early (${reason})` : 'Gemini returned no text');
    }

    const parsed = JSON.parse(text);
    let idxs = Array.isArray(parsed.indices) ? parsed.indices : [];
    idxs = idxs.filter((n, i) => Number.isInteger(n) && n >= 0 && n < words.length && idxs.indexOf(n) === i).sort((a, b) => a - b);

    if (idxs.length > 12) idxs = idxs.slice(0, 12);
    if (idxs.length < 3) throw new Error('the redactor picked too few usable words');

    return idxs;
}

async function generateDailyPoem() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    let book = null, words = null, cropStart = 0, found = false;

    console.log("Searching Gutenberg catalog...");
    for (let bookTry = 0; bookTry < 5 && !found; bookTry++) {
        try {
            book = await pickRandomBook();
            console.log(`Found "${book.title}"`);

            const raw = await fetchTextSmart(getPlainTextUrl(book.formats));
            const body = extractBody(raw);
            const allWords = tokenize(body);

            if (allWords.length < CROP_SIZE + 20) {
                console.log('File too short, trying another...');
                continue;
            }

            const cropped = cropRandom(allWords);
            words = cropped.slice;
            cropStart = cropped.start;
            found = true;
            console.log(`Cropped ${CROP_SIZE} words starting at ${cropStart}.`);
        } catch (e) {
            console.log(`Attempt ${bookTry + 1} failed: ${e.message}`);
        }
    }

    if (!found) {
        console.error("Could not fetch a usable book.");
        process.exit(1);
    }

    console.log("Asking Gemini for poem indices...");
    let indices = null;
    for (let g = 0; g < 3 && !indices; g++) {
        try {
            indices = await askGeminiForIndices(words, apiKey, model);
            console.log(`Got ${indices.length} indices from Gemini.`);
        } catch (e) {
            console.log(`Gemini attempt ${g + 1} failed: ${e.message}`);
        }
    }

    if (!indices) {
        console.error("Gemini failed to return valid indices.");
        process.exit(1);
    }

    const outputData = {
        words,
        indices,
        book: {
            id: book.id,
            title: book.title,
            authors: book.authors
        },
        cropStart
    };

    const outPath = path.join(__dirname, 'data', 'daily_poem.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`Successfully saved daily poem to ${outPath}`);
}

generateDailyPoem().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
