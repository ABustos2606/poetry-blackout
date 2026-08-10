(function () {
    'use strict';

    // ---------- DOM refs ----------
    var pageStage = document.getElementById('pageStage');
    var bookPage = document.getElementById('bookPage');
    var wordGrid = document.getElementById('wordGrid');
    var sourceTitle = document.getElementById('sourceTitle');
    var sourceAuthor = document.getElementById('sourceAuthor');
    var caseNo = document.getElementById('caseNo');
    var poemExtract = document.getElementById('poemExtract');
    var poemTextEl = document.getElementById('poemText');
    var copyBtn = document.getElementById('copyBtn');

    var stampTimer = null;

    // ---------- Rendering ----------

    function renderPage(words, indices, book, cropStart) {
        var idxSet = {};
        indices.forEach(function (i) { idxSet[i] = true; });

        sourceTitle.textContent = book.title || 'Untitled';
        sourceAuthor.textContent = (book.authors || []).map(function (a) { return a.name; }).join(', ') || 'Unknown author';
        caseNo.textContent = 'Case No. ' + book.id + '–' + cropStart;

        wordGrid.innerHTML = '';
        var frag = document.createDocumentFragment();
        words.forEach(function (w, i) {
            var span = document.createElement('span');
            var isKept = !!idxSet[i];
            span.className = isKept ? 'word kept' : 'word redact';
            span.textContent = w;
            var delay = Math.min(i * 5, 700) + Math.round(Math.random() * 60);
            span.style.setProperty('--d', delay + 'ms');
            if (!isKept) {
                span.style.setProperty('--r', (Math.random() * 1.2 - 0.6).toFixed(2) + 'deg');
            }
            frag.appendChild(span);
            frag.appendChild(document.createTextNode(' '));
        });
        wordGrid.appendChild(frag);

        var poemWords = indices.map(function (i) { return words[i]; });
        poemTextEl.textContent = poemWords.join(' ');

        pageStage.hidden = false;
        poemExtract.hidden = false;

        bookPage.classList.remove('revealed', 'stamped');
        void bookPage.offsetWidth;
        requestAnimationFrame(function () { bookPage.classList.add('revealed'); });

        var totalDelay = Math.min(words.length * 5, 700) + 250;
        clearTimeout(stampTimer);
        stampTimer = setTimeout(function () { bookPage.classList.add('stamped'); }, totalDelay + 350);
    }

    async function copyPoem() {
        var text = poemTextEl.textContent;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
            document.body.removeChild(ta);
        }
        var original = copyBtn.textContent;
        copyBtn.textContent = '⧉ copied!';
        setTimeout(function () { copyBtn.textContent = original; }, 1500);
    }

    // ---------- Initialization ----------

    async function loadDailyPoem() {
        try {
            var res = await fetch('data/daily_poem.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var data = await res.json();
            
            renderPage(data.words, data.indices, data.book, data.cropStart);
        } catch (err) {
            console.error('Failed to load daily poem:', err);
            poemTextEl.textContent = "The daily poem could not be loaded.";
            poemExtract.hidden = false;
        }
    }

    copyBtn.addEventListener('click', copyPoem);
    
    // Automatically load when the page is ready
    document.addEventListener('DOMContentLoaded', loadDailyPoem);

})();
