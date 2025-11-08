// innacri.js - Sistema completo de alertas ciudadanas

const CRIME_TYPES = [
    { id: 'robo', name: 'Robo', color: '#f59e0b', icon: '💰' },
    { id: 'asalto', name: 'Asalto', color: '#ef4444', icon: '🔪' },
    { id: 'estafa', name: 'Estafa', color: '#8b5cf6', icon: '📱' },
    { id: 'vandalismo', name: 'Vandalismo', color: '#6366f1', icon: '🔨' },
    { id: 'secuestro', name: 'Secuestro', color: '#dc2626', icon: '🚨' },
    { id: 'extorsion', name: 'Extorsión', color: '#7c3aed', icon: '📞' }
];

const SEVERITY_LEVELS = [
    { id: 1, name: 'Bajo', color: '#10b981' },
    { id: 2, name: 'Moderado', color: '#f59e0b' },
    { id: 3, name: 'Alto', color: '#ef4444' },
    { id: 4, name: 'Crítico', color: '#dc2626' },
    { id: 5, name: 'Emergencia', color: '#991b1b' }
];

const ZONAS = [
    'Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Zona 5', 'Zona 6',
    'Zona 7', 'Zona 8', 'Zona 9', 'Zona 10', 'Zona 11', 'Zona 12',
    'Zona 13', 'Zona 14', 'Zona 15', 'Zona 16', 'Zona 17', 'Zona 18',
    'Zona 19', 'Zona 21', 'Zona 24', 'Zona 25'
];

let map;
let locationPickerMap;
let markers = [];
let alerts = [];
let filters = { types: [], severity: [] };
let selectedCrimeType = '';
let heatLayer;
let selectedLocation = { lat: 14.6349, lng: -90.5069 };
let notificationsEnabled = false;
let filtersMinimized = false;
let userLocation = { lat: 14.6349, lng: -90.5069 };
let proximityCheckInterval = null;
let PROXIMITY_RADIUS_KM = 0.5; // Radio de proximidad en km

// ============================================
// INICIALIZACIÓN DEL MAPA PRINCIPAL
// ============================================
function initMap() {
    map = L.map('map').setView([14.6349, -90.5069], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    syncAlerts();
    updateMap();
    startProximityDetection();
    getUserLocationContinuous();
}

// ============================================
// LOCATION PICKER (Selector de Ubicación)
// ============================================
function initLocationPicker() {
    if (locationPickerMap) {
        locationPickerMap.remove();
    }

    locationPickerMap = L.map('locationPicker').setView([selectedLocation.lat, selectedLocation.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(locationPickerMap);

    locationPickerMap.on('moveend', function() {
        const center = locationPickerMap.getCenter();
        selectedLocation = { lat: center.lat, lng: center.lng };
        updateLocationInfo();
    });

    locationPickerMap.on('move', function() {
        const center = locationPickerMap.getCenter();
        selectedLocation = { lat: center.lat, lng: center.lng };
    });

    setTimeout(() => locationPickerMap.invalidateSize(), 100);
}

function updateLocationInfo() {
    document.getElementById('locationCoords').textContent = 
        'Lat: ' + selectedLocation.lat.toFixed(6) + ', Lng: ' + selectedLocation.lng.toFixed(6);
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                selectedLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                if (locationPickerMap) {
                    locationPickerMap.setView([selectedLocation.lat, selectedLocation.lng], 15);
                }
                updateLocationInfo();
                alert('📍 Ubicación actual obtenida correctamente');
            },
            function(error) {
                alert('No se pudo obtener tu ubicación. Usa el mapa para seleccionar manualmente.');
            }
        );
    } else {
        alert('Tu navegador no soporta geolocalización');
    }
}

// ============================================
// SINCRONIZACIÓN DE ALERTAS CON LOCALSTORAGE
// ============================================
function saveAlertsToStorage() {
    localStorage.setItem('innacri_alerts', JSON.stringify(alerts));
}

function loadAlertsFromStorage() {
    const stored = localStorage.getItem('innacri_alerts');
    if (stored) {
        alerts = JSON.parse(stored);
        return true;
    }
    return false;
}

function syncAlerts() {
    // Cargar alertas del almacenamiento
    if (!loadAlertsFromStorage()) {
        // Si no hay alertas almacenadas, generar de ejemplo
        generateSampleAlerts();
    }
    updateStats();
    updateMap();
}

