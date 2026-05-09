/*
  Arquivo de API pública (modificado): adiciona validação de token pela URL do script,
  botão "Minha Localização" e ferramentas de desenho de vento (salva/carrega de /winds).
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
  authDomain: "html-15e80.firebaseapp.com",
  databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
  projectId: "html-15e80",
  storageBucket: "html-15e80.firebasestorage.app",
  messagingSenderId: "1068148640439",
  appId: "1:1068148640439:web:1ac651348e624f6be41b32",
  measurementId: "G-7E1VWN07GM"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Minimal collection adapter used by widget
const ReportCollection = {
  async getList() {
    const snap = await get(ref(db, "reports"));
    const val = snap.val();
    if (!val) return [];
    const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
    arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  },
  subscribe(cb) {
    const rref = ref(db, "reports");
    const unsub = onValue(rref, (snapshot) => {
      const val = snapshot.val();
      if (!val) return cb([]);
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      cb(arr);
    });
    return () => unsub();
  }
};

const room = { collection: () => ReportCollection };

// --------- New: token validation + client-side syncing + wind drawing + location button ---------
(function () {
  const API_BASE_URL = firebaseConfig.databaseURL.replace(/\/$/, "");
  let currentToken = null;
  let mapData = null;
  let userLocation = null;
  let allReports = [];

  function getTokenFromScriptURL() {
    const scripts = document.getElementsByTagName('script');
    const currentScript = scripts[scripts.length - 1];
    const scriptUrl = currentScript && currentScript.src ? currentScript.src : '';
    const urlParams = new URLSearchParams(scriptUrl.split('?')[1] || '');
    return urlParams.get('token');
  }

  async function validateToken(token) {
    try {
      const res = await fetch(`${API_BASE_URL}/tokens/${token}.json`);
      const data = await res.json();
      if (data && data !== null) {
        currentToken = token;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Erro ao validar token', e);
      return false;
    }
  }

  async function getReports() {
    try {
      const response = await fetch(`${API_BASE_URL}/reports.json`);
      const reports = await response.json();
      if (!reports) return [];
      const reportsArray = Object.entries(reports).map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return reportsArray;
    } catch (e) {
      throw new Error('Erro ao carregar dados');
    }
  }

  // Haversine distance
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function findNearbyReports(userLat, userLon, radiusKm = 5) {
    return allReports.filter(report => {
      if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') return false;
      const distance = calculateDistance(userLat, userLon, report.latitude, report.longitude);
      report.distance = distance;
      return distance <= radiusKm;
    }).sort((a, b) => a.distance - b.distance);
  }

  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalização não suportada'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => {
          let msg = 'Erro ao obter localização: ';
          switch(err.code) {
            case err.PERMISSION_DENIED: msg += 'Permissão negada'; break;
            case err.POSITION_UNAVAILABLE: msg += 'Localização indisponível'; break;
            case err.TIMEOUT: msg += 'Tempo esgotado'; break;
            default: msg += 'Erro desconhecido';
          }
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  function createLocationButton() {
    const button = document.createElement('button');
    button.innerHTML = '📍 Minha Localização';
    button.style.cssText = `
      position: absolute;
      top: 80px;
      right: 10px;
      z-index: 1000;
      background: #35a17b;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    button.onclick = async () => {
      try {
        button.innerHTML = '📍 Obtendo localização...';
        button.disabled = true;
        const location = await getUserLocation();
        mapData.map.setView([location.lat, location.lng], 14);
        if (mapData.userLocationMarker) mapData.userLocationMarker.remove();
        mapData.userLocationMarker = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            html: '<div style="background: #35a17b; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;">📍</div>',
            iconSize: [20,20],
            iconAnchor: [10,10]
          })
        }).addTo(mapData.markersLayer);
        mapData.userLocationMarker.bindPopup(`<strong>Sua Localização</strong><br>Lat: ${location.lat.toFixed(6)}<br>Lng: ${location.lng.toFixed(6)}<br><small>Precisão: ±${Math.round(location.accuracy)}m</small>`).openPopup();
        showNearbyNotifications(location.lat, location.lng);
      } catch (e) {
        alert(e.message);
      } finally {
        button.innerHTML = '📍 Minha Localização';
        button.disabled = false;
      }
    };
    return button;
  }

  function showNearbyNotifications(userLat, userLng) {
    const nearbyReports = findNearbyReports(userLat, userLng, 5);
    if (nearbyReports.length === 0) {
      alert('✅ Nenhum relatório próximo encontrado em um raio de 5km.');
      return;
    }
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      z-index: 2000;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h3 style="margin:0;color:#333;">📢 Relatórios Próximos</h3>
        <button id="closeNearby" style="background:none;border:none;font-size:18px;cursor:pointer">×</button>
      </div>
      <p style="margin:0 0 15px 0;color:#666;font-size:12px;">
        ${nearbyReports.length} relatório(s) encontrado(s) em um raio de 5km
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${nearbyReports.map(report => `
          <div style="border:1px solid #e0e0e0;border-radius:8px;padding:10px;background:#f9f9f9;">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:5px;">
              <strong style="flex:1">${report.resumoCurto || 'Sem título'}</strong>
              <span style="font-size:10px;color:#666;background:#e0e0e0;padding:2px 6px;border-radius:10px;">${report.distance.toFixed(1)}km</span>
            </div>
            <div style="font-size:11px;color:#666;">
              ${climaToIcon(report.clima)} ${report.clima} • 💧 ${report.riscoAlagamento || 'desconhecido'}
            </div>
            <div style="font-size:10px;color:#888;margin-top:5px;">${formatDate(report.createdAt)}</div>
            <button data-id="${report.id}" class="focusReportBtn" style="margin-top:8px;background:#35a17b;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;">Ver no Mapa</button>
          </div>
        `).join('')}
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeNearby').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.focusReportBtn').forEach(b => {
      b.addEventListener('click', (ev) => {
        const id = ev.currentTarget.getAttribute('data-id');
        focusOnReport(id);
      });
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  window.focusOnReport = function(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (report && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
      mapData.map.setView([report.latitude, report.longitude], 16);
      mapData.markersLayer.getLayers().forEach(layer => {
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng();
          if (latLng.lat === report.latitude && latLng.lng === report.longitude) {
            layer.openPopup();
          }
        }
      });
    }
    // remove any nearby modal
    document.querySelectorAll('div[style*="position: fixed"]').forEach(n => n.remove());
  };

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(resolve, 100);
      script.onerror = () => reject(new Error('Falha ao carregar Leaflet'));
      document.head.appendChild(script);
    });
  }

  function initMap() {
    if (!window.L) throw new Error('Leaflet não carregado');
    const map = L.map("clima-widget-map", { zoomControl: false }).setView([-14.2350, -51.9253], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "" }).addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    return { map, markersLayer, userLocationMarker: null };
  }

  function formatDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function climaToIcon(clima) {
    const icons = { "sol": "☀️", "chuva": "🌧️", "nublado": "☁️", "tempestade": "⛈️" };
    return icons[clima] || "🌤️";
  }
  function climaClass(clima) { const classes = { "sol":"sun","chuva":"rain","nublado":"cloud","tempestade":"storm"}; return classes[clima] || "cloud"; }
  function riscoClass(risco) { const classes = { "baixo":"risk-low","moderado":"risk-moderate","alto":"risk-high","crítico":"risk-critical"}; return classes[risco] || "risk-low"; }

  function updateMapMarkers(mapDataLocal, reports) {
    if (!mapDataLocal) return;
    mapDataLocal.markersLayer.clearLayers();
    const coords = [];
    reports.forEach(r => {
      if (typeof r.latitude === "number" && typeof r.longitude === "number") {
        const lat = r.latitude, lng = r.longitude;
        coords.push([lat,lng]);
        const icon = L.divIcon({ html: `<div class="map-emoji-icon">${climaToIcon(r.clima)}</div>`, iconSize:[24,24], iconAnchor:[12,12] });
        const marker = L.marker([lat,lng], { icon });
        const title = r.resumoCurto || (r.descricao || "").slice(0,80);
        marker.bindPopup(`<strong>${climaToIcon(r.clima)} ${title}</strong><br>${r.riscoAlagamento ? `Risco: ${r.riscoAlagamento}` : ""}<br><small>${formatDate(r.createdAt)}</small>`);
        marker.addTo(mapDataLocal.markersLayer);
      }
    });
    if (!coords.length) mapDataLocal.map.setView([-14.2350, -51.9253], 4);
    else if (coords.length === 1) mapDataLocal.map.setView(coords[0], 14);
    else mapDataLocal.map.fitBounds(L.latLngBounds(coords).pad(0.2));
  }

  function renderList(reports) {
    const listEl = document.getElementById("clima-widget-list") || document.getElementById("list");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!reports.length) { listEl.innerHTML = '<div class="clima-widget-empty">Nenhum relatório disponível.</div>'; return; }
    reports.forEach(r => {
      const card = document.createElement('div');
      card.className = 'clima-widget-card';
      card.innerHTML = `
        <div class="clima-widget-card-header">
          <div class="clima-widget-card-title">${r.resumoCurto || (r.descricao||'').slice(0,70)}</div>
          <div class="clima-widget-card-meta">${formatDate(r.createdAt)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="clima-widget-weather-chip ${climaClass(r.clima)}">${climaToIcon(r.clima)} <span style="text-transform:capitalize;margin-left:6px">${r.clima||'indef.'}</span></div>
          <div class="clima-widget-risk-chip ${riscoClass(r.riscoAlagamento)}">💧 ${r.riscoAlagamento||'desconhecido'}</div>
        </div>
        <div class="clima-widget-summary" style="margin-top:6px">${r.descricao||''}</div>
        ${r.condicoesCeu?`<div class="clima-widget-details">Céu: ${r.condicoesCeu}</div>`:''}
        ${r.relatorioCompleto?`<div class="clima-widget-details">${r.relatorioCompleto}</div>`:''}
        <div class="clima-widget-location" style="margin-top:6px">Localização: ${typeof r.latitude==='number'?`${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`:'Não informada'}</div>
      `;
      listEl.appendChild(card);
    });
  }

  // sync loop
  function startSync(mapDataLocal) {
    setInterval(async () => {
      try {
        const reports = await getReports();
        allReports = reports;
        renderList(reports);
        updateMapMarkers(mapDataLocal, reports);
        const badgeText = document.getElementById('clima-widget-badge-text') || document.getElementById('badgeText');
        if (badgeText) {
          const now = new Date().toLocaleTimeString('pt-BR');
          badgeText.textContent = `Atualizado • ${reports.length} relatórios • ${now}`;
        }
      } catch (e) {
        console.error('Erro na sincronização', e);
      }
    }, 5000);
  }

  // --- Wind drawing tools (public widget) ---
  function enableWindDrawing(map, markersLayer) {
    // insert controls above map DOM if present
    const container = document.querySelector('.clima-widget-container') || document.body;
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;margin:8px 0;align-items:center;';
    const drawBtn = document.createElement('button');
    drawBtn.textContent = 'Desenhar vento';
    drawBtn.style.cssText = 'padding:6px 10px;border-radius:8px;background:#2b7aef;color:#fff;border:none;cursor:pointer';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpar desenho';
    clearBtn.style.cssText = 'padding:6px 10px;border-radius:8px;background:#888;color:#fff;border:none;cursor:pointer';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar vento';
    saveBtn.style.cssText = 'padding:6px 10px;border-radius:8px;background:#1e7a4a;color:#fff;border:none;cursor:pointer';
    const hint = document.createElement('div');
    hint.textContent = 'Desenhe a direção do vento com o mouse (clique para iniciar, arraste e solte para terminar).';
    hint.style.fontSize='12px'; hint.style.color='#555';
    controls.appendChild(drawBtn); controls.appendChild(clearBtn); controls.appendChild(saveBtn); controls.appendChild(hint);
    // insert before map container
    const mapEl = document.getElementById('clima-widget-map') || document.getElementById('map') || document.getElementById('adminWindMap');
    if (mapEl && mapEl.parentNode) mapEl.parentNode.insertBefore(controls, mapEl);

    let drawing=false, drawPoints=[], previewLine=null;
    function createWindPolyline(latlngs) {
      const poly = L.polyline(latlngs, { color: "#2b7aef", weight:3, opacity:0.9, dashArray:"6 8" }).addTo(markersLayer);
      poly.options._isWind = true;
      return poly;
    }

    drawBtn.addEventListener('click', () => {
      drawing = !drawing;
      drawBtn.textContent = drawing ? 'Desenhar: ativo (clique para parar)' : 'Desenhar vento';
      if (!drawing && previewLine) { previewLine.remove(); previewLine=null; }
    });
    clearBtn.addEventListener('click', () => {
      drawPoints = [];
      if (previewLine) { previewLine.remove(); previewLine=null; }
      markersLayer.eachLayer(l => { if (l && l.options && l.options._isWind) markersLayer.removeLayer(l); });
    });

    map.on('mousedown', (ev) => { if (!drawing) return; drawPoints=[]; const latlng=ev.latlng; drawPoints.push([latlng.lat, latlng.lng]); if (previewLine) { previewLine.remove(); previewLine=null; } previewLine = L.polyline(drawPoints, {color:'#2b7aef',weight:3,opacity:0.8,dashArray:"6 8"}).addTo(map); });
    map.on('mousemove', (ev) => { if (!drawing || !previewLine) return; const latlng=ev.latlng; const last = drawPoints[drawPoints.length-1]; const dx = last?Math.abs(last[0]-latlng.lat)+Math.abs(last[1]-latlng.lng):0; if (dx>0.00005) { drawPoints.push([latlng.lat, latlng.lng]); previewLine.setLatLngs(drawPoints); } });
    map.on('mouseup', () => { if (!drawing) return; if (previewLine) previewLine.options._isWindPreview = true; });

    saveBtn.addEventListener('click', async () => {
      if (!drawPoints || drawPoints.length<2) { alert('Desenhe pelo menos dois pontos para representar a direção do vento.'); return; }
      try {
        const maxPoints = 40;
        const step = Math.max(1, Math.floor(drawPoints.length / maxPoints));
        const simplified = drawPoints.filter((_,i)=> i%step===0 || i===drawPoints.length-1);
        const windDoc = { path: simplified.map(p=>({lat:p[0], lng:p[1]})), createdAt: new Date().toISOString(), note: 'Desenho de vento salvo via widget público' };
        const windsRef = ref(db, "winds");
        const newRef = push(windsRef);
        await set(newRef, windDoc);
        const poly = createWindPolyline(simplified);
        poly.bindPopup(`<strong>Vento</strong><br>${simplified.length} pontos<br>${new Date(windDoc.createdAt).toLocaleString()}`);
        if (previewLine) { previewLine.remove(); previewLine=null; }
        drawPoints=[];
        alert('Desenho de vento salvo com sucesso.');
      } catch (e) { console.error('Erro ao salvar vento:', e); alert('Falha ao salvar desenho de vento.'); }
    });

    // subscribe to winds to show persistent drawings
    const windsRef = ref(db, 'winds');
    onValue(windsRef, (snap) => {
      const val = snap.val();
      markersLayer.eachLayer(l => { if (l && l.options && l.options._isWind) markersLayer.removeLayer(l); });
      if (!val) return;
      Object.entries(val).forEach(([k,v]) => {
        try {
          if (v && Array.isArray(v.path) && v.path.length) {
            const latlngs = v.path.map(pt=>[pt.lat, pt.lng]);
            const poly = L.polyline(latlngs, { color:"#2b7aef", weight:3, opacity:0.9, dashArray:"6 8" }).addTo(markersLayer);
            poly.options._isWind = true;
            poly.bindPopup(`<strong>Vento</strong><br>${latlngs.length} pontos<br>${v.createdAt?new Date(v.createdAt).toLocaleString():""}`);
          }
        } catch (e) { console.warn('Erro ao desenhar wind item', e); }
      });
    });
  }

  // initialize widget (token validated)
  async function initWidget() {
    const containerExists = !!document.querySelector('.clima-widget-container') || !!document.getElementById('clima-widget-map');
    // create minimal container if absent (same visual as before)
    if (!document.querySelector('.clima-widget-container')) {
      const container = document.createElement('div');
      container.className = 'clima-widget-container';
      const header = document.createElement('div'); header.className='clima-widget-header';
      header.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:16px;">🌧️</span><span>Monitor de Clima</span></div><div class="clima-widget-badge"><span class="clima-widget-dot"></span><span id="clima-widget-badge-text">Carregando...</span></div>`;
      const mapDiv = document.createElement('div'); mapDiv.id='clima-widget-map'; mapDiv.className='clima-widget-map';
      const listDiv = document.createElement('div'); listDiv.id='clima-widget-list'; listDiv.className='clima-widget-list';
      container.appendChild(header); container.appendChild(mapDiv); container.appendChild(listDiv);
      const bodyIsEmpty = !document.body.querySelector("main, #app, .content, .clima-widget-container, script");
      if (bodyIsEmpty) { document.body.innerHTML=''; document.body.appendChild(container); } else document.body.insertBefore(container, document.body.firstChild);
    }

    await loadLeaflet();
    mapData = initMap();
    // add location button
    const locationButton = createLocationButton();
    const mapEl = document.getElementById('clima-widget-map') || document.getElementById('map');
    if (mapEl) mapEl.appendChild(locationButton);
    // initial load
    const reports = await getReports();
    allReports = reports;
    renderList(reports);
    updateMapMarkers(mapData, reports);
    // enable wind drawing tools
    enableWindDrawing(mapData.map, mapData.markersLayer);
    startSync(mapData);
    const badgeText = document.getElementById('clima-widget-badge-text') || document.getElementById('badgeText');
    if (badgeText) badgeText.textContent = `Atualizado • ${reports.length} relatórios`;
  }

  // main init: validate token then init
  async function mainInit() {
    try {
      const badge = document.getElementById('clima-widget-badge-text') || document.getElementById('badgeText');
      if (badge) badge.textContent = 'Validando token...';
      const token = getTokenFromScriptURL();
      if (!token) throw new Error('Token não encontrado na URL do script');
      const ok = await validateToken(token);
      if (!ok) throw new Error(`Token "${token}" inválido`);
      if (badge) badge.textContent = 'Carregando mapa...';
      await initWidget();
    } catch (e) {
      console.error('Erro init widget:', e);
      const badge = document.getElementById('clima-widget-badge-text') || document.getElementById('badgeText');
      if (badge) badge.textContent = 'Erro';
      const listEl = document.getElementById('clima-widget-list') || document.getElementById('list');
      if (listEl) listEl.innerHTML = `<div class="clima-widget-empty" style="color:crimson">Erro: ${e.message}</div>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mainInit); else mainInit();

})();
