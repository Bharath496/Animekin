// --- Application Configuration & State ---
const ANILIST_API = 'https://graphql.anilist.co';

const state = {
  searchQuery: '',
  activeType: '', // 'TV', 'MOVIE', 'OVA', 'SPECIAL', or ''
  selectedGenres: [], // Array of genre strings (e.g. ['Action', 'Adventure'])
  currentSort: 'popularity', // 'popularity', 'score', 'title'
  currentPage: 1,
  hasMorePages: false,
  isLoading: false,
  featuredAnime: null,
  genres: [] // list of genre strings
};

const apiCache = {
  animeDetails: {},
  characters: {},
  recommendations: {},
  topAnime: null,
  genres: null
};

// Format mapper for AniList type to display format
const FORMAT_MAP = { TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special', MUSIC: 'Music' };

// =====================================================
// LANGUAGE DATA — Dubbed / OG / Sub options
// =====================================================

// Common dub languages across major streaming platforms (Crunchyroll, Funimation, Netflix etc.)
const DUBBED_LANGUAGES = [
  'English', 'Spanish (Latin)', 'Spanish (Castilian)',
  'French', 'German', 'Portuguese (BR)', 'Italian',
  'Russian', 'Arabic', 'Hindi', 'Turkish', 'Polish',
  'Dutch', 'Korean', 'Chinese (Mandarin)', 'Thai'
];

// Original (OG) language options for anime
const OG_LANGUAGES = [
  'Japanese', 'Korean', 'Chinese (Mandarin)',
  'Chinese (Cantonese)', 'English'
];

// Subtitle languages available across major platforms
const SUB_LANGUAGES = [
  'English', 'Spanish (Latin)', 'Spanish (Castilian)',
  'French', 'German', 'Portuguese (BR)', 'Portuguese (PT)',
  'Italian', 'Russian', 'Arabic', 'Hindi', 'Turkish',
  'Polish', 'Dutch', 'Romanian', 'Swedish', 'Norwegian',
  'Danish', 'Finnish', 'Czech', 'Hungarian', 'Greek',
  'Hebrew', 'Indonesian', 'Malay', 'Thai', 'Vietnamese',
  'Korean', 'Chinese (Simplified)', 'Chinese (Traditional)'
];

// =====================================================
// Render Language data inside Modal Languages Tab
// =====================================================
function renderModalLanguages(details) {
  // Dubbed count
  const dubCountEl = document.getElementById('modal-dub-count');
  if (dubCountEl) dubCountEl.textContent = DUBBED_LANGUAGES.length;

  // Sub count
  const subCountEl = document.getElementById('modal-sub-count');
  if (subCountEl) subCountEl.textContent = SUB_LANGUAGES.length;

  // OG Language (from API data or default to Japanese)
  const ogLang = 'Japanese'; // Most anime are Japanese
  const ogTagsEl = document.getElementById('modal-og-tags');
  if (ogTagsEl) {
    ogTagsEl.innerHTML = `<span class="lang-tag og-tag">${ogLang}</span>`;
  }

  // Sidebar OG + Dub info
  const modalOgEl = document.getElementById('modal-og-lang');
  if (modalOgEl) modalOgEl.textContent = ogLang;

  const modalDubsEl = document.getElementById('modal-dub-langs');
  if (modalDubsEl) {
    // Show top 4 langs for sidebar brevity
    const topDubs = DUBBED_LANGUAGES.slice(0, 4);
    modalDubsEl.textContent = topDubs.join(', ') + '...';
  }

  // Dub tags
  const dubTagsEl = document.getElementById('modal-dub-tags');
  if (dubTagsEl) {
    dubTagsEl.innerHTML = DUBBED_LANGUAGES.map(lang =>
      `<span class="lang-tag dub-tag">${lang}</span>`
    ).join('');
  }

  // Sub tags
  const subTagsEl = document.getElementById('modal-sub-tags');
  if (subTagsEl) {
    subTagsEl.innerHTML = SUB_LANGUAGES.map(lang =>
      `<span class="lang-tag sub-tag">${lang}</span>`
    ).join('');
  }
}

// --- AniList GraphQL Client ---
async function queryAniList(query, variables = {}) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(`AniList error: ${response.status}`);
  const json = await response.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// Transform AniList media object to Jikan-like shape (keeps rendering code compatible)
function toJikanAnime(media) {
  return {
    mal_id: media.id,
    title: media.title?.romaji || '',
    title_english: media.title?.english || media.title?.romaji || '',
    title_japanese: media.title?.native || '',
    type: FORMAT_MAP[media.format] || media.format || 'TV',
    status: media.status || '',
    synopsis: media.description ? media.description.replace(/<[^>]*>/g, '') : '',
    score: media.averageScore ? +(media.averageScore / 10).toFixed(2) : null,
    scored_by: media.meanScore ? media.meanScore * 100 : null,
    rank: media.rankings?.find(r => r.type === 'RANKED')?.rank || null,
    popularity: media.popularity || null,
    episodes: media.episodes,
    year: media.seasonYear,
    aired: { string: media.seasonYear ? String(media.seasonYear) : '', prop: { from: { year: media.seasonYear } } },
    rating: null,
    source: media.source || '',
    images: {
      jpg: { large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || '', image_url: media.coverImage?.large || '' },
      webp: { large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || '', image_url: media.coverImage?.large || '' }
    },
    trailer: media.trailer && media.trailer.site === 'youtube' ? { embed_url: `https://www.youtube.com/embed/${media.trailer.id}` } : null,
    genres: (media.genres || []).map(g => ({ mal_id: g, name: g })),
    studios: (media.studios?.nodes || []).map(s => ({ name: s.name })),
    producers: [],
    licensors: []
  };
}

// Debounce helper
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

// --- GraphQL Queries ---
const TOP_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
        id
        title { romaji english native }
        coverImage { large extraLarge }
        genres
        averageScore
        meanScore
        popularity
        format
        episodes
        status
        seasonYear
        description
        source
        trailer { id site }
        rankings { rank type }
        studios(isMain: true) { nodes { name } }
      }
    }
  }`;

const SEARCH_ANIME_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $genreIn: [String], $formatIn: [MediaFormat], $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total }
      media(search: $search, type: ANIME, genre_in: $genreIn, format_in: $formatIn, sort: $sort, isAdult: false) {
        id
        title { romaji english native }
        coverImage { large extraLarge }
        genres
        averageScore
        meanScore
        popularity
        format
        episodes
        status
        seasonYear
        description
        source
        trailer { id site }
        rankings { rank type }
        studios(isMain: true) { nodes { name } }
      }
    }
  }`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      id
      title { romaji english native }
      coverImage { large extraLarge }
      genres
      averageScore
      meanScore
      popularity
      format
      episodes
      status
      seasonYear
      description
      source
      trailer { id site }
      rankings { rank type }
      studios(isMain: true) { nodes { name } }
      characters(perPage: 12, sort: [ROLE]) {
        edges {
          role
          node { id name { full } image { large } }
          voiceActors(language: JAPANESE) { id name { full } languageV2 }
        }
      }
      recommendations(perPage: 10, sort: [RATING_DESC]) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
          }
        }
      }
    }
  }`;

// --- API Functions ---

async function getTopAnime() {
  if (apiCache.topAnime) return apiCache.topAnime;
  try {
    const data = await queryAniList(TOP_ANIME_QUERY, { page: 1, perPage: 50 });
    apiCache.topAnime = (data?.Page?.media || []).map(toJikanAnime);
    return apiCache.topAnime;
  } catch (err) {
    console.error('Error fetching top anime:', err);
    return [];
  }
}

async function getGenres() {
  if (apiCache.genres) return apiCache.genres;
  try {
    const data = await queryAniList('{ GenreCollection }');
    apiCache.genres = (data?.GenreCollection || []).filter(g => g).sort();
    return apiCache.genres;
  } catch (err) {
    console.error('Error fetching genres:', err);
    return [];
  }
}

async function searchAnime(page = 1, append = false) {
  if (state.isLoading) return;
  state.isLoading = true;
  state.currentPage = page;
  if (!append) showGridSkeletons();

  try {
    // Map sort
    let sort = ['POPULARITY_DESC'];
    if (state.currentSort === 'score') sort = ['SCORE_DESC'];
    else if (state.currentSort === 'title') sort = ['TITLE_ROMAJI'];

    // Map type (uppercase for AniList enum)
    let formatIn = undefined;
    if (state.activeType) {
      const t = state.activeType.toUpperCase();
      formatIn = t === 'TV' ? ['TV', 'TV_SHORT'] : [t];
    }

    // Default: show top anime
    if (!state.searchQuery && !state.activeType && state.selectedGenres.length === 0 && state.currentSort === 'popularity') {
      const top = await getTopAnime();
      state.isLoading = false;
      renderAnimeGrid(top, false);
      document.getElementById('pagination-container').classList.add('hide');
      document.getElementById('no-results-state').classList.add('hide');
      document.getElementById('results-count').textContent = `Trending Anime`;
      return;
    }

    const vars = {
      page,
      perPage: 20,
      search: state.searchQuery || undefined,
      genreIn: state.selectedGenres.length > 0 ? state.selectedGenres : undefined,
      formatIn,
      sort
    };

    const result = await queryAniList(SEARCH_ANIME_QUERY, vars);
    const list = (result?.Page?.media || []).map(toJikanAnime);
    const hasNext = result?.Page?.pageInfo?.hasNextPage || false;
    const total = result?.Page?.pageInfo?.total;

    state.isLoading = false;
    state.hasMorePages = hasNext;
    renderAnimeGrid(list, append);

    document.getElementById('pagination-container').classList.toggle('hide', !hasNext);
    const noResults = document.getElementById('no-results-state');
    if (list.length === 0) {
      noResults.classList.remove('hide');
    } else {
      noResults.classList.add('hide');
    }
    document.getElementById('results-count').textContent = total ? `${total.toLocaleString()} anime found` : list.length > 0 ? `Trending Anime` : `0 titles found`;

  } catch (err) {
    state.isLoading = false;
    const top = await getTopAnime();
    renderAnimeGrid(top, false);
    document.getElementById('pagination-container').classList.add('hide');
    document.getElementById('no-results-state').classList.add('hide');
    document.getElementById('results-count').textContent = `Trending Anime (search unavailable)`;
    console.error('Search error:', err);
  }
}

async function getAnimeDetailsData(id) {
  if (apiCache.animeDetails[id]) return apiCache.animeDetails[id];
  try {
    const data = await queryAniList(DETAIL_QUERY, { id });
    const media = data?.Media;
    if (!media) throw new Error('Media not found');

    const details = toJikanAnime(media);

    const characters = (media.characters?.edges || []).map(edge => ({
      character: {
        mal_id: edge.node?.id || 0,
        name: edge.node?.name?.full || '',
        images: { jpg: { image_url: edge.node?.image?.large || '' }, webp: { image_url: edge.node?.image?.large || '' } }
      },
      voice_actors: (edge.voiceActors || []).filter(Boolean).map(va => ({
        language: va.languageV2 || 'Japanese',
        person: { name: va.name?.full || 'Unknown' }
      }))
    }));

    const recs = (media.recommendations?.nodes || []).map(n => n.mediaRecommendation).filter(Boolean).map(entry => ({
      entry: {
        mal_id: entry.id,
        title: entry.title?.english || entry.title?.romaji || '',
        images: { jpg: { image_url: entry.coverImage?.large || '' }, webp: { image_url: entry.coverImage?.large || '' } }
      }
    }));

    const result = { details, characters, recs };
    apiCache.animeDetails[id] = result;
    return result;
  } catch (err) {
    console.error('Error fetching details:', err);
    throw err;
  }
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

// Slideshow state
let heroSlideInterval = null;
let heroSlideList = [];
let heroSlideIndex = 0;
let cachedTopAnime = [];

function startHeroSlideshow(list) {
  stopHeroSlideshow();
  if (!list || list.length === 0) return;
  heroSlideList = list;
  heroSlideIndex = 0;
  renderHeroBanner(heroSlideList[0]);
  heroSlideInterval = setInterval(() => {
    heroSlideIndex = (heroSlideIndex + 1) % heroSlideList.length;
    renderHeroBanner(heroSlideList[heroSlideIndex]);
  }, 6000);
}

function stopHeroSlideshow() {
  if (heroSlideInterval) {
    clearInterval(heroSlideInterval);
    heroSlideInterval = null;
  }
}

function updateHeroForType(topAnimeList, type) {
  stopHeroSlideshow();
  if (!type || type === 'all') {
    // Slideshow: top 10
    startHeroSlideshow(topAnimeList.slice(0, 10));
  } else {
    // Pick a featured anime of this type
    const filtered = topAnimeList.filter(a => a.type && a.type.toUpperCase() === type.toUpperCase());
    const pick = filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : topAnimeList[Math.floor(Math.random() * Math.min(5, topAnimeList.length))];
    renderHeroBanner(pick);
  }
}

// Render dynamic genre tag chips
function renderGenres(genresList) {
  state.genres = genresList;
  const container = document.getElementById('genre-container');
  container.innerHTML = '';

  genresList.forEach(genreName => {
    const chip = document.createElement('span');
    chip.className = 'genre-tag';
    chip.dataset.genre = genreName;
    chip.textContent = genreName;
    
    chip.onclick = () => {
      toggleGenreFilter(genreName);
    };
    
    container.appendChild(chip);
  });
}

// Toggle genre filter state & refresh search
function toggleGenreFilter(genreName) {
  const index = state.selectedGenres.indexOf(genreName);
  if (index > -1) {
    state.selectedGenres.splice(index, 1);
  } else {
    state.selectedGenres.push(genreName);
  }
  
  // Highlight chips
  document.querySelectorAll('.genre-tag').forEach(chip => {
    const name = chip.dataset.genre;
    if (state.selectedGenres.includes(name)) {
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
  state.selectedGenres.forEach(genreName => {
    activeFilters.push({
      type: 'genre',
      label: genreName,
      value: genreName
    });
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
        state.selectedGenres = state.selectedGenres.filter(name => name !== f.value);
        // Unhighlight chip
        const chipEl = document.querySelector(`.genre-tag[data-genre="${f.value}"]`);
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
        <span class="card-badge-score"><i data-lucide="star" style="width: 12px; height: 12px; fill: var(--text-primary);"></i> ${score}</span>
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

    // 5. Populate Language Tab
    renderModalLanguages(details);

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
  document.querySelectorAll('.tab-btn, .tab').forEach(btn => {
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
    if (cachedTopAnime.length > 0) updateHeroForType(cachedTopAnime, state.activeType || 'all');
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
      if (cachedTopAnime.length > 0) updateHeroForType(cachedTopAnime, filter);
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
  document.querySelectorAll('.tab-btn, .tab').forEach(btn => {
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
    // 1. Fetch top anime for hero and grid
    const topAnimeList = await getTopAnime();
    cachedTopAnime = topAnimeList;
    
    // Hero: start slideshow for all anime
    updateHeroForType(topAnimeList, 'all');
    
    // 2. Fetch & Render Genre Tags
    const genresList = await getGenres();
    renderGenres(genresList);
    
    // 3. Perform Initial Render (Loads top anime list by default)
    renderAnimeGrid(topAnimeList);
    
    // Update count label initially
    document.getElementById('results-count').textContent = `Trending Anime`;

  } catch (err) {
    console.error('Initialization error:', err);
    // Display error grid
    document.getElementById('anime-grid').innerHTML = `
      <div class="no-results" style="grid-column: 1/-1;">
        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--text-muted);"></i>
        <h3>Failed to initialize Animekin.</h3>
        <p>Could not connect to Jikan Anime API database. Please refresh the page.</p>
      </div>
    `;
    lucide.createIcons();
  }
}

// Run app
window.onload = initApp;
