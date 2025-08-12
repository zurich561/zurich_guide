// /assets/js/map.js
// Leaflet-Initialisierung, Marker, Popups
export function initMap(elId, center, zoom=13){
  const map = L.map(elId, { scrollWheelZoom: true }).setView([center.lat, center.lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap-Mitwirkende'
  }).addTo(map);
  return map;
}

export function addPlacesToMap(map, places, options={}){
  places.forEach(p=>{
    const m = L.marker([p.coords.lat, p.coords.lng]).addTo(map);
    const rating = p.avgRating ? `${p.avgRating} (${p.ratingCount})` : '–';
    const img = p.images?.[0] || '';
    const link = options.linkTo === 'place' ? `./place.html?slug=${p.slug}` : `./map.html?focus=${p.id}`;
    const html = `
      <div class="popup">
        <img src="${img}" alt="${p.name}" width="200" height="120" style="border-radius:8px;display:block;margin-bottom:6px;object-fit:cover" />
        <strong>${p.name}</strong><br/>
        ★ ${rating} · ${p.priceLevel || ''}<br/>
        <a class="btn" style="display:inline-block;margin-top:6px" href="${link}">Details</a>
      </div>`;
    m.bindPopup(html);
  });
}

export function fitToPlaces(map, places){
  if (!places.length) return;
  const b = L.latLngBounds(places.map(p=>[p.coords.lat, p.coords.lng]));
  map.fitBounds(b, { padding:[30,30] });
}

export function focusPlace(map, place, { zoom=16 }={}){
  map.setView([place.coords.lat, place.coords.lng], zoom);
}