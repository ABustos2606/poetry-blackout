let globalArchive = [];
let currentPage = 1;
const itemsPerPage = 7;

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('archiveContainer');
    
    try {
        const response = await fetch('data/archive.json?v=' + Date.now());
        if (!response.ok) throw new Error('Archive not found');
        
        globalArchive = await response.json();
        
        if (!globalArchive || globalArchive.length === 0) {
            container.innerHTML = '<div class="empty-state">No poems have been archived yet. Check back tomorrow!</div>';
            return;
        }

        document.getElementById('paginationControls').style.display = 'flex';
        setupPagination();
        renderPage(1);

    } catch (e) {
        console.error("Failed to load archive:", e);
        container.innerHTML = '<div class="empty-state">Unable to load the archive right now.<br>The first poem might not be archived yet.</div>';
    }
});

function setupPagination() {
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            renderPage(currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        const maxPage = Math.ceil(globalArchive.length / itemsPerPage);
        if (currentPage < maxPage) {
            renderPage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function renderPage(page) {
    currentPage = page;
    const container = document.getElementById('archiveContainer');
    container.innerHTML = ''; // Clear loading/previous state

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = globalArchive.slice(startIndex, endIndex);

    pageItems.forEach(entry => {
        const dateStr = entry.date || 'Unknown Date';
        const bookTitle = entry.book?.title || 'Unknown Title';
        const author = (entry.book?.authors && entry.book.authors.length > 0) ? entry.book.authors[0].name : 'Unknown Author';
        
        // Reconstruct the poem text from the indices
        const poemWords = entry.indices.map(idx => entry.words[idx]).join(' ');

        const article = document.createElement('article');
        article.className = 'archive-entry';
        
        article.innerHTML = `
            <div class="entry-header">
                <div class="entry-date">${dateStr}</div>
                <div class="entry-book" title="${bookTitle} by ${author}">
                    <em>${bookTitle}</em><br>by ${author}
                </div>
            </div>
            <div class="entry-poem">
                ${poemWords}
            </div>
        `;
        
        container.appendChild(article);
    });

    // Update pagination UI
    const maxPage = Math.ceil(globalArchive.length / itemsPerPage);
    document.getElementById('pageIndicator').innerText = `Page ${currentPage} of ${maxPage}`;
    document.getElementById('prevBtn').disabled = (currentPage === 1);
    document.getElementById('nextBtn').disabled = (currentPage === maxPage);
}
