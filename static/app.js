/* ==========================================================================
   FarmAssist AI - Frontend JavaScript Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    const locationInput = document.getElementById('farmer-location');
    const cropSelect = document.getElementById('farmer-crop');
    
    // File Upload Elements
    const dropzone = document.getElementById('crop-image-dropzone');
    const imageInput = document.getElementById('crop-image-input');
    const uploadPlaceholder = document.getElementById('upload-placeholder-content');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const btnAnalyzeHealth = document.getElementById('btn-analyze-health');
    
    // Loader Elements
    const healthLoader = document.getElementById('health-loader');
    const healthResults = document.getElementById('health-results');
    const weatherLoader = document.getElementById('weather-loader');
    const weatherResults = document.getElementById('weather-results');
    const marketLoader = document.getElementById('market-loader');
    const marketResults = document.getElementById('market-results');
    
    // Sync Buttons
    const btnSyncWeather = document.getElementById('btn-sync-weather');
    const btnSyncMarket = document.getElementById('btn-sync-market');

    // Tabs
    const tabDiagnosisBtn = document.getElementById('tab-diagnosis-btn');
    const tabTreatmentBtn = document.getElementById('tab-treatment-btn');
    const tabDiagnosisContent = document.getElementById('tab-diagnosis-content');
    const tabTreatmentContent = document.getElementById('tab-treatment-content');

    // Chart Instance Holder
    let marketChartInstance = null;

    // Selected File Holder
    let selectedImageFile = null;

    // ==========================================================================
    // 1. Theme Toggle Logic
    // ==========================================================================
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
        // Redraw chart if exists to match theme colors
        if (marketChartInstance) {
            updateChartTheme();
        }
    });

    // ==========================================================================
    // 2. Drag & Drop File Upload Handlers
    // ==========================================================================
    dropzone.addEventListener('click', () => {
        if (!selectedImageFile) {
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag-over styling
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-active');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        selectedImageFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadPlaceholder.style.display = 'none';
            previewContainer.style.display = 'block';
            btnAnalyzeHealth.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUploadZone();
    });

    function resetUploadZone() {
        selectedImageFile = null;
        imageInput.value = '';
        imagePreview.src = '';
        previewContainer.style.display = 'none';
        uploadPlaceholder.style.display = 'block';
        btnAnalyzeHealth.disabled = true;
        healthResults.style.display = 'none';
    }

    // ==========================================================================
    // 3. Tab Navigation Logic
    // ==========================================================================
    tabDiagnosisBtn.addEventListener('click', () => {
        tabDiagnosisBtn.classList.add('active');
        tabTreatmentBtn.classList.remove('active');
        tabDiagnosisContent.style.display = 'flex';
        tabTreatmentContent.style.display = 'none';
    });

    tabTreatmentBtn.addEventListener('click', () => {
        tabTreatmentBtn.classList.add('active');
        tabDiagnosisBtn.classList.remove('active');
        tabDiagnosisContent.style.display = 'none';
        tabTreatmentContent.style.display = 'flex';
    });

    // ==========================================================================
    // 4. API Core Integration Functions
    // ==========================================================================

    // Agent 1 & 3: Crop Health Diagnostic
    btnAnalyzeHealth.addEventListener('click', async () => {
        if (!selectedImageFile) return;

        // Reset display
        healthResults.style.display = 'none';
        healthLoader.style.display = 'flex';
        btnAnalyzeHealth.disabled = true;

        const formData = new FormData();
        formData.append('image', selectedImageFile);

        try {
            const response = await fetch('/api/analyze-crop', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('API failure');
            
            const data = await response.json();
            renderHealthResults(data);
        } catch (error) {
            console.error('Error analyzing crop health:', error);
            alert('Failed to analyze image. Please try again.');
        } finally {
            healthLoader.style.display = 'none';
            btnAnalyzeHealth.disabled = false;
        }
    });

    function renderHealthResults(data) {
        // Diagnosis Card Elements
        document.getElementById('detected-disease').textContent = data.diagnosis.disease_name;
        document.getElementById('detected-crop').textContent = data.diagnosis.crop_type;
        
        const confidenceBadge = document.getElementById('health-confidence');
        confidenceBadge.textContent = `${data.diagnosis.confidence} Confidence`;
        
        if (data.diagnosis.has_disease) {
            confidenceBadge.className = 'badge badge-alert';
        } else {
            confidenceBadge.className = 'badge';
            confidenceBadge.style.backgroundColor = 'var(--primary-glow)';
            confidenceBadge.style.color = 'var(--primary-green)';
        }

        document.getElementById('diagnosis-explanation').textContent = data.diagnosis.explanation;

        // Symptoms list
        const symptomsList = document.getElementById('symptoms-list');
        symptomsList.innerHTML = '';
        data.diagnosis.symptoms.forEach(symptom => {
            const li = document.createElement('li');
            li.textContent = symptom;
            symptomsList.appendChild(li);
        });

        // Treatments tabs
        const organicList = document.getElementById('organic-treatments');
        organicList.innerHTML = '';
        data.treatment.organic_treatments.forEach(t => {
            const li = document.createElement('li');
            li.textContent = t;
            organicList.appendChild(li);
        });

        const chemicalList = document.getElementById('chemical-treatments');
        chemicalList.innerHTML = '';
        data.treatment.chemical_treatments.forEach(t => {
            const li = document.createElement('li');
            li.textContent = t;
            chemicalList.appendChild(li);
        });

        const preventiveList = document.getElementById('preventive-measures');
        preventiveList.innerHTML = '';
        data.treatment.preventive_measures.concat(data.treatment.best_practices).forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            preventiveList.appendChild(li);
        });

        // Show Results, trigger click on default tab
        healthResults.style.display = 'block';
        tabDiagnosisBtn.click();
    }

    // Agent 2: Weather Risk Guard
    async function syncWeatherRisk() {
        const location = locationInput.value || 'California, USA';
        const crop = cropSelect.value || 'Tomato';

        weatherResults.style.opacity = '0.3';
        weatherLoader.style.display = 'flex';

        try {
            const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&crop=${encodeURIComponent(crop)}`);
            if (!response.ok) throw new Error('API failure');
            
            const data = await response.json();
            renderWeatherResults(data);
        } catch (error) {
            console.error('Error fetching weather:', error);
        } finally {
            weatherLoader.style.display = 'none';
            weatherResults.style.opacity = '1';
        }
    }

    function renderWeatherResults(data) {
        // Alerts
        const alertsContainer = document.getElementById('weather-alerts');
        alertsContainer.innerHTML = '';

        if (data.risks.length === 0) {
            alertsContainer.innerHTML = `
                <div class="weather-alert weather-alert-medium" style="background: var(--primary-glow); border-color: rgba(16, 185, 129, 0.2)">
                    <div class="alert-icon"><i class="fa-solid fa-cloud-sun text-organic"></i></div>
                    <div class="alert-details">
                        <h4 style="color: var(--primary-green)">No High Weather Risks Detected</h4>
                        <p>Favorable weather forecast ahead for your ${data.crop} crop. Keep monitoring daily updates.</p>
                    </div>
                </div>
            `;
        } else {
            data.risks.forEach(risk => {
                const isHigh = risk.risk_level.toLowerCase() === 'high';
                const alertDiv = document.createElement('div');
                alertDiv.className = `weather-alert ${isHigh ? 'weather-alert-high' : 'weather-alert-medium'}`;
                
                alertDiv.innerHTML = `
                    <div class="alert-icon">
                        <i class="fa-solid ${isHigh ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
                    </div>
                    <div class="alert-details">
                        <h4>${risk.title} (${risk.risk_level} Risk)</h4>
                        <p>${risk.description}</p>
                        <div class="alert-rec">
                            <i class="fa-solid fa-hand-holding-hand"></i> Advice: ${risk.recommendation}
                        </div>
                    </div>
                `;
                alertsContainer.appendChild(alertDiv);
            });
        }

        // 7-day forecast
        const forecastRow = document.getElementById('forecast-row');
        forecastRow.innerHTML = '';

        data.forecast.forEach(f => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'forecast-day';
            
            let iconClass = 'fa-cloud';
            const cond = f.condition.toLowerCase();
            if (cond.includes('sunny') || cond.includes('clear')) iconClass = 'fa-sun';
            else if (cond.includes('rain') || cond.includes('showers')) iconClass = 'fa-cloud-showers-heavy';
            else if (cond.includes('storm') || cond.includes('thunder')) iconClass = 'fa-cloud-bolt';
            
            dayDiv.innerHTML = `
                <span class="forecast-name">${f.day.substring(0,3)}</span>
                <i class="fa-solid ${iconClass} forecast-icon"></i>
                <div class="forecast-temp">
                    <span>${f.temp_high}°</span>
                    <span class="forecast-temp-low">${f.temp_low}°</span>
                </div>
            `;
            forecastRow.appendChild(dayDiv);
        });
    }

    // Agent 4: Market Intelligence
    async function syncMarketIntel() {
        const crop = cropSelect.value || 'Tomato';
        const location = locationInput.value || 'California, USA';

        marketResults.style.opacity = '0.3';
        marketLoader.style.display = 'flex';

        try {
            const response = await fetch(`/api/market?crop=${encodeURIComponent(crop)}&location=${encodeURIComponent(location)}`);
            if (!response.ok) throw new Error('API failure');
            
            const data = await response.json();
            renderMarketResults(data);
        } catch (error) {
            console.error('Error fetching market details:', error);
        } finally {
            marketLoader.style.display = 'none';
            marketResults.style.opacity = '1';
        }
    }

    function renderMarketResults(data) {
        // Price Details
        const isUSD = data.currency.toUpperCase() === 'USD';
        const symbol = isUSD ? '$' : `${data.currency} `;
        document.getElementById('market-current-price').textContent = `${symbol}${data.current_avg_price.toFixed(2)}`;
        document.getElementById('market-unit').textContent = `per ${data.unit}`;

        // Insights Box
        document.getElementById('market-insights-text').textContent = data.market_insights;

        // Dynamic Trend Badging
        const trendIndicator = document.getElementById('market-trend-indicator');
        const lastHist = data.six_month_trend[data.six_month_trend.length - 1].price;
        const lastForecast = data.three_month_forecast[data.three_month_forecast.length - 1].price;
        
        if (lastForecast >= lastHist) {
            trendIndicator.className = 'trend-badge positive';
            trendIndicator.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> Forecast Bullish';
        } else {
            trendIndicator.className = 'trend-badge negative';
            trendIndicator.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i> Forecast Bearish';
        }

        // Nearby Markets Table/List
        const marketsList = document.getElementById('nearby-markets-list');
        marketsList.innerHTML = '';
        data.nearby_markets.forEach(m => {
            const item = document.createElement('div');
            item.className = 'market-item';
            item.innerHTML = `
                <div class="market-info">
                    <h4>${m.market_name}</h4>
                    <p><i class="fa-solid fa-route"></i> ${m.distance_km} km away</p>
                </div>
                <div class="market-price">
                    <span class="m-price">${symbol}${m.current_price.toFixed(2)}</span>
                    <span class="m-price-unit">per ${data.unit}</span>
                </div>
            `;
            marketsList.appendChild(item);
        });

        // Initialize Chart
        renderChart(data);
    }

    function renderChart(data) {
        const ctx = document.getElementById('marketChart').getContext('2d');
        
        // Destruct previous chart instance
        if (marketChartInstance) {
            marketChartInstance.destroy();
        }

        // Combine history and forecast datasets
        const histLabels = data.six_month_trend.map(d => d.month);
        const forecastLabels = data.three_month_forecast.map(d => d.month);
        const allLabels = [...histLabels, ...forecastLabels];

        const historyValues = data.six_month_trend.map(d => d.price);
        // Connect history line to forecast line
        const forecastValues = Array(historyValues.length - 1).fill(null);
        forecastValues.push(historyValues[historyValues.length - 1]);
        data.three_month_forecast.forEach(d => forecastValues.push(d.price));

        const isDark = body.classList.contains('dark-mode');
        const mainColor = isDark ? '#10b981' : '#059669';
        const accentColor = isDark ? '#f59e0b' : '#d97706';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textLabelColor = isDark ? '#9caaa2' : '#5c6c63';

        marketChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Historical Price',
                        data: historyValues,
                        borderColor: mainColor,
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(5, 150, 105, 0.05)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: mainColor,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Agent Forecast',
                        data: forecastValues,
                        borderColor: accentColor,
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: accentColor,
                        fill: false,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textLabelColor,
                            font: {
                                size: 10,
                                family: 'Inter'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textLabelColor,
                            font: {
                                size: 10,
                                family: 'Inter'
                            }
                        }
                    }
                }
            }
        });
    }

    function updateChartTheme() {
        if (!marketChartInstance) return;
        const isDark = body.classList.contains('dark-mode');
        const mainColor = isDark ? '#10b981' : '#059669';
        const accentColor = isDark ? '#f59e0b' : '#d97706';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textLabelColor = isDark ? '#9caaa2' : '#5c6c63';

        marketChartInstance.data.datasets[0].borderColor = mainColor;
        marketChartInstance.data.datasets[0].pointBackgroundColor = mainColor;
        marketChartInstance.data.datasets[0].backgroundColor = isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(5, 150, 105, 0.05)';
        marketChartInstance.data.datasets[1].borderColor = accentColor;
        marketChartInstance.data.datasets[1].pointBackgroundColor = accentColor;
        marketChartInstance.options.scales.x.ticks.color = textLabelColor;
        marketChartInstance.options.scales.y.ticks.color = textLabelColor;
        marketChartInstance.options.scales.y.grid.color = gridColor;
        marketChartInstance.update();
    }

    // ==========================================================================
    // 5. Setup Action Listeners & Startup Initialization
    // ==========================================================================
    
    // Refresh buttons
    btnSyncWeather.addEventListener('click', syncWeatherRisk);
    btnSyncMarket.addEventListener('click', syncMarketIntel);

    // Auto-update Weather & Market when Location or Crop changes
    cropSelect.addEventListener('change', () => {
        syncWeatherRisk();
        syncMarketIntel();
        // Clear previous health analysis as it's crop-specific
        resetUploadZone();
    });

    let locationTimeout = null;
    locationInput.addEventListener('input', () => {
        // Debounce location typing input
        clearTimeout(locationTimeout);
        locationTimeout = setTimeout(() => {
            syncWeatherRisk();
            syncMarketIntel();
        }, 1000);
    });

    // Startup Initialization
    syncWeatherRisk();
    syncMarketIntel();
});
