import { app } from "../../scripts/app.js";

// Load CSS dynamically
const cssId = 'animadex-css';
if (!document.getElementById(cssId)) {
    const head = document.getElementsByTagName('head')[0];
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    // Path relative to the ComfyUI web root
    link.href = 'extensions/ComfyUI-Animadex-Node/animadex.css';
    link.media = 'all';
    head.appendChild(link);
}

let currentModal = null;

app.registerExtension({
    name: "ComfyUI.Animadex.Node",
    async nodeCreated(node) {
        if (node.comfyClass !== "AnimadexCharacterNode") return;

        // Find the original combo box
        const charWidget = node.widgets.find(w => w.name === "character");
        if (charWidget) {
            // We can't perfectly hide it in LiteGraph without breaking serialization easily,
            // but we can add a massive visual button to make it obvious.
        }

        // Add a button to open the gallery
        const btnWidget = node.addWidget("button", "Open Gallery 🖼️", "open", () => {
            openAnimadexModal(charWidget, btnWidget, node);
        });
        
        // Init button name if loaded from workflow
        if (charWidget && charWidget.value) {
            const shortName = charWidget.value.split(" (")[0];
            btnWidget.name = "🖼️ " + shortName;
        }

        // Keep the button visually prominent
        node.setSize(node.computeSize());
    }
});

function openAnimadexModal(charWidget, btnWidget, node) {
    if (currentModal) return;

    let currentPage = 1;
    let currentQuery = "";

    const overlay = document.createElement('div');
    overlay.className = 'animadex-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'animadex-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'animadex-modal-header';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'animadex-search-input';
    searchInput.placeholder = 'Search 36000+ characters... (Press Enter)';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'animadex-close-btn';
    closeBtn.innerHTML = '✖';
    closeBtn.onclick = () => close();

    header.appendChild(searchInput);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'animadex-modal-body';
    
    const grid = document.createElement('div');
    grid.className = 'animadex-grid';
    body.appendChild(grid);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'animadex-modal-footer';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'animadex-page-btn';
    prevBtn.innerHTML = '◀ Prev';
    
    const pageInfo = document.createElement('div');
    pageInfo.className = 'animadex-page-info';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'animadex-page-btn';
    nextBtn.innerHTML = 'Next ▶';

    footer.appendChild(prevBtn);
    footer.appendChild(pageInfo);
    footer.appendChild(nextBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    currentModal = overlay;

    // Actions
    const close = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        currentModal = null;
    };

    // Close on background click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const loadData = async () => {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 50px; font-size: 18px;">Loading characters...</div>';
        try {
            const resp = await fetch(`/animadex/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}`);
            const data = await resp.json();
            
            grid.innerHTML = '';
            data.results.forEach(char => {
                const card = document.createElement('div');
                card.className = 'animadex-card';
                
                const imgUrl = char.thumb_url || char.img_url;
                const img = document.createElement('img');
                img.className = 'animadex-card-img';
                img.src = imgUrl;
                // Fallback placeholder
                img.onerror = () => { img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%2345475a"/></svg>'; };
                
                const title = document.createElement('div');
                title.className = 'animadex-card-title';
                title.textContent = char.name;
                title.title = char._display_name;

                card.appendChild(img);
                card.appendChild(title);

                card.onclick = () => {
                    if (charWidget) {
                        charWidget.value = char._display_name;
                        btnWidget.name = "🖼️ " + char.name;
                        
                        // Force update canvas
                        if (app.graph) {
                            app.graph.setDirtyCanvas(true);
                        }
                    }
                    close();
                };

                grid.appendChild(card);
            });

            pageInfo.textContent = `Page ${data.page} of ${data.pages} (${data.total} total)`;
            prevBtn.disabled = data.page <= 1;
            nextBtn.disabled = data.page >= data.pages;
        } catch (e) {
            console.error("Animadex fetch error:", e);
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#f38ba8;">Error loading data. Is the backend running?</div>`;
        }
    };

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            currentQuery = searchInput.value.trim();
            currentPage = 1;
            loadData();
        }
    });

    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadData();
        }
    };

    nextBtn.onclick = () => {
        currentPage++;
        loadData();
    };

    // Initial load
    setTimeout(() => {
        searchInput.focus();
        loadData();
    }, 100);
}
