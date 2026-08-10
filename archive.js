document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('archiveContainer');
    
    try {
        const response = await fetch('data/archive.json?v=' + Date.now());
        if (!response.ok) throw new Error('Archive not found');
        
        const archive = await response.json();
        
        if (!archive || archive.length === 0) {
            container.innerHTML = '<div class="empty-state">No poems have been archived yet. Check back tomorrow!</div>';
            return;
        }

        container.innerHTML = ''; // Clear loading state

        archive.forEach(entry => {
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

    } catch (e) {
        console.error("Failed to load archive:", e);
        container.innerHTML = '<div class="empty-state">Unable to load the archive right now.<br>The first poem might not be archived yet.</div>';
    }
});
