// --- Application Configuration & State ---
const API_BASE = 'https://api.jikan.moe/v4';

const state = {
  searchQuery: '',
  activeType: '', // 'tv', 'movie', 'ova', 'special', or ''
  selectedGenres: [], // Array of mal_id (integers)
  currentSort: 'popularity', // 'popularity', 'score', 'title'
  currentPage: 1,
  hasMorePages: false,
  isLoading: false,
  featuredAnime: null, // spotlight hero anime
  genres: [] // list of all genres
};

// Simple In-Memory Cache to prevent duplicate API calls and speed up navigation
const apiCache = {
  animeDetails: {},
  characters: {},
  recommendations: {},
  topAnime: null,
  genres: null
};

// Debounce helper to restrict rapid successive API calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- API Service Wrapper ---
async function fetchAPI(endpoint, params = {}) {
  // Build query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      queryParams.append(key, val);
    }
  });

  const queryString = queryParams.toString();
  const url = `${API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait 1 second and retry once
        console.warn('API Rate limited. Retrying after 1.5s delay...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return await fetchAPI(endpoint, params);
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from ${endpoint}:`, error);
    throw error;
  }
}

// --- API Request Controllers ---

// Load top anime for banner & trending list
async function getTopAnime() {
  if (apiCache.topAnime) return apiCache.topAnime;
  
  try {
    const data = await fetchAPI('/top/anime', { limit: 12 });
    apiCache.topAnime = data.data || [];
    return apiCache.topAnime;
  } catch (err) {
    console.error('Error fetching top anime:', err);
    return [];
  }
}

// Fetch available anime genres
async function getGenres() {
  if (apiCache.genres) return apiCache.genres;
  
  try {
    const data = await fetchAPI('/genres/anime');
    // Filter out minor genres to keep it clean (genres with at least 50 titles)
    const filtered = (data.data || []).filter(g => g.count > 50);
    // Sort genres alphabetically
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    apiCache.genres = filtered;
    return filtered;
  } catch (err) {
    console.error('Error fetching genres:', err);
    return [];
  }
}

// Search anime with query, type, genres and sort
async function searchAnime(page = 1, append = false) {
  if (state.isLoading) return;
  state.isLoading = true;
  state.currentPage = page;
  
  if (!append) {
    showGridSkeletons();
  }

  // Map sort option to Jikan v4 params
  let order_by = 'popularity';
  let sort = 'asc';
  
  if (state.currentSort === 'score') {
    order_by = 'score';
    sort = 'desc';
  } else if (state.currentSort === 'title') {
    order_by = 'title';
    sort = 'asc';
  } else if (state.currentSort === 'popularity') {
    order_by = 'popularity';
    sort = 'asc'; // Popularity #1 is the highest
  }

  const params = {
    q: state.searchQuery,
    type: state.activeType,
    genres: state.selectedGenres.join(','),
    order_by: order_by,
    sort: sort,
    page: page,
    limit: 20
  };

  try {
    // If search state is completely empty, fallback to trending list
    let list = [];
    let pagination = null;
    
    if (!state.searchQuery && !state.activeType && state.selectedGenres.length === 0 && state.currentSort === 'popularity') {
      const topData = await getTopAnime();
      list = topData;
      state.hasMorePages = false;
    } else {
      const result = await fetchAPI('/anime', params);
      list = result.data || [];
      pagination = result.pagination;
      state.hasMorePages = pagination?.has_next_page || false;
    }

    state.isLoading = false;
    renderAnimeGrid(list, append);
    
    // Toggle Load More button visibility
    const loadMoreContainer = document.getElementById('pagination-container');
    if (state.hasMorePages) {
      loadMoreContainer.classList.remove('hide');
    } else {
      loadMoreContainer.classList.add('hide');
    }

    // Toggle No Results View
    const noResults = document.getElementById('no-results-state');
    if (list.length === 0) {
      noResults.classList.remove('hide');
      loadMoreContainer.classList.add('hide');
    } else {
      noResults.classList.add('hide');
    }

    // Update result count label
    const countLabel = document.getElementById('results-count');
    if (pagination?.items?.total) {
      countLabel.textContent = `${pagination.items.total.toLocaleString()} anime found`;
    } else if (list.length > 0) {
      countLabel.textContent = `Trending Anime`;
    } else {
      countLabel.textContent = `0 titles found`;
    }

  } catch (err) {
    state.isLoading = false;
    document.getElementById('anime-grid').innerHTML = `
      <div class="no-results">
        <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--color-pink);"></i>
        <h3>Failed to load anime</h3>
        <p>There was a connection issue with MyAnimeList. Please retry in a few moments.</p>
        <button class="btn btn-primary" onclick="retrySearch()">Retry</button>
      </div>
    `;
    lucide.createIcons();
    console.error('Search error:', err);
  }
}

