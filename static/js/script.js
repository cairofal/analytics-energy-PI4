let map;
let currentRegion = null;
let regionData = {};

// Inicializar mapa
function initMap() {
    map = L.map('brazil-map').setView([-15.7801, -47.9292], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    loadRegions();
}

// Carregar regiões do Brasil
async function loadRegions() {
    try {
        const response = await fetch('/api/regions');
        const regions = await response.json();
        
        for (const [regionName, regionInfo] of Object.entries(regions)) {
            const circle = L.circle(regionInfo.center, {
                color: '#3498db',
                fillColor: '#2980b9',
                fillOpacity: 0.3,
                radius: 300000
            }).addTo(map);
            
            circle.bindPopup(`<b>${regionName}</b><br>Clique para detalhes`);
            
            circle.on('click', function() {
                loadRegionData(regionName);
            });
            
            // Adicionar tooltip
            circle.bindTooltip(regionName, {
                permanent: false,
                direction: 'center',
                className: 'region-tooltip'
            });
        }
    } catch (error) {
        console.error('Erro ao carregar regiões:', error);
    }
}

// Carregar dados da região
async function loadRegionData(regionName) {
    try {
        currentRegion = regionName;
        const response = await fetch(`/api/region/${regionName}`);
        regionData = await response.json();
        
        showRegionInfo();
        updateCharts();
    } catch (error) {
        console.error('Erro ao carregar dados da região:', error);
    }
}

// Mostrar informações da região
function showRegionInfo() {
    document.getElementById('welcome-message').classList.add('hidden');
    document.getElementById('region-info').classList.remove('hidden');
    document.getElementById('region-name').textContent = `Região ${currentRegion}`;
    
    // Atualizar métricas
    const current = regionData.current_data;
    document.getElementById('solar-potential').textContent = `${current.solar_potential.toFixed(1)}%`;
    document.getElementById('wind-potential').textContent = `${current.wind_potential.toFixed(1)}%`;
    document.getElementById('hydro-potential').textContent = `${current.hydro_potential.toFixed(1)}%`;
}

// Atualizar gráficos
function updateCharts() {
    updateCurrentChart();
    updateHistoricalChart();
    updatePredictionsChart();
    updateRecommendations();
}

// Gráfico atual
function updateCurrentChart() {
    const current = regionData.current_data;
    const energyData = [
        current.energy_hidrelétrica,
        current.energy_termelétrica,
        current.energy_eólica,
        current.energy_solar,
        current.energy_nuclear
    ];
    
    const layout = {
        title: 'Distribuição Atual de Energia (GWh)',
        showlegend: true
    };
    
    Plotly.newPlot('current-chart', [{
        values: energyData,
        labels: ['Hidrelétrica', 'Termelétrica', 'Eólica', 'Solar', 'Nuclear'],
        type: 'pie',
        marker: {
            colors: ['#2196f3', '#f44336', '#4caf50', '#ffeb3b', '#9c27b0']
        }
    }], layout);
}

// Gráfico histórico
function updateHistoricalChart() {
    const historical = regionData.historical;
    
    const years = historical.map(d => d.year);
    const hydro = historical.map(d => d.energy_hidrelétrica);
    const thermal = historical.map(d => d.energy_termelétrica);
    const wind = historical.map(d => d.energy_eólica);
    const solar = historical.map(d => d.energy_solar);
    const nuclear = historical.map(d => d.energy_nuclear);
    
    const trace1 = { x: years, y: hydro, name: 'Hidrelétrica', stackgroup: 'one' };
    const trace2 = { x: years, y: thermal, name: 'Termelétrica', stackgroup: 'one' };
    const trace3 = { x: years, y: wind, name: 'Eólica', stackgroup: 'one' };
    const trace4 = { x: years, y: solar, name: 'Solar', stackgroup: 'one' };
    const trace5 = { x: years, y: nuclear, name: 'Nuclear', stackgroup: 'one' };
    
    const layout = {
        title: 'Evolução do Mix Energético (GWh)',
        xaxis: { title: 'Ano' },
        yaxis: { title: 'Energia (GWh)' }
    };
    
    Plotly.newPlot('historical-chart', [trace1, trace2, trace3, trace4, trace5], layout);
}

// Gráfico de previsões
function updatePredictionsChart() {
    const predictions = regionData.predictions;
    
    const years = predictions.map(d => d.year);
    const solar = predictions.map(d => d.solar);
    const eolica = predictions.map(d => d.eolica);
    const hidro = predictions.map(d => d.hidreletrica);
    
    const trace1 = { x: years, y: solar, name: 'Solar', type: 'bar' };
    const trace2 = { x: years, y: eolica, name: 'Eólica', type: 'bar' };
    const trace3 = { x: years, y: hidro, name: 'Hidrelétrica', type: 'bar' };
    
    const layout = {
        title: 'Previsão de Expansão de Renováveis (GWh)',
        xaxis: { title: 'Ano' },
        yaxis: { title: 'Energia (GWh)' },
        barmode: 'stack'
    };
    
    Plotly.newPlot('predictions-chart', [trace1, trace2, trace3], layout);
}

// Atualizar recomendações
function updateRecommendations() {
    const container = document.getElementById('recommendations-list');
    container.innerHTML = '';
    
    regionData.recommendations.forEach(rec => {
        const div = document.createElement('div');
        div.className = `recommendation-item ${rec.priority}`;
        div.innerHTML = `
            <h4>${rec.type.toUpperCase()} - Prioridade ${rec.priority}</h4>
            <p><strong>${rec.message}</strong></p>
            <p>${rec.suggestion}</p>
        `;
        container.appendChild(div);
    });
}

// Sistema de abas
function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    const tabButtons = document.getElementsByClassName('tab-button');
    
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Atualizar previsões
async function updatePredictions() {
    const targetYear = document.getElementById('target-year').value;
    
    try {
        const response = await fetch('/api/predict-transition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                region: currentRegion,
                year: parseInt(targetYear)
            })
        });
        
        const prediction = await response.json();
        
        // Atualizar interface com nova previsão
        alert(`Previsão para ${targetYear}:\nSolar: ${prediction.solar_potential.toFixed(0)} GWh\nEólica: ${prediction.wind_potential.toFixed(0)} GWh\nHidrelétrica: ${prediction.hydro_potential.toFixed(0)} GWh`);
        
    } catch (error) {
        console.error('Erro ao atualizar previsões:', error);
    }
}

// Inicializar aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});