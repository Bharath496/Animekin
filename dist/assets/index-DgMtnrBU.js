(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&t(i)}).observe(document,{childList:!0,subtree:!0});function s(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function t(n){if(n.ep)return;n.ep=!0;const r=s(n);fetch(n.href,r)}})();const H="https://graphql.anilist.co",c={searchQuery:"",activeType:"",selectedGenres:[],currentSort:"popularity",currentPage:1,hasMorePages:!1,isLoading:!1,featuredAnime:null,genres:[]},E={animeDetails:{},characters:{},recommendations:{},topAnime:null,genres:null},G={TV:"TV",TV_SHORT:"TV",MOVIE:"Movie",OVA:"OVA",ONA:"ONA",SPECIAL:"Special",MUSIC:"Music"},S=["English","Spanish (Latin)","Spanish (Castilian)","French","German","Portuguese (BR)","Italian","Russian","Arabic","Hindi","Turkish","Polish","Dutch","Korean","Chinese (Mandarin)","Thai"],P=["English","Spanish (Latin)","Spanish (Castilian)","French","German","Portuguese (BR)","Portuguese (PT)","Italian","Russian","Arabic","Hindi","Turkish","Polish","Dutch","Romanian","Swedish","Norwegian","Danish","Finnish","Czech","Hungarian","Greek","Hebrew","Indonesian","Malay","Thai","Vietnamese","Korean","Chinese (Simplified)","Chinese (Traditional)"];function O(e){const a=document.getElementById("modal-dub-count");a&&(a.textContent=S.length);const s=document.getElementById("modal-sub-count");s&&(s.textContent=P.length);const t="Japanese",n=document.getElementById("modal-og-tags");n&&(n.innerHTML=`<span class="lang-tag og-tag">${t}</span>`);const r=document.getElementById("modal-og-lang");r&&(r.textContent=t);const i=document.getElementById("modal-dub-langs");if(i){const o=S.slice(0,4);i.textContent=o.join(", ")+"..."}const l=document.getElementById("modal-dub-tags");l&&(l.innerHTML=S.map(o=>`<span class="lang-tag dub-tag">${o}</span>`).join(""));const m=document.getElementById("modal-sub-tags");m&&(m.innerHTML=P.map(o=>`<span class="lang-tag sub-tag">${o}</span>`).join(""))}async function x(e,a={}){const s=await fetch(H,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:e,variables:a})});if(!s.ok)throw new Error(`AniList error: ${s.status}`);const t=await s.json();if(t.errors)throw new Error(t.errors[0].message);return t.data}function $(e){var a,s,t,n,r,i,l,m,o,d,g,u,y;return{mal_id:e.id,title:((a=e.title)==null?void 0:a.romaji)||"",title_english:((s=e.title)==null?void 0:s.english)||((t=e.title)==null?void 0:t.romaji)||"",title_japanese:((n=e.title)==null?void 0:n.native)||"",type:G[e.format]||e.format||"TV",status:e.status||"",synopsis:e.description?e.description.replace(/<[^>]*>/g,""):"",score:e.averageScore?+(e.averageScore/10).toFixed(2):null,scored_by:e.meanScore?e.meanScore*100:null,rank:((i=(r=e.rankings)==null?void 0:r.find(p=>p.type==="RANKED"))==null?void 0:i.rank)||null,popularity:e.popularity||null,episodes:e.episodes,year:e.seasonYear,aired:{string:e.seasonYear?String(e.seasonYear):"",prop:{from:{year:e.seasonYear}}},rating:null,source:e.source||"",images:{jpg:{large_image_url:((l=e.coverImage)==null?void 0:l.extraLarge)||((m=e.coverImage)==null?void 0:m.large)||"",image_url:((o=e.coverImage)==null?void 0:o.large)||""},webp:{large_image_url:((d=e.coverImage)==null?void 0:d.extraLarge)||((g=e.coverImage)==null?void 0:g.large)||"",image_url:((u=e.coverImage)==null?void 0:u.large)||""}},trailer:e.trailer&&e.trailer.site==="youtube"?{embed_url:`https://www.youtube.com/embed/${e.trailer.id}`}:null,genres:(e.genres||[]).map(p=>({mal_id:p,name:p})),studios:(((y=e.studios)==null?void 0:y.nodes)||[]).map(p=>({name:p.name})),producers:[],licensors:[]}}function R(e,a){let s;return function(...n){const r=()=>{clearTimeout(s),e(...n)};clearTimeout(s),s=setTimeout(r,a)}}const D=`
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
  }`,q=`
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
  }`,V=`
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
  }`;async function w(){var e;if(E.topAnime)return E.topAnime;try{const a=await x(D,{page:1,perPage:50});return E.topAnime=(((e=a==null?void 0:a.Page)==null?void 0:e.media)||[]).map($),E.topAnime}catch(a){return console.error("Error fetching top anime:",a),[]}}async function F(){if(E.genres)return E.genres;try{const e=await x("{ GenreCollection }");return E.genres=((e==null?void 0:e.GenreCollection)||[]).filter(a=>a).sort(),E.genres}catch(e){return console.error("Error fetching genres:",e),[]}}async function B(e=1,a=!1){var s,t,n,r,i;if(!c.isLoading){c.isLoading=!0,c.currentPage=e,a||k();try{let l=["POPULARITY_DESC"];c.currentSort==="score"?l=["SCORE_DESC"]:c.currentSort==="title"&&(l=["TITLE_ROMAJI"]);let m;if(c.activeType&&(m=c.activeType==="TV"?["TV","TV_SHORT"]:[c.activeType]),!c.searchQuery&&!c.activeType&&c.selectedGenres.length===0&&c.currentSort==="popularity"){const h=await w();c.isLoading=!1,b(h,!1),document.getElementById("pagination-container").classList.add("hide"),document.getElementById("no-results-state").classList.add("hide"),document.getElementById("results-count").textContent="Trending Anime";return}const o={page:e,perPage:20,search:c.searchQuery||void 0,genreIn:c.selectedGenres.length>0?c.selectedGenres:void 0,formatIn:m,sort:l},d=await x(q,o),g=(((s=d==null?void 0:d.Page)==null?void 0:s.media)||[]).map($),u=((n=(t=d==null?void 0:d.Page)==null?void 0:t.pageInfo)==null?void 0:n.hasNextPage)||!1,y=(i=(r=d==null?void 0:d.Page)==null?void 0:r.pageInfo)==null?void 0:i.total;c.isLoading=!1,c.hasMorePages=u,b(g,a),document.getElementById("pagination-container").classList.toggle("hide",!u);const p=document.getElementById("no-results-state");g.length===0?p.classList.remove("hide"):p.classList.add("hide"),document.getElementById("results-count").textContent=y?`${y.toLocaleString()} anime found`:g.length>0?"Trending Anime":"0 titles found"}catch(l){c.isLoading=!1;const m=await w();b(m,!1),document.getElementById("pagination-container").classList.add("hide"),document.getElementById("no-results-state").classList.add("hide"),document.getElementById("results-count").textContent="Trending Anime (search unavailable)",console.error("Search error:",l)}}}async function U(e){var a,s;if(E.animeDetails[e])return E.animeDetails[e];try{const t=await x(V,{id:e}),n=t==null?void 0:t.Media;if(!n)throw new Error("Media not found");const r=$(n),i=(((a=n.characters)==null?void 0:a.edges)||[]).map(o=>{var d,g,u,y,p,h,f;return{character:{mal_id:((d=o.node)==null?void 0:d.id)||0,name:((u=(g=o.node)==null?void 0:g.name)==null?void 0:u.full)||"",images:{jpg:{image_url:((p=(y=o.node)==null?void 0:y.image)==null?void 0:p.large)||""},webp:{image_url:((f=(h=o.node)==null?void 0:h.image)==null?void 0:f.large)||""}}},voice_actors:(o.voiceActors||[]).filter(Boolean).map(I=>{var v;return{language:I.languageV2||"Japanese",person:{name:((v=I.name)==null?void 0:v.full)||"Unknown"}}})}}),l=(((s=n.recommendations)==null?void 0:s.nodes)||[]).map(o=>o.mediaRecommendation).filter(Boolean).map(o=>{var d,g,u,y;return{entry:{mal_id:o.id,title:((d=o.title)==null?void 0:d.english)||((g=o.title)==null?void 0:g.romaji)||"",images:{jpg:{image_url:((u=o.coverImage)==null?void 0:u.large)||""},webp:{image_url:((y=o.coverImage)==null?void 0:y.large)||""}}}}}),m={details:r,characters:i,recs:l};return E.animeDetails[e]=m,m}catch(t){throw console.error("Error fetching details:",t),t}}function k(){const e=document.getElementById("anime-grid");e.innerHTML=Array(8).fill('<div class="skeleton-card"></div>').join("")}function Y(e){var o,d,g,u,y,p,h;if(!e)return;c.featuredAnime=e;const a=document.getElementById("hero-bg-img"),s=document.getElementById("hero-title"),t=document.getElementById("hero-rating"),n=document.getElementById("hero-type"),r=document.getElementById("hero-year"),i=document.getElementById("hero-synopsis"),l=((d=(o=e.images)==null?void 0:o.webp)==null?void 0:d.large_image_url)||((u=(g=e.images)==null?void 0:g.jpg)==null?void 0:u.large_image_url)||"";a.style.backgroundImage=`url('${l}')`;const m=document.getElementById("hero-cover-img");m&&(m.src=l,m.alt=e.title_english||e.title),s.textContent=e.title_english||e.title,t.textContent=e.score?e.score.toFixed(2):"N/A",n.textContent=e.type||"TV",r.textContent=e.year||((h=(p=(y=e.aired)==null?void 0:y.prop)==null?void 0:p.from)==null?void 0:h.year)||"Recent",i.textContent=e.synopsis||"No overview description available.",document.getElementById("hero-details-btn").onclick=()=>C(e.mal_id),document.getElementById("hero-trailer-btn").onclick=()=>{C(e.mal_id),setTimeout(()=>{const f=document.getElementById("tab-btn-trailer");f&&f.click()},500)}}function Q(e){c.genres=e;const a=document.getElementById("genre-container");a.innerHTML="",e.forEach(s=>{const t=document.createElement("span");t.className="genre-tag",t.dataset.genre=s,t.textContent=s,t.onclick=()=>{J(s)},a.appendChild(t)})}function J(e){const a=c.selectedGenres.indexOf(e);a>-1?c.selectedGenres.splice(a,1):c.selectedGenres.push(e),document.querySelectorAll(".genre-tag").forEach(s=>{const t=s.dataset.genre;c.selectedGenres.includes(t)?s.classList.add("active"):s.classList.remove("active")}),L(),B(1)}function L(){const e=document.getElementById("active-filters-bar"),a=document.getElementById("active-filters-list");a.innerHTML="";const s=[];if(c.activeType&&s.push({type:"type",label:`Type: ${c.activeType.toUpperCase()}`,value:c.activeType}),c.selectedGenres.forEach(t=>{s.push({type:"genre",label:t,value:t})}),s.length===0){e.classList.add("hide");return}e.classList.remove("hide"),s.forEach(t=>{const n=document.createElement("span");n.className="filter-chip",n.innerHTML=`
      <span>${t.label}</span>
      <i data-lucide="x" class="chip-remove"></i>
    `,n.querySelector(".chip-remove").onclick=()=>{if(t.type==="type")c.activeType="",document.getElementById("type-select").value="",document.querySelectorAll(".nav-link").forEach(r=>{r.classList.remove("active"),r.dataset.filter==="all"&&r.classList.add("active")});else if(t.type==="genre"){c.selectedGenres=c.selectedGenres.filter(i=>i!==t.value);const r=document.querySelector(`.genre-tag[data-genre="${t.value}"]`);r&&r.classList.remove("active")}L(),B(1)},a.appendChild(n)}),lucide.createIcons()}function b(e,a=!1){const s=document.getElementById("anime-grid");a||(s.innerHTML=""),e.forEach(t=>{var d,g,u,y,p,h,f,I,v;const n=document.createElement("div");n.className="anime-card",n.onclick=()=>C(t.mal_id);const r=t.score?t.score.toFixed(1):"N/A",i=t.type||"TV",l=t.title_english||t.title,m=((g=(d=t.images)==null?void 0:d.jpg)==null?void 0:g.large_image_url)||((y=(u=t.images)==null?void 0:u.webp)==null?void 0:y.large_image_url)||((h=(p=t.images)==null?void 0:p.jpg)==null?void 0:h.image_url)||"",o=(t.genres||[]).slice(0,2).map(T=>`<span class="card-genre-tag">${T.name}</span>`).join("");n.innerHTML=`
      <div class="card-img-wrapper">
        <img src="${m}" alt="${l}" class="card-img" loading="lazy">
        <span class="card-badge-score"><i data-lucide="star" style="width: 12px; height: 12px; fill: var(--op-gold);"></i> ${r}</span>
        <span class="card-badge-type">${i}</span>
      </div>
      <div class="card-details">
        <h3 class="card-title">${l}</h3>
        <div class="card-genres-row">${o}</div>
        <div class="card-meta-bottom">
          <span>${t.episodes?t.episodes+" eps":"Ongoing"}</span>
          <span>${t.year||((v=(I=(f=t.aired)==null?void 0:f.prop)==null?void 0:I.from)==null?void 0:v.year)||"Recent"}</span>
        </div>
      </div>
    `,s.appendChild(n)}),lucide.createIcons()}async function C(e){var s,t,n,r,i,l,m;const a=document.getElementById("detail-modal");document.getElementById("modal-poster").src="",document.getElementById("modal-title-en").textContent="Loading...",document.getElementById("modal-title-jp").textContent="",document.getElementById("modal-score").textContent="-",document.getElementById("modal-rank").textContent="-",document.getElementById("modal-pop").textContent="-",document.getElementById("modal-format").textContent="-",document.getElementById("modal-episodes").textContent="-",document.getElementById("modal-status").textContent="-",document.getElementById("modal-aired").textContent="-",document.getElementById("modal-studio").textContent="-",document.getElementById("modal-source").textContent="-",document.getElementById("modal-genres-container").innerHTML="",document.getElementById("modal-synopsis-text").textContent="",document.getElementById("modal-producers").textContent="",document.getElementById("modal-licensors").textContent="",document.getElementById("modal-characters-grid").innerHTML='<div class="char-skeleton"></div><div class="char-skeleton"></div><div class="char-skeleton"></div>',document.getElementById("modal-recommendations-row").innerHTML="",document.getElementById("trailer-iframe").src="",document.getElementById("trailer-iframe").style.display="none",document.getElementById("trailer-placeholder").style.display="flex",a.showModal(),document.body.style.overflow="hidden",j("tab-trailer");try{const{details:o,characters:d,recs:g}=await U(e),u=((t=(s=o.images)==null?void 0:s.webp)==null?void 0:t.large_image_url)||((r=(n=o.images)==null?void 0:n.jpg)==null?void 0:r.large_image_url)||((l=(i=o.images)==null?void 0:i.jpg)==null?void 0:l.image_url)||"";document.getElementById("modal-poster").src=u,document.getElementById("modal-title-en").textContent=o.title_english||o.title,document.getElementById("modal-title-jp").textContent=o.title_japanese||"",document.getElementById("modal-score").textContent=o.score?o.score.toFixed(2):"N/A",document.getElementById("modal-scored-by").textContent=o.scored_by?`${o.scored_by.toLocaleString()} users`:"0 ratings",document.getElementById("modal-rank").textContent=o.rank?`#${o.rank}`:"N/A",document.getElementById("modal-pop").textContent=o.popularity?`#${o.popularity}`:"N/A",document.getElementById("modal-format").textContent=o.type||"N/A",document.getElementById("modal-episodes").textContent=o.episodes||"Ongoing",document.getElementById("modal-status").textContent=o.status||"N/A",document.getElementById("modal-aired").textContent=((m=o.aired)==null?void 0:m.string)||"N/A";const y=(o.studios||[]).map(A=>A.name).join(", ")||"N/A";document.getElementById("modal-studio").textContent=y,document.getElementById("modal-source").textContent=o.source||"N/A";const p=(o.producers||[]).map(A=>A.name).join(", ")||"N/A";document.getElementById("modal-producers").textContent=p;const h=(o.licensors||[]).map(A=>A.name).join(", ")||"N/A";document.getElementById("modal-licensors").textContent=h;const f=document.getElementById("modal-genres-container");f.innerHTML="",(o.genres||[]).forEach(A=>{const _=document.createElement("span");_.className="modal-genre-tag",_.textContent=A.name,f.appendChild(_)}),document.getElementById("modal-rating-badge").textContent=o.rating||"G",document.getElementById("modal-synopsis-text").textContent=o.synopsis||"No synopsis description available.",z(d);const I=o.trailer,v=document.getElementById("trailer-iframe"),T=document.getElementById("trailer-placeholder");I!=null&&I.embed_url?(v.src=I.embed_url,v.style.display="block",T.style.display="none"):(v.src="",v.style.display="none",T.style.display="flex"),K(g),O(o)}catch(o){console.error("Error loading modal info:",o),document.getElementById("modal-title-en").textContent="Error loading details"}}function z(e){const a=document.getElementById("modal-characters-grid");if(a.innerHTML="",e.length===0){a.innerHTML='<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No character information found.</div>';return}e.forEach(s=>{var m,o,d,g;const t=s.character,n=document.createElement("div");n.className="character-card";const r=(s.voice_actors||[]).find(u=>u.language==="Japanese"),i=r?r.person.name:"Unknown VA",l=((o=(m=t.images)==null?void 0:m.webp)==null?void 0:o.image_url)||((g=(d=t.images)==null?void 0:d.jpg)==null?void 0:g.image_url)||"";n.innerHTML=`
      <div class="char-img-wrapper">
        <img src="${l}" alt="${t.name}" class="char-img" loading="lazy">
      </div>
      <div class="char-names">
        <span class="char-name">${t.name}</span>
        <span class="char-va">${i}</span>
      </div>
    `,a.appendChild(n)})}function K(e){const a=document.getElementById("modal-recommendations-row");if(a.innerHTML="",e.length===0){a.innerHTML='<div style="width: 100%; text-align: center; color: var(--text-muted); padding: 2rem;">No recommendations found.</div>';return}e.forEach(s=>{var i,l,m,o;const t=s.entry,n=document.createElement("div");n.className="rec-card",n.onclick=()=>C(t.mal_id);const r=((l=(i=t.images)==null?void 0:i.webp)==null?void 0:l.image_url)||((o=(m=t.images)==null?void 0:m.jpg)==null?void 0:o.image_url)||"";n.innerHTML=`
      <div class="rec-img-wrapper">
        <img src="${r}" alt="${t.title}" class="rec-img" loading="lazy">
      </div>
      <h5 class="rec-title">${t.title}</h5>
    `,a.appendChild(n)})}function j(e){document.querySelectorAll(".tab-btn, .tab").forEach(a=>{a.dataset.tab===e?a.classList.add("active"):a.classList.remove("active")}),document.querySelectorAll(".tab-panel").forEach(a=>{a.id===e?a.classList.add("active"):a.classList.remove("active")})}function N(){document.getElementById("detail-modal").close(),document.body.style.overflow="";const a=document.getElementById("trailer-iframe");a.src=""}function W(){const e=document.getElementById("search-input");e.value="",document.getElementById("search-clear-btn").classList.add("hide"),c.searchQuery="",B(1)}function M(){c.searchQuery="",c.activeType="",c.selectedGenres=[],c.currentSort="popularity",document.getElementById("search-input").value="",document.getElementById("search-clear-btn").classList.add("hide"),document.getElementById("sort-select").value="popularity",document.getElementById("type-select").value="",document.querySelectorAll(".genre-tag").forEach(e=>e.classList.remove("active")),document.querySelectorAll(".nav-link").forEach(e=>{e.classList.remove("active"),e.dataset.filter==="all"&&e.classList.add("active")}),L(),B(1)}function X(){const e=document.getElementById("search-input"),a=document.getElementById("search-clear-btn"),s=R(n=>{c.searchQuery=n.trim(),B(1)},500);e.oninput=n=>{const r=n.target.value;r.length>0?a.classList.remove("hide"):a.classList.add("hide"),s(r)},a.onclick=W,document.getElementById("reset-search-btn").onclick=M,document.getElementById("logo-btn").onclick=n=>{n.preventDefault(),M()},document.getElementById("sort-select").onchange=n=>{c.currentSort=n.target.value,B(1)},document.getElementById("type-select").onchange=n=>{c.activeType=n.target.value,document.querySelectorAll(".nav-link").forEach(r=>{r.classList.remove("active"),(r.dataset.filter===c.activeType||c.activeType===""&&r.dataset.filter==="all")&&r.classList.add("active")}),L(),B(1)},document.querySelectorAll(".nav-link").forEach(n=>{n.onclick=r=>{r.preventDefault(),document.querySelectorAll(".nav-link").forEach(l=>l.classList.remove("active")),n.classList.add("active");const i=n.dataset.filter;c.activeType=i==="all"?"":i,document.getElementById("type-select").value=c.activeType,L(),B(1)}}),document.getElementById("load-more-btn").onclick=()=>{B(c.currentPage+1,!0)},document.getElementById("modal-close-btn").onclick=N;const t=document.getElementById("detail-modal");t.onclick=n=>{n.target===t&&N()},document.querySelectorAll(".tab-btn, .tab").forEach(n=>{n.onclick=()=>{j(n.dataset.tab)}}),document.getElementById("clear-all-filters-btn").onclick=M}async function Z(){X(),k();try{const e=await w();if(e.length>0){const s=e[Math.floor(Math.random()*Math.min(5,e.length))];Y(s)}const a=await F();Q(a),b(e),document.getElementById("results-count").textContent="Trending Anime"}catch(e){console.error("Initialization error:",e),document.getElementById("anime-grid").innerHTML=`
      <div class="no-results" style="grid-column: 1/-1;">
        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--op-orange);"></i>
        <h3>Failed to initialize Animekin.</h3>
        <p>Could not connect to Jikan Anime API database. Please refresh the page.</p>
      </div>
    `,lucide.createIcons()}}window.onload=Z;
