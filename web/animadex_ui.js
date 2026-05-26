import { app } from "../../scripts/app.js";

// Load CSS dynamically
const cssId = 'animadex-css';
if (!document.getElementById(cssId)) {
    const head = document.getElementsByTagName('head')[0];
    const link = document.createElement('link');
    link.id = cssId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'extensions/ComfyUI-Animadex-Node/animadex.css';
    link.media = 'all';
    head.appendChild(link);
}

let currentModal = null;

app.registerExtension({
    name: "ComfyUI.Animadex.Node",
    async nodeCreated(node) {
        if (node.comfyClass !== "AnimadexCharacterNode") return;

        const charWidget = node.widgets.find(w => w.name === "character");
        const btnWidget = node.addWidget("button", "Open Gallery 🖼️", "open", () => {
            openAnimadexModal(charWidget, btnWidget, node);
        });
        
        if (charWidget && charWidget.value) {
            const shortName = charWidget.value.split(" (")[0];
            btnWidget.name = "🖼️ " + shortName;
        }

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

    // ==========================================
    // Sidebar
    // ==========================================
    const sidebar = document.createElement('div');
    sidebar.className = 'animadex-sidebar';
    
    const sidebarTitle = document.createElement('div');
    sidebarTitle.className = 'animadex-sidebar-title';
    sidebarTitle.textContent = 'Filters';
    
    const filterSection = document.createElement('div');
    filterSection.className = 'animadex-filter-section';
    
    const filterHeader = document.createElement('div');
    filterHeader.className = 'animadex-filter-header';
    filterHeader.textContent = 'Character';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'animadex-search-input';
    searchInput.placeholder = 'Type to search...';
    
    filterSection.appendChild(filterHeader);
    filterSection.appendChild(searchInput);
    
    const sidebarList = document.createElement('div');
    sidebarList.className = 'animadex-sidebar-list';
    sidebarList.innerHTML = `
        <div style="margin-bottom:10px; color:#f38ba8; font-size:11px;">Search applies to all filters</div>
        <div style="border-top:1px solid #313244; margin:10px 0;"></div>
        <div class="animadex-filter-header" style="margin-top:15px; color:#a6adc8;">Copyright</div>
        <div class="animadex-filter-header" style="margin-top:15px; color:#a6adc8;">Hair Color</div>
        <div class="animadex-filter-header" style="margin-top:15px; color:#a6adc8;">Hair Length</div>
        <div class="animadex-filter-header" style="margin-top:15px; color:#a6adc8;">Eye Color</div>
        <div class="animadex-filter-header" style="margin-top:15px; color:#a6adc8;">Gender</div>
    `;

    sidebar.appendChild(sidebarTitle);
    sidebar.appendChild(filterSection);
    sidebar.appendChild(sidebarList);

    // ==========================================
    // Main Area
    // ==========================================
    const main = document.createElement('div');
    main.className = 'animadex-main';

    const header = document.createElement('div');
    header.className = 'animadex-main-header';
    
    const infoText = document.createElement('span');
    infoText.innerHTML = 'Loading...';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'animadex-close-btn';
    closeBtn.innerHTML = '✖';
    closeBtn.onclick = () => close();

    header.appendChild(infoText);
    header.appendChild(closeBtn);

    const gridContainer = document.createElement('div');
    gridContainer.className = 'animadex-grid-container';
    
    const grid = document.createElement('div');
    grid.className = 'animadex-grid';
    gridContainer.appendChild(grid);

    // Footer Pagination
    const footer = document.createElement('div');
    footer.className = 'animadex-pagination';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'animadex-page-btn';
    prevBtn.innerHTML = '◀ Prev';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'animadex-page-btn';
    nextBtn.innerHTML = 'Next ▶';

    footer.appendChild(prevBtn);
    footer.appendChild(nextBtn);

    main.appendChild(header);
    main.appendChild(gridContainer);
    main.appendChild(footer);

    modal.appendChild(sidebar);
    modal.appendChild(main);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    currentModal = overlay;

    // Actions
    const close = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        currentModal = null;
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    
    const formatNumber = (num) => {
        if (!num) return "0";
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    };

    const loadData = async () => {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 50px; font-size: 16px; color: #a6adc8;">Loading characters...</div>';
        try {
            const resp = await fetch(`/animadex/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}`);
            const data = await resp.json();
            
            grid.innerHTML = '';
            infoText.innerHTML = `<b>${data.total.toLocaleString()}</b> characters - page ${data.page} of ${data.pages}`;
            
            data.results.forEach(char => {
                const card = document.createElement('div');
                card.className = 'animadex-card';
                
                const imgContainer = document.createElement('div');
                imgContainer.className = 'animadex-card-img-container';
                const imgUrl = char.thumb_url || char.img_url;
                const img = document.createElement('img');
                img.className = 'animadex-card-img';
                img.src = imgUrl;
                img.onerror = () => { img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23dce0e8"/></svg>'; };
                imgContainer.appendChild(img);
                
                const info = document.createElement('div');
                info.className = 'animadex-card-info';
                
                const title = document.createElement('div');
                title.className = 'animadex-card-title';
                title.textContent = char.name;
                title.title = char.name;
                
                const subtitle = document.createElement('div');
                subtitle.className = 'animadex-card-subtitle';
                subtitle.textContent = char.copyright_name || char.copyright || 'UNKNOWN';
                
                info.appendChild(title);
                info.appendChild(subtitle);
                
                const cFooter = document.createElement('div');
                cFooter.className = 'animadex-card-footer';
                
                const fLeft = document.createElement('div');
                fLeft.className = 'animadex-card-footer-left';
                const up = char.rating ? char.rating.up : 0;
                const down = char.rating ? char.rating.down : 0;
                fLeft.innerHTML = `
                    <div class="animadex-card-footer-item">👍 ${formatNumber(up)}</div>
                    <div class="animadex-card-footer-item">👎 ${formatNumber(down)}</div>
                `;
                
                const fRight = document.createElement('div');
                fRight.className = 'animadex-card-footer-right';
                const count = char.count || 0;
                const favs = char.fav_count || 0;
                fRight.innerHTML = `
                    <div class="animadex-card-footer-item">▲ ${count.toLocaleString()}</div>
                    <div class="animadex-card-footer-item">♥ ${formatNumber(favs)}</div>
                `;
                
                cFooter.appendChild(fLeft);
                cFooter.appendChild(fRight);

                card.appendChild(imgContainer);
                card.appendChild(info);
                card.appendChild(cFooter);

                card.onclick = () => {
                    if (charWidget) {
                        charWidget.value = char._display_name;
                        btnWidget.name = "🖼️ " + char.name;
                        if (app.graph) app.graph.setDirtyCanvas(true);
                    }
                    close();
                };

                grid.appendChild(card);
            });

            prevBtn.disabled = data.page <= 1;
            nextBtn.disabled = data.page >= data.pages;
        } catch (e) {
            console.error("Animadex fetch error:", e);
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#f38ba8;">Error loading data. Is the backend running?</div>`;
        }
    };

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentQuery = searchInput.value.trim();
            currentPage = 1;
            loadData();
        }, 400);
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

    setTimeout(() => {
        searchInput.focus();
        loadData();
    }, 100);
}