// ============================================
// DETECCIÓN DE ALERTAS POR PROXIMIDAD
// ============================================
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function checkProximityAlerts() {
    const proximityAlerts = alerts.filter(alert => {
        if (alert.status !== 'approved') return false;
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            alert.lat, alert.lng
        );
        return distance <= PROXIMITY_RADIUS_KM;
    });

    if (proximityAlerts.length > 0) {
        const alert = proximityAlerts[0];
        showProximityNotification(alert);
    }
}

function showProximityNotification(alert, distance = null) {
    const displayDistance = distance ? `${(distance * 1000).toFixed(0)}m` : `menos de ${PROXIMITY_RADIUS_KM}km`;
    
    const notification = document.createElement('div');
    notification.className = 'push-notification show';
    notification.innerHTML = `
        <div class="notif-header">
            <div class="notif-title">
                ⚠️ ALERTA CERCANA
            </div>
            <button class="notif-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notif-body">
            <strong>${alert.typeIcon} ${alert.typeName}</strong><br>
            Ubicación: ${alert.zona}<br>
            Severidad: <span style="color: ${alert.severityColor}; font-weight: bold;">${alert.severityName}</span>
        </div>
        <div class="notif-meta">
            📍 A ${displayDistance} de tu ubicación
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 5000);
}

let simulationActive = false;
let lastSimulationIndex = 0;

function startNotificationSimulation() {
    const notifToggle = document.getElementById('notifToggle');
    
    if (simulationActive) {
        simulationActive = false;
        notifToggle.style.opacity = '1';
        console.log('❌ Simulación detenida');
        return;
    }
    
    simulationActive = true;
    notifToggle.style.opacity = '0.5';
    console.log('🔔 Simulación iniciada - Notificación cada 30 segundos');
    
    const simulateNotification = () => {
        if (!simulationActive || alerts.length === 0) return;
        
        const approvedAlerts = alerts.filter(a => a.status === 'approved');
        if (approvedAlerts.length === 0) {
            if (simulationActive) setTimeout(simulateNotification, 30000);
            return;
        }
        
        const alert = approvedAlerts[lastSimulationIndex % approvedAlerts.length];
        const randomDistance = (Math.random() * 0.5).toFixed(3);
        showProximityNotification(alert, parseFloat(randomDistance));
        lastSimulationIndex++;
        
        if (simulationActive) {
            setTimeout(simulateNotification, 30000);
        }
    };
    
    simulateNotification();
}

// Demo de notificación de proximidad (para testing)
function demoProximityNotification() {
    const demoAlert = {
        typeIcon: '💰',
        typeName: 'Robo',
        zona: 'Zona 5 - Centro Cívico',
        severityColor: '#ef4444',
        severityName: 'Alto'
    };
    showProximityNotification(demoAlert);
}

function startProximityDetection() {
    proximityCheckInterval = setInterval(() => {
        if (notificationsEnabled) {
            checkProximityAlerts();
        }
    }, 10000); // Revisar cada 10 segundos
}

// ============================================
// LOCALIZACIÓN DEL USUARIO
// ============================================
function getUserLocationContinuous() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            },
            function(error) {
                console.log('Geolocalización deshabilitada');
            },
            { enableHighAccuracy: false, maximumAge: 30000 }
        );
    }
}
function generateSampleAlerts() {
    alerts = [];
    const now = Date.now();

    for (let i = 0; i < 30; i++) {
        const type = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
        const severity = Math.floor(Math.random() * 5) + 1;
        const hoursAgo = Math.random() * 24;
        const statusRand = Math.random();
        let status = 'approved';
        if (statusRand < 0.2) status = 'pending';
        else if (statusRand < 0.3) status = 'rejected';

        alerts.push({
            id: i,
            type: type.id,
            typeName: type.name,
            typeIcon: type.icon,
            typeColor: type.color,
            severity: severity,
            severityName: SEVERITY_LEVELS[severity - 1].name,
            severityColor: SEVERITY_LEVELS[severity - 1].color,
            zona: ZONAS[Math.floor(Math.random() * ZONAS.length)],
            description: 'Reporte de ' + type.name.toLowerCase() + ' en la zona. ' + 
                        (Math.random() > 0.5 ? 'Situación bajo control.' : 'Requiere atención inmediata.'),
            lat: 14.6349 + (Math.random() - 0.5) * 0.15,
            lng: -90.5069 + (Math.random() - 0.5) * 0.15,
            timestamp: now - (hoursAgo * 3600000),
            verified: Math.random() > 0.3,
            reports: Math.floor(Math.random() * 10) + 1,
            status: status,
            reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
        });
    }

    saveAlertsToStorage();
    updateStats();
}

// ============================================
// FORMATEAR TIEMPO DINÁMICO
// ============================================
function getFormattedTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return minutes + 'min';
    } else if (hours < 24) {
        return hours + 'h';
    } else {
        return days + 'd';
    }
}

// ============================================
// ACTUALIZAR MAPA
// ============================================
function updateMap() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const filteredAlerts = alerts.filter(alert => {
        const typeMatch = filters.types.length === 0 || filters.types.includes(alert.type);
        const severityMatch = filters.severity.length === 0 || filters.severity.includes(alert.severity);
        const statusMatch = alert.status === 'approved';
        return typeMatch && severityMatch && statusMatch;
    });

    filteredAlerts.forEach(alert => {
        const timeFormatted = getFormattedTime(alert.timestamp);
        const hoursAgo = Math.floor((Date.now() - alert.timestamp) / 3600000);

        const icon = L.divIcon({
            html: '<div class="custom-marker" style="background: ' + alert.severityColor + ';">' +
                  alert.typeIcon +
                  '<div class="time-badge">' + timeFormatted + '</div>' +
                  '</div>',
            className: '',
            iconSize: [40, 40]
        });

        const marker = L.marker([alert.lat, alert.lng], { icon: icon }).addTo(map);
        
        marker.bindPopup(
            '<div style="min-width: 200px;">' +
            '<h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">' + alert.typeIcon + ' ' + alert.typeName + '</h3>' +
            '<p style="margin-bottom: 0.5rem; color: #6b7280;">' + alert.zona + '</p>' +
            '<div style="background: ' + alert.severityColor + '; color: white; display: inline-block; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; margin-bottom: 0.5rem;">' +
            alert.severityName +
            '</div>' +
            '<p style="margin-bottom: 0.5rem;">' + alert.description + '</p>' +
            '<div style="display: flex; gap: 1rem; font-size: 0.875rem; color: #6b7280;">' +
            '<span>📊 ' + alert.reports + ' reportes</span>' +
            '<span>⏰ Hace ' + timeFormatted + '</span>' +
            '</div>' +
            (alert.verified ? '<div style="color: #10b981; font-size: 0.875rem; margin-top: 0.5rem;">✓ Verificado</div>' : '') +
            '</div>'
        );

        markers.push(marker);
    });

    document.getElementById('alertCount').textContent = filteredAlerts.length + ' alertas activas';
    updateHeatmap(filteredAlerts);
}

// ============================================
// MAPA DE CALOR
// ============================================
function updateHeatmap(filteredAlerts) {
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    const heatData = filteredAlerts.map(alert => [
        alert.lat,
        alert.lng,
        alert.severity / 5
    ]);

    if (heatData.length > 0) {
        heatLayer = L.heatLayer(heatData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            gradient: {
                0.0: '#10b981',
                0.25: '#f59e0b',
                0.5: '#ef4444',
                1.0: '#991b1b'
            }
        }).addTo(map);
    }
}

// ============================================
// ACTUALIZACIÓN DE ESTADÍSTICAS
// ============================================
function updateStats() {
    const approvedAlerts = alerts.filter(a => a.status === 'approved').length;
    const pendingAlerts = alerts.filter(a => a.status === 'pending').length;
    const criticalAlerts = alerts.filter(a => a.severity >= 4 && a.status === 'approved').length;
    const verifiedAlerts = alerts.filter(a => a.verified && a.status === 'approved').length;

    if (document.getElementById('approvedCount')) {
        document.getElementById('approvedCount').textContent = approvedAlerts;
    }
    if (document.getElementById('pendingCount')) {
        document.getElementById('pendingCount').textContent = pendingAlerts;
    }
    if (document.getElementById('criticalCount')) {
        document.getElementById('criticalCount').textContent = criticalAlerts;
    }
    if (document.getElementById('verifiedCount')) {
        document.getElementById('verifiedCount').textContent = verifiedAlerts;
    }
}

// ============================================
// FUNCIONALIDAD DE RUTA SEGURA
// ============================================
function initSafeRoute() {
    if (document.getElementById('safeRouteView')) {
        document.getElementById('safeRouteView').innerHTML = '<div style="padding: 2rem; text-align: center;">' +
            '<h2>🛣️ Rutas Seguras</h2>' +
            '<p style="margin-top: 1rem; color: #6b7280;">Función en desarrollo - Pronto podrás planificar rutas seguras evitando zonas de riesgo</p>' +
            '</div>';
    }
}

// ============================================
// ANIMACIÓN DE CONTADORES
// ============================================
function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        let current = 0;
        const increment = Math.ceil(target / 30);
        
        const interval = setInterval(() => {
            current += increment;
            if (current >= target) {
                counter.textContent = target;
                clearInterval(interval);
            } else {
                counter.textContent = current;
            }
        }, 50);
    });
}

// ============================================
// TUTORIAL
// ============================================
function showTutorialIfNeeded() {
    const tutorialSeen = localStorage.getItem('innacri_tutorial_seen');
    if (!tutorialSeen && document.getElementById('tutorialOverlay')) {
        document.getElementById('tutorialOverlay').classList.add('active');
    }
}

function completeTutorial() {
    localStorage.setItem('innacri_tutorial_seen', 'true');
    if (document.getElementById('tutorialOverlay')) {
        document.getElementById('tutorialOverlay').classList.remove('active');
    }
}

function skipTutorial() {
    if (confirm('¿Seguro que quieres saltar el tutorial?')) {
        completeTutorial();
    }
}

// ============================================
// MINIMIZAR/EXPANDIR FILTROS
// ============================================
function toggleFilters() {
    const filtersSidebar = document.getElementById('filtersSidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleText = document.getElementById('toggleText');
    
    filtersMinimized = !filtersMinimized;
    
    if (filtersMinimized) {
        filtersSidebar.classList.add('minimized');
        if (toggleIcon) toggleIcon.textContent = '▶';
        if (toggleText) toggleText.textContent = 'Filtros';
    } else {
        filtersSidebar.classList.remove('minimized');
        if (toggleIcon) toggleIcon.textContent = '◀';
        if (toggleText) toggleText.textContent = 'Ocultar';
    }
}

// ============================================
// INICIALIZACIÓN DE UI
// ============================================
function initUI() {
    // Crime types para el formulario
    const crimeTypesHTML = CRIME_TYPES.map(type => 
        '<div class="crime-type-btn" data-type="' + type.id + '">' +
        '<div class="icon">' + type.icon + '</div>' +
        '<div class="name">' + type.name + '</div>' +
        '</div>'
    ).join('');
    if (document.getElementById('crimeTypes')) {
        document.getElementById('crimeTypes').innerHTML = crimeTypesHTML;
    }

    // Zonas para el selector
    const zonasHTML = ZONAS.map(zona => 
        '<option value="' + zona + '">' + zona + '</option>'
    ).join('');
    if (document.getElementById('zonaInput')) {
        document.getElementById('zonaInput').innerHTML += zonasHTML;
    }

    // Filtros por tipo
    const typeFiltersHTML = CRIME_TYPES.map(type => 
        '<div class="filter-option">' +
        '<input type="checkbox" id="filter-' + type.id + '" data-type="' + type.id + '">' +
        '<span>' + type.icon + '</span>' +
        '<span style="font-size: 0.875rem;">' + type.name + '</span>' +
        '</div>'
    ).join('');
    if (document.getElementById('typeFilters')) {
        document.getElementById('typeFilters').innerHTML = typeFiltersHTML;
    }

    // Filtros por severidad
    const severityFiltersHTML = SEVERITY_LEVELS.map(level => 
        '<div class="filter-option">' +
        '<input type="checkbox" id="filter-sev-' + level.id + '" data-severity="' + level.id + '">' +
        '<div style="width: 12px; height: 12px; border-radius: 50%; background: ' + level.color + ';"></div>' +
        '<span style="font-size: 0.875rem;">' + level.name + '</span>' +
        '</div>'
    ).join('');
    if (document.getElementById('severityFilters')) {
        document.getElementById('severityFilters').innerHTML = severityFiltersHTML;
    }

    // Event listeners para crime types
    document.querySelectorAll('.crime-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.crime-type-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedCrimeType = this.getAttribute('data-type');
        });
    });

    // Severity slider
    if (document.getElementById('severityInput')) {
        document.getElementById('severityInput').addEventListener('input', function() {
            const level = SEVERITY_LEVELS[this.value - 1];
            if (document.getElementById('severityLabel')) {
                document.getElementById('severityLabel').textContent = level.name;
            }
        });
    }

    // Location buttons
    const useMyLocation = document.getElementById('useMyLocation');
    if (useMyLocation) {
        useMyLocation.addEventListener('click', function() {
            document.querySelectorAll('.location-actions button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            getUserLocation();
        });
    }

    const selectOnMap = document.getElementById('selectOnMap');
    if (selectOnMap) {
        selectOnMap.addEventListener('click', function() {
            document.querySelectorAll('.location-actions button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            initLocationPicker();
        });
    }

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const mapElement = document.getElementById('map');
            if (mapElement) mapElement.style.display = 'none';
            document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
            const filtersSidebar = document.getElementById('filtersSidebar');
            if (filtersSidebar) filtersSidebar.style.display = 'none';
            const reportBtn = document.getElementById('reportBtn');
            if (reportBtn) reportBtn.style.display = 'none';

            if (view === 'map') {
                if (mapElement) mapElement.style.display = 'block';
                if (filtersSidebar) filtersSidebar.style.display = 'block';
                if (reportBtn) reportBtn.style.display = 'flex';
                setTimeout(() => map.invalidateSize(), 100);
            } else {
                const viewElement = document.getElementById(view + 'View');
                if (viewElement) viewElement.classList.add('active');
            }
        });
    });

    // Report modal
    const reportBtn = document.getElementById('reportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) {
                modal.classList.add('active');
                initLocationPicker();
            }
        });
    }

    const heroReportBtn = document.getElementById('heroReportBtn');
    if (heroReportBtn) {
        heroReportBtn.addEventListener('click', function() {
            const btn = document.getElementById('reportBtn');
            if (btn) btn.click();
        });
    }

    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) modal.classList.remove('active');
        });
    }

    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    }

    // Report form submission
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!selectedCrimeType) {
                alert('Por favor selecciona un tipo de crimen');
                return;
            }

            const severity = parseInt(document.getElementById('severityInput').value);
            const zona = document.getElementById('zonaInput').value;
            const description = document.getElementById('descriptionInput').value;

            if (!zona || !description) {
                alert('Por favor completa todos los campos');
                return;
            }

            const type = CRIME_TYPES.find(t => t.id === selectedCrimeType);
            const newAlert = {
                id: alerts.length,
                type: selectedCrimeType,
                typeName: type.name,
                typeIcon: type.icon,
                typeColor: type.color,
                severity: severity,
                severityName: SEVERITY_LEVELS[severity - 1].name,
                severityColor: SEVERITY_LEVELS[severity - 1].color,
                zona: zona,
                description: description,
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                timestamp: Date.now(),
                verified: false,
                reports: 1,
                status: 'pending',
                reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
            };

            alerts.unshift(newAlert);
            saveAlertsToStorage();

            const modal = document.getElementById('reportModal');
            if (modal) modal.classList.remove('active');
            if (reportForm) reportForm.reset();
            selectedCrimeType = '';
            document.querySelectorAll('.crime-type-btn').forEach(b => b.classList.remove('selected'));

            alert('¡Reporte enviado! Será revisado por nuestro equipo de moderación antes de publicarse.');
        });
    }

    // Filters
    document.querySelectorAll('#typeFilters input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const type = this.getAttribute('data-type');
            if (this.checked) {
                filters.types.push(type);
            } else {
                filters.types = filters.types.filter(t => t !== type);
            }
            updateMap();
        });
    });

    document.querySelectorAll('#severityFilters input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const severity = parseInt(this.getAttribute('data-severity'));
            if (this.checked) {
                filters.severity.push(severity);
            } else {
                filters.severity = filters.severity.filter(s => s !== severity);
            }
            updateMap();
        });
    });

    const clearFilters = document.getElementById('clearFilters');
    if (clearFilters) {
        clearFilters.addEventListener('click', function() {
            filters = { types: [], severity: [] };
            document.querySelectorAll('#typeFilters input, #severityFilters input').forEach(cb => {
                cb.checked = false;
            });
            updateMap();
        });
    }

    // Toggle filters button
    const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener('click', toggleFilters);
    }

    // Demo notification button
    const demoNotifBtn = document.getElementById('demoNotifBtn');
    if (demoNotifBtn) {
        demoNotifBtn.addEventListener('click', demoProximityNotification);
    }
}

// ============================================
// INICIALIZACIÓN AL CARGAR
// ============================================
window.addEventListener('load', function() {
    if (document.getElementById('map')) {
        initMap();
    }
    initUI();
    initSafeRoute();
    showTutorialIfNeeded();
    setTimeout(animateCounters, 500);
});