// Fetch anime details, characters, and recommendations for modal display
async function getAnimeDetailsData(id) {
  // Fetch details
  let details = apiCache.animeDetails[id];
  if (!details) {
    const res = await fetchAPI(`/anime/${id}`);
    details = res.data;
    apiCache.animeDetails[id] = details;
  }
  
  // Fetch characters
  let characters = apiCache.characters[id];
  if (!characters) {
    try {
      const res = await fetchAPI(`/anime/${id}/characters`);
      // Get main characters or top 12
      characters = (res.data || []).slice(0, 12);
      apiCache.characters[id] = characters;
    } catch (err) {
      console.warn('Could not fetch characters:', err);
      characters = [];
    }
  }

  // Fetch recommendations
  let recs = apiCache.recommendations[id];
  if (!recs) {
    try {
      const res = await fetchAPI(`/anime/${id}/recommendations`);
      recs = (res.data || []).slice(0, 10);
      apiCache.recommendations[id] = recs;
    } catch (err) {
      console.warn('Could not fetch recommendations:', err);
      recs = [];
    }
  }

  return { details, characters, recs };
}

// --- DOM Rendering / UI Builders ---

// Render skeletons while loading lists
function showGridSkeletons() {
  const grid = document.getElementById('anime-grid');
  grid.innerHTML = Array(8).fill('<div class="skeleton-card"></div>').join('');
}

// Render the Spotlight Hero banner
function renderHeroBanner(anime) {
  if (!anime) return;
  
  state.featuredAnime = anime;
  
  const bg = document.getElementById('hero-bg-img');
  const title = document.getElementById('hero-title');
  const rating = document.getElementById('hero-rating');
  const type = document.getElementById('hero-type');
  const year = document.getElementById('hero-year');
  const synopsis = document.getElementById('hero-synopsis');
  
  // Use original high-quality webp or jpg poster if available
  const imgUrl = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || '';
  
  bg.style.backgroundImage = `url('${imgUrl}')`;
  const coverImg = document.getElementById('hero-cover-img');
  if (coverImg) {
    coverImg.src = imgUrl;
    coverImg.alt = anime.title_english || anime.title;
  }
  title.textContent = anime.title_english || anime.title;
  rating.textContent = anime.score ? anime.score.toFixed(2) : 'N/A';
  type.textContent = anime.type || 'TV';
  year.textContent = anime.year || anime.aired?.prop?.from?.year || 'Recent';
  synopsis.textContent = anime.synopsis || 'No overview description available.';
  
  // Wire up button event listeners
  document.getElementById('hero-details-btn').onclick = () => openAnimeModal(anime.mal_id);
  document.getElementById('hero-trailer-btn').onclick = () => {
    openAnimeModal(anime.mal_id);
    // Switch to trailer tab
    setTimeout(() => {
      const trailerTab = document.getElementById('tab-btn-trailer');
      if (trailerTab) trailerTab.click();
    }, 500);
  };
}

// Render dynamic genre tag chips
function renderGenres(genresList) {
  state.genres = genresList;
  const container = document.getElementById('genre-container');
  container.innerHTML = '';

  genresList.forEach(genre => {
    const chip = document.createElement('span');
    chip.className = 'genre-tag';
    chip.dataset.id = genre.mal_id;
    chip.textContent = `${genre.name} (${genre.count})`;
    
    chip.onclick = () => {
      toggleGenreFilter(genre.mal_id);
    };
    
    container.appendChild(chip);
  });
}

