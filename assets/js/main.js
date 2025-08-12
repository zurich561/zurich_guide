// /assets/js/main.js
// Daten laden, State & UI-Utilities, Filter/Sort/Pagination, Ratings, Suche, JSON-LD
export async function boot(){
  const [cities, categories, places, reviews] = await Promise.all([
    fetch('./data/cities.json').then(r=>r.json()),
    fetch('./data/categories.json').then(r=>r.json()),
    fetch('./data/places.json').then(r=>r.json()),
    fetch('./data/reviews.json').then(r=>r.json())
  ]);

  // merge local reviews
  const local = JSON.parse(localStorage.getItem('reviews_local')||'[]');
  const allReviews = [...reviews, ...local];

  // attach reviews to places
  const byPlace = new Map();
  allReviews.forEach(r=>{
    const arr = byPlace.get(r.placeId) || [];
    arr.push(r);
    byPlace.set(r.placeId, arr);
  });

  places.forEach(p=>{
    const r = byPlace.get(p.id) || [];
    p._allReviews = r;
    const avg = r.length ? r.reduce((s,a)=>s+a.rating,0)/r.length : 0;
    p.avgRating = Number(avg.toFixed(1));
    p.ratingCount = r.length;
    p.categorySlug = categories.find(c=>c.id===p.categoryId)?.slug || '';
  });

  return { data: { cities, categories, places, reviews: allReviews } };
}

// Elements
export function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (v == null) continue;
    if (k==='class') n.className = v;
    else if (k==='style') n.setAttribute('style', v);
    else n.setAttribute(k, v);
  }
  for (const c of children){
    if (c == null) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}

export function starHTML(avg=0){
  const s = Math.round((avg||0)*2)/2; // halves
  const full = Math.floor(s);
  const half = s - full >= .5;
  const empty = 5 - full - (half?1:0);
  return `<span class="stars">${'★'.repeat(full)}${half?'☆':''}${'·'.repeat(empty)}</span> <span aria-hidden="true">${avg?.toFixed?.(1)??'0.0'}</span>`;
}

export function ratingHistogram(revs){
  const h={1:0,2:0,3:0,4:0,5:0};
  revs.forEach(r=>{h[r.rating] = (h[r.rating]||0)+1;});
  return h;
}

// Search with debounce
let _debTimer;
function debounce(fn, ms){ return (...a)=>{ clearTimeout(_debTimer); _debTimer=setTimeout(()=>fn(...a),ms);} }
export function initGlobalSearch(){
  const form = document.getElementById('global-search');
  if (!form) return;
  const input = form.querySelector('input[type="search"]');
  const suggest = form.querySelector('.suggest');

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const q = input.value.trim();
    if (q) location.href = `./category.html?c=&q=${encodeURIComponent(q)}&sort=relevance&page=1`;
  });

  input.addEventListener('input', debounce(async ()=>{
    const q = input.value.trim().toLowerCase();
    if (!q){ suggest.style.display='none'; suggest.innerHTML=''; return; }
    const data = await boot().then(r=>r.data); // note: lightweight, cached by browser
    const matches = data.places.filter(p=>{
      return [p.name, p.description, p.short, p.neighborhood, ...(p.tags||[])].join(' ')
        .toLowerCase().includes(q);
    }).slice(0,8);
    suggest.innerHTML = matches.map(m=>`<a href="./place.html?slug=${m.slug}">${m.name}</a>`).join('');
    suggest.style.display = matches.length ? 'block' : 'none';
  }, 250));

  document.addEventListener('click', (e)=>{
    if (!form.contains(e.target)){ suggest.style.display='none'; }
  });
}

// Rendering helpers
export function renderCategoryCards($root, categories){
  categories.forEach(c=>{
    const img = `./assets/img/category/${c.slug}.jpg`;
    $root.append(
      el('article',{class:'card'},
        el('img',{src:img,alt:c.name,loading:'lazy',width:360,height:220}),
        el('div',{class:'body'},
          el('div',{class:'title'}, c.name),
          el('a',{class:'btn',href:`./category.html?c=${c.slug}&sort=relevance&page=1`},'Anzeigen')
        )
      )
    );
  });
}

