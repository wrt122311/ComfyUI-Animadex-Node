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
let metadataCache = null;
const FAV_STORAGE_KEY = 'animadex_favorites';

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

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAV_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function toggleFavorite(id, isFav) {
    let favs = getFavorites();
    if (isFav && !favs.includes(id)) {
        favs.push(id);
    } else if (!isFav) {
        favs = favs.filter(f => f !== id);
    }
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
}

function openAnimadexModal(charWidget, btnWidget, node) {
    if (currentModal) return;

    let currentPage = 1;
    let currentQuery = "";
    let currentCopyright = "";
    let favOnly = false;
    let isRandom = false;

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
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'animadex-search-input';
    searchInput.placeholder = 'Type to search...';
    
    filterSection.appendChild(searchInput);
    
    const sidebarLists = document.createElement('div');
    sidebarLists.className = 'animadex-sidebar-lists';

    // Accordions
    const createAccordion = (title, itemsContainer) => {
        const wrap = document.createElement('div');
        wrap.className = 'animadex-accordion';
        
        const hdr = document.createElement('div');
        hdr.className = 'animadex-accordion-header';
        hdr.innerHTML = `<span><span style="color:#f38ba8; margin-right:5px;">|</span> ${title}</span> <span>▾</span>`;
        
        const body = document.createElement('div');
        body.className = 'animadex-accordion-body';
        body.appendChild(itemsContainer);
        
        hdr.onclick = () => {
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        };
        
        wrap.appendChild(hdr);
        wrap.appendChild(body);
        return { wrap, body };
    };

    const charListContainer = document.createElement('div');
    const copyListContainer = document.createElement('div');
    
    const charAccordion = createAccordion('Character', charListContainer);
    const copyAccordion = createAccordion('Copyright', copyListContainer);
    
    sidebarLists.appendChild(charAccordion.wrap);
    sidebarLists.appendChild(copyAccordion.wrap);

    sidebar.appendChild(sidebarTitle);
    sidebar.appendChild(filterSection);
    sidebar.appendChild(sidebarLists);

    // ==========================================
    // Main Area
    // ==========================================
    const main = document.createElement('div');
    main.className = 'animadex-main';

    const header = document.createElement('div');
    header.className = 'animadex-main-header';
    
    const infoText = document.createElement('span');
    infoText.innerHTML = 'Loading...';
    
    const headerControls = document.createElement('div');
    headerControls.className = 'animadex-header-controls';
    
    const randomBtn = document.createElement('button');
    randomBtn.className = 'animadex-icon-btn';
    randomBtn.innerHTML = '🎲 <span>Random</span>';
    randomBtn.onclick = () => {
        isRandom = true;
        currentPage = 1;
        loadData();
    };
    
    const favBtn = document.createElement('button');
    favBtn.className = 'animadex-icon-btn';
    favBtn.innerHTML = '♥ <span>Favorites</span>';
    favBtn.onclick = () => {
        favOnly = !favOnly;
        favBtn.classList.toggle('active', favOnly);
        currentPage = 1;
        loadData();
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'animadex-close-btn';
    closeBtn.innerHTML = '✖';
    closeBtn.onclick = () => close();

    headerControls.appendChild(randomBtn);
    headerControls.appendChild(favBtn);
    headerControls.appendChild(closeBtn);

    header.appendChild(infoText);
    header.appendChild(headerControls);

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
    
    // Render Sidebar items
    const renderSidebar = () => {
        if (!metadataCache) return;
        
        const renderList = (container, data, isCopyright) => {
            container.innerHTML = '';
            // limit to 100 to prevent lag
            const q = currentQuery.toLowerCase();
            let filtered = data;
            if (q) {
                filtered = data.filter(d => d.name.toLowerCase().includes(q));
            }
            
            const sliced = filtered.slice(0, 100);
            sliced.forEach(item => {
                const row = document.createElement('div');
                row.className = 'animadex-list-item';
                if (isCopyright && currentCopyright === item.name) {
                    row.classList.add('active');
                }
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = item.name;
                
                const countSpan = document.createElement('span');
                countSpan.className = 'animadex-list-item-count';
                countSpan.textContent = formatNumber(item.count);
                
                row.appendChild(nameSpan);
                row.appendChild(countSpan);
                
                row.onclick = () => {
                    if (isCopyright) {
                        currentCopyright = currentCopyright === item.name ? "" : item.name;
                        currentPage = 1;
                        loadData();
                        renderSidebar(); // re-render to update active state
                    } else {
                        // For character, just set search query
                        searchInput.value = item.name;
                        currentQuery = item.name;
                        currentPage = 1;
                        loadData();
                        renderSidebar();
                    }
                };
                container.appendChild(row);
            });
        };
        
        renderList(charListContainer, metadataCache.characters, false);
        renderList(copyListContainer, metadataCache.copyrights, true);
    };

    const loadData = async () => {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 50px; font-size: 16px; color: #a6adc8;">Loading characters...</div>';
        try {
            if (!metadataCache) {
                const metaResp = await fetch(`/animadex/metadata`);
                metadataCache = await metaResp.json();
                renderSidebar();
            }
            
            const favsList = getFavorites().join(",");
            let url = `/animadex/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&copyright=${encodeURIComponent(currentCopyright)}&favorites=${encodeURIComponent(favsList)}`;
            if (isRandom) url += `&random=1`;
            if (favOnly) url += `&fav_only=1`;
            
            // Reset random flag so next pagination is normal
            isRandom = false; 

            const resp = await fetch(url);
            const data = await resp.json();
            
            grid.innerHTML = '';
            infoText.innerHTML = `<b>${data.total.toLocaleString()}</b> characters - page ${data.page} of ${data.pages}`;
            
            const currentFavs = getFavorites();

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
                
                // HOVER OVERLAY
                const overlay = document.createElement('div');
                overlay.className = 'animadex-card-overlay';
                
                const overlayTop = document.createElement('div');
                overlayTop.className = 'animadex-overlay-top';
                
                const favBtn = document.createElement('button');
                favBtn.className = 'animadex-fav-btn';
                const isFaved = currentFavs.includes(char._display_name);
                if (isFaved) favBtn.classList.add('active');
                favBtn.innerHTML = '♥';
                favBtn.onclick = (e) => {
                    e.stopPropagation();
                    const willBeFav = !favBtn.classList.contains('active');
                    toggleFavorite(char._display_name, willBeFav);
                    favBtn.classList.toggle('active');
                };
                
                overlayTop.appendChild(favBtn);
                overlay.appendChild(overlayTop);
                
                if (char.trigger) {
                    const trigLabel = document.createElement('div');
                    trigLabel.className = 'animadex-overlay-title';
                    trigLabel.textContent = 'TRIGGER';
                    overlay.appendChild(trigLabel);
                    
                    const trigBox = document.createElement('div');
                    trigBox.className = 'animadex-trigger-box';
                    trigBox.textContent = char.trigger;
                    overlay.appendChild(trigBox);
                }
                
                if (char.tags && char.tags.length > 0) {
                    const tagsLabel = document.createElement('div');
                    tagsLabel.className = 'animadex-overlay-title';
                    tagsLabel.textContent = `TAGS - ${char.tags.length}`;
                    overlay.appendChild(tagsLabel);
                    
                    const tagsBox = document.createElement('div');
                    tagsBox.className = 'animadex-tags-container';
                    char.tags.slice(0, 15).forEach(t => {
                        const tg = document.createElement('div');
                        tg.className = 'animadex-tag-badge';
                        tg.textContent = t;
                        tagsBox.appendChild(tg);
                    });
                    overlay.appendChild(tagsBox);
                }
                
                imgContainer.appendChild(overlay);
                
                // Info Section
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
                
                // Footer Section
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
        currentQuery = searchInput.value.trim();
        renderSidebar(); // Update sidebar immediately
        
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadData();
        }, 400); // 400ms debounce for main grid
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