// Toggle genre filter state & refresh search
function toggleGenreFilter(genreId) {
  const index = state.selectedGenres.indexOf(genreId);
  if (index > -1) {
    state.selectedGenres.splice(index, 1);
  } else {
    state.selectedGenres.push(genreId);
  }
  
  // Highlight chips
  document.querySelectorAll('.genre-tag').forEach(chip => {
    const id = parseInt(chip.dataset.id);
    if (state.selectedGenres.includes(id)) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  renderActiveFilters();
  searchAnime(1);
}

// Render Active Filter chip panel
function renderActiveFilters() {
  const bar = document.getElementById('active-filters-bar');
  const container = document.getElementById('active-filters-list');
  container.innerHTML = '';
  
  const activeFilters = [];
  
  // Add active type filter details
  if (state.activeType) {
    activeFilters.push({
      type: 'type',
      label: `Type: ${state.activeType.toUpperCase()}`,
      value: state.activeType
    });
  }

  // Add active genre details
  state.selectedGenres.forEach(gid => {
    const genre = state.genres.find(g => g.mal_id === gid);
    if (genre) {
      activeFilters.push({
        type: 'genre',
        label: genre.name,
        value: gid
      });
    }
  });

  if (activeFilters.length === 0) {
    bar.classList.add('hide');
    return;
  }
  
  bar.classList.remove('hide');

  activeFilters.forEach(f => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `
      <span>${f.label}</span>
      <i data-lucide="x" class="chip-remove"></i>
    `;
    
    chip.querySelector('.chip-remove').onclick = () => {
      if (f.type === 'type') {
        state.activeType = '';
        document.getElementById('type-select').value = '';
        // Unhighlight any active header nav links
        document.querySelectorAll('.nav-link').forEach(link => {
          link.classList.remove('active');
          if (link.dataset.filter === 'all') link.classList.add('active');
        });
      } else if (f.type === 'genre') {
        state.selectedGenres = state.selectedGenres.filter(id => id !== f.value);
        // Unhighlight chip
        const chipEl = document.querySelector(`.genre-tag[data-id="${f.value}"]`);
        if (chipEl) chipEl.classList.remove('active');
      }
      renderActiveFilters();
      searchAnime(1);
    };
    
    container.appendChild(chip);
  });
  
  lucide.createIcons();
}

// Render Anime Cards in the Grid
function renderAnimeGrid(animeList, append = false) {
  const grid = document.getElementById('anime-grid');
  
  if (!append) {
    grid.innerHTML = '';
  }

  animeList.forEach(anime => {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.onclick = () => openAnimeModal(anime.mal_id);

    const score = anime.score ? anime.score.toFixed(1) : 'N/A';
    const type = anime.type || 'TV';
    const formatTitle = anime.title_english || anime.title;
    
    // Original/Large JPG or Webp poster
    const posterSrc = anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url || anime.images?.jpg?.image_url || '';

    // Render limited genre tags for clean card look (max 2)
    const genreTagsHTML = (anime.genres || [])
      .slice(0, 2)
      .map(g => `<span class="card-genre-tag">${g.name}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-img-wrapper">
        <img src="${posterSrc}" alt="${formatTitle}" class="card-img" loading="lazy">
        <span class="card-badge-score"><i data-lucide="star" style="width: 12px; height: 12px; fill: var(--color-yellow);"></i> ${score}</span>
        <span class="card-badge-type">${type}</span>
      </div>
      <div class="card-details">
        <h3 class="card-title">${formatTitle}</h3>
        <div class="card-genres-row">${genreTagsHTML}</div>
        <div class="card-meta-bottom">
          <span>${anime.episodes ? anime.episodes + ' eps' : 'Ongoing'}</span>
          <span>${anime.year || anime.aired?.prop?.from?.year || 'Recent'}</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  lucide.createIcons();
}

// --- Detail Modal Functions ---

// Open detailed modal & fetch dynamic tabs content
async function openAnimeModal(animeId) {
  const modal = document.getElementById('detail-modal');
  
  // Set up loading indicators inside modal before fetching
  document.getElementById('modal-poster').src = '';
  document.getElementById('modal-title-en').textContent = 'Loading...';
  document.getElementById('modal-title-jp').textContent = '';
  document.getElementById('modal-score').textContent = '-';
  document.getElementById('modal-rank').textContent = '-';
  document.getElementById('modal-pop').textContent = '-';
  document.getElementById('modal-format').textContent = '-';
  document.getElementById('modal-episodes').textContent = '-';
  document.getElementById('modal-status').textContent = '-';
  document.getElementById('modal-aired').textContent = '-';
  document.getElementById('modal-studio').textContent = '-';
  document.getElementById('modal-source').textContent = '-';
  document.getElementById('modal-genres-container').innerHTML = '';
  document.getElementById('modal-synopsis-text').textContent = '';
  document.getElementById('modal-producers').textContent = '';
  document.getElementById('modal-licensors').textContent = '';
  document.getElementById('modal-characters-grid').innerHTML = '<div class="char-skeleton"></div><div class="char-skeleton"></div><div class="char-skeleton"></div>';
  document.getElementById('modal-recommendations-row').innerHTML = '';
  
  // Hide trailer player by default, show placeholder
  document.getElementById('trailer-iframe').src = '';
  document.getElementById('trailer-iframe').style.display = 'none';
  document.getElementById('trailer-placeholder').style.display = 'flex';

  // Open the dialog
  modal.showModal();
  document.body.style.overflow = 'hidden'; // lock background scroll

  // Reset tab focus to "Trailer"
  switchModalTab('tab-trailer');

  try {
    const { details, characters, recs } = await getAnimeDetailsData(animeId);
    
    // 1. Populate Overview Metadata & Sidebar
    const poster = details.images?.webp?.large_image_url || details.images?.jpg?.large_image_url || details.images?.jpg?.image_url || '';
    document.getElementById('modal-poster').src = poster;
    document.getElementById('modal-title-en').textContent = details.title_english || details.title;
    document.getElementById('modal-title-jp').textContent = details.title_japanese || '';
    
    document.getElementById('modal-score').textContent = details.score ? details.score.toFixed(2) : 'N/A';
    document.getElementById('modal-scored-by').textContent = details.scored_by ? `${details.scored_by.toLocaleString()} users` : '0 ratings';
    document.getElementById('modal-rank').textContent = details.rank ? `#${details.rank}` : 'N/A';
    document.getElementById('modal-pop').textContent = details.popularity ? `#${details.popularity}` : 'N/A';
    
    document.getElementById('modal-format').textContent = details.type || 'N/A';
    document.getElementById('modal-episodes').textContent = details.episodes || 'Ongoing';
    document.getElementById('modal-status').textContent = details.status || 'N/A';
    document.getElementById('modal-aired').textContent = details.aired?.string || 'N/A';
    
    // Studios, Producers & Licensors Lists
    const studios = (details.studios || []).map(s => s.name).join(', ') || 'N/A';
    document.getElementById('modal-studio').textContent = studios;
    document.getElementById('modal-source').textContent = details.source || 'N/A';
    
    const producers = (details.producers || []).map(p => p.name).join(', ') || 'N/A';
    document.getElementById('modal-producers').textContent = producers;
    
    const licensors = (details.licensors || []).map(l => l.name).join(', ') || 'N/A';
    document.getElementById('modal-licensors').textContent = licensors;
    
    // Genres
    const genresContainer = document.getElementById('modal-genres-container');
    genresContainer.innerHTML = '';
    (details.genres || []).forEach(g => {
      const tag = document.createElement('span');
      tag.className = 'modal-genre-tag';
      tag.textContent = g.name;
      genresContainer.appendChild(tag);
    });

    document.getElementById('modal-rating-badge').textContent = details.rating || 'G';
    document.getElementById('modal-synopsis-text').textContent = details.synopsis || 'No synopsis description available.';

    // 2. Populate Characters
    renderModalCharacters(characters);

    // 3. Populate Trailer
    const trailer = details.trailer;
    const iframe = document.getElementById('trailer-iframe');
    const placeholder = document.getElementById('trailer-placeholder');
    
    if (trailer?.embed_url) {
      iframe.src = trailer.embed_url;
      iframe.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      iframe.src = '';
      iframe.style.display = 'none';
      placeholder.style.display = 'flex';
    }

    // 4. Populate Recommendations
    renderModalRecommendations(recs);

  } catch (err) {
    console.error('Error loading modal info:', err);
    document.getElementById('modal-title-en').textContent = 'Error loading details';
  }
}

// Render character grid inside modal details
function renderModalCharacters(charList) {
  const container = document.getElementById('modal-characters-grid');
  container.innerHTML = '';
  
  if (charList.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No character information found.</div>';
    return;
  }

  charList.forEach(item => {
    const char = item.character;
    const card = document.createElement('div');
    card.className = 'character-card';
    
    // Find Japanese voice actor
    const japVA = (item.voice_actors || []).find(va => va.language === 'Japanese');
    const vaName = japVA ? japVA.person.name : 'Unknown VA';
    const charImg = char.images?.webp?.image_url || char.images?.jpg?.image_url || '';

    card.innerHTML = `
      <div class="char-img-wrapper">
        <img src="${charImg}" alt="${char.name}" class="char-img" loading="lazy">
      </div>
      <div class="char-names">
        <span class="char-name">${char.name}</span>
        <span class="char-va">${vaName}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render recommended similar anime cards inside modal recommendations panel
function renderModalRecommendations(recList) {
  const container = document.getElementById('modal-recommendations-row');
  container.innerHTML = '';
  
  if (recList.length === 0) {
    container.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-muted); padding: 2rem;">No recommendations found.</div>';
    return;
  }

  recList.forEach(item => {
    const entry = item.entry;
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.onclick = () => openAnimeModal(entry.mal_id);
    
    const poster = entry.images?.webp?.image_url || entry.images?.jpg?.image_url || '';

    card.innerHTML = `
      <div class="rec-img-wrapper">
        <img src="${poster}" alt="${entry.title}" class="rec-img" loading="lazy">
      </div>
      <h5 class="rec-title">${entry.title}</h5>
    `;
    
    container.appendChild(card);
  });
}

// Switch tabs inside modal details
function switchModalTab(tabId) {
  // Toggle tab buttons active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
}

// Close the detailed dialog
function closeAnimeModal() {
  const modal = document.getElementById('detail-modal');
  modal.close();
  document.body.style.overflow = ''; // restore background scroll
  
  // Stop YouTube video if iframe is playing
  const iframe = document.getElementById('trailer-iframe');
  iframe.src = '';
}

// --- Search / Filter / Navigation Logic ---

// Clear query input
function clearSearch() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('search-clear-btn').classList.add('hide');
  state.searchQuery = '';
  searchAnime(1);
}

// Reset all search states to default
function resetSearch() {
  state.searchQuery = '';
  state.activeType = '';
  state.selectedGenres = [];
  state.currentSort = 'popularity';
  
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear-btn').classList.add('hide');
  document.getElementById('sort-select').value = 'popularity';
  document.getElementById('type-select').value = '';
  
  document.querySelectorAll('.genre-tag').forEach(chip => chip.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.filter === 'all') link.classList.add('active');
  });

  renderActiveFilters();
  searchAnime(1);
}

// Retry search when connection fails
function retrySearch() {
  searchAnime(state.currentPage);
}

// Set up UI event listeners
function setupEventListeners() {
  // 1. Search Input with debounce
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  
  const debouncedSearch = debounce((val) => {
    state.searchQuery = val.trim();
    searchAnime(1);
  }, 500);

  searchInput.oninput = (e) => {
    const val = e.target.value;
    if (val.length > 0) {
      clearBtn.classList.remove('hide');
    } else {
      clearBtn.classList.add('hide');
    }
    debouncedSearch(val);
  };

  clearBtn.onclick = clearSearch;
  
  // Reset buttons
  document.getElementById('reset-search-btn').onclick = resetSearch;
  document.getElementById('logo-btn').onclick = (e) => {
    e.preventDefault();
    resetSearch();
  };

  // 2. Filters Dropdowns
  document.getElementById('sort-select').onchange = (e) => {
    state.currentSort = e.target.value;
    searchAnime(1);
  };

  document.getElementById('type-select').onchange = (e) => {
    state.activeType = e.target.value;
    
    // Synch header active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.filter === state.activeType || (state.activeType === '' && link.dataset.filter === 'all')) {
        link.classList.add('active');
      }
    });

    renderActiveFilters();
    searchAnime(1);
  };

  // 3. Navigation Links (Header)
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const filter = link.dataset.filter;
      state.activeType = filter === 'all' ? '' : filter;
      document.getElementById('type-select').value = state.activeType;
      
      renderActiveFilters();
      searchAnime(1);
    };
  });

  // 4. Load More button
  document.getElementById('load-more-btn').onclick = () => {
    searchAnime(state.currentPage + 1, true);
  };

  // 5. Modal actions
  document.getElementById('modal-close-btn').onclick = closeAnimeModal;
  
  // Close modal when clicking on the dialog backdrop
  const modal = document.getElementById('detail-modal');
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeAnimeModal();
    }
  };

  // Switch tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      switchModalTab(btn.dataset.tab);
    };
  });
  
  // Clear all filters bar button
  document.getElementById('clear-all-filters-btn').onclick = resetSearch;
}

// --- App Initialization ---
async function initApp() {
  setupEventListeners();
  
  // Show default grids loading skeletons
  showGridSkeletons();

  try {
    // 1. Fetch & Render Spotlight (Hero) Anime
    const topAnimeList = await getTopAnime();
    if (topAnimeList.length > 0) {
      // Pick a random spotlight anime from the top 5
      const spotlight = topAnimeList[Math.floor(Math.random() * Math.min(5, topAnimeList.length))];
      renderHeroBanner(spotlight);
    }
    
    // 2. Fetch & Render Genre Tags
    const genresList = await getGenres();
    renderGenres(genresList);
    
    // 3. Perform Initial Search (Loads top anime list by default)
    renderAnimeGrid(topAnimeList);
    
    // Update count label initially
    document.getElementById('results-count').textContent = `Trending Anime`;

  } catch (err) {
    console.error('Initialization error:', err);
    // Display error grid
    document.getElementById('anime-grid').innerHTML = `
      <div class="no-results" style="grid-column: 1/-1;">
        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-pink);"></i>
        <h3>Failed to initialize website</h3>
        <p>Could not connect to Jikan Anime API database. Please refresh the page.</p>
      </div>
    `;
    lucide.createIcons();
  }
}

// Run app
window.onload = initApp;