export function renderHighlightList($root, places){
  places.forEach(p=>{
    $root.append(
      el('article',{class:'list-card'},
        el('img',{src:p.images[0], alt:p.name, loading:'lazy', width:320, height:200}),
        el('div',{class:'list-card-body'},
          el('h3',{}, el('a',{href:`./place.html?slug=${p.slug}`}, p.name)),
          el('div',{class:'meta'}, `${starHTML(p.avgRating)} (${p.ratingCount}) · ${p.priceLevel}`),
          el('p',{}, p.short)
        )
      )
    );
  });
}

// Query state
export function queryState(){
  const p = new URLSearchParams(location.search);
  return Object.fromEntries(p.entries());
}
export function setQueryState(obj){
  const p = new URLSearchParams(obj);
  history.replaceState(null,'',`?${p.toString()}`);
}

// Filter/Sort/Paginate
export function applyCategoryState(data, state){
  const q = (state.q||'').toLowerCase();
  let items = data.places.filter(p=> p.cityId === data.cities[0].id);

  if (state.c){
    const cat = data.categories.find(c=>c.slug===state.c);
    if (cat) items = items.filter(p=>p.categoryId===cat.id);
  }

  if (q){
    items = items.filter(p=>{
      const text = [p.name,p.short,p.description,p.neighborhood,...(p.tags||[])].join(' ').toLowerCase();
      return text.includes(q);
    });
  }

  if (state.price){
    items = items.filter(p => p.priceLevel === state.price);
  }
  if (state.stars){
    items = items.filter(p => (p.avgRating||0) >= Number(state.stars));
  }
  if (state.openNow==='1'){
    items = items.filter(p => p.isOpenNow);
  }
  if (state.indoorOutdoor){
    items = items.filter(p => (p.indoorOutdoor||'').toLowerCase() === state.indoorOutdoor);
  }
  if (state.neighborhood){
    const n = state.neighborhood.toLowerCase();
    items = items.filter(p => (p.neighborhood||'').toLowerCase().includes(n));
  }
  if (state.tags){
    const t = state.tags.toLowerCase();
    items = items.filter(p => (p.tags||[]).some(x=>x.toLowerCase().includes(t)));
  }

  const priceNum = p => (p.priceLevel||'').length || 0;

  switch (state.sort){
    case 'rating': items.sort((a,b)=>(b.avgRating||0)-(a.avgRating||0)); break;
    case 'popularity': items.sort((a,b)=>(b.ratingCount||0)-(a.ratingCount||0)); break;
    case 'priceAsc': items.sort((a,b)=> priceNum(a)-priceNum(b)); break;
    case 'priceDesc': items.sort((a,b)=> priceNum(b)-priceNum(a)); break;
    default: // relevance: simple score
      if (q){
        const kw = q.split(/\s+/).filter(Boolean);
        const score = p => kw.reduce((s,k)=> s + (JSON.stringify(p).toLowerCase().includes(k)?1:0), 0) + (p.avgRating||0)/5;
        items.sort((a,b)=> score(b)-score(a));
      } else {
        items.sort((a,b)=> (b.avgRating||0)-(a.avgRating||0));
      }
  }

  return { items, total: items.length };
}

export function paginate(items, page=1, size=10){
  const pages = Math.max(1, Math.ceil(items.length/size));
  const p = Math.min(Math.max(1,page), pages);
  const start = (p-1)*size;
  const pageItems = items.slice(start, start+size);
  return { pageItems, page: p, pages };
}

// Geo
export function metersBetween(a, b){
  const toRad = d => d*Math.PI/180;
  const R=6371000;
  const dLat = toRad(b.lat-a.lat);
  const dLng = toRad(b.lng-a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
export function formatDistance(m){
  return m<1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
}

// Open now (simple)
export function openStatusToday(place){
  try{
    const day = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
    const oh = place.openingHours?.[day];
    if (!oh || oh==='closed') return false;
    // format "08:00-18:00"
    const [s,e] = oh.split('-');
    const now = new Date();
    const toM = t=>{ const [H,M] = t.split(':').map(Number); return H*60+M; };
    const cur = now.getHours()*60+now.getMinutes();
    return cur >= toM(s) && cur <= toM(e);
  }catch{return place.isOpenNow}
}

// JSON-LD
export function jsonLDForPlace(p){
  return {
    "@context":"https://schema.org",
    "@type": "LocalBusiness",
    "name": p.name,
    "image": p.images,
    "address": p.address,
    "url": location.href,
    "telephone": p.phone || undefined,
    "aggregateRating": p.ratingCount ? {
      "@type": "AggregateRating",
      "ratingValue": p.avgRating,
      "reviewCount": p.ratingCount
    } : undefined
  };
}