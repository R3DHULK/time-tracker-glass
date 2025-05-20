// dashboard.js - Main script for the popup interface

// DOM elements
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');

const websitesList = document.getElementById('websites-list');
const siteTitle = document.getElementById('site-title');
const usageChart = document.getElementById('usage-chart');
const totalTimeElement = document.getElementById('total-time');
const dailyAverageElement = document.getElementById('daily-average');

const backBtn = document.getElementById('back-btn');
const themeToggle = document.getElementById('theme-toggle');
const timeButtons = document.querySelectorAll('.time-btn');

// State variables
let webUsageData = {};
let currentSite = null;
let currentTimeFilter = 1; // Default: today
let chart = null;

// Theme management
function initTheme() {
    // Load theme preference
    getBrowserAPI().storage.local.get('theme').then(result => {
        const isDarkTheme = result.theme !== 'light';
        document.body.classList.toggle('dark-theme', isDarkTheme);
        document.body.classList.toggle('light-theme', !isDarkTheme);
        themeToggle.checked = !isDarkTheme;
    });
}

themeToggle.addEventListener('change', () => {
    const isLightTheme = themeToggle.checked;
    document.body.classList.toggle('dark-theme', !isLightTheme);
    document.body.classList.toggle('light-theme', isLightTheme);
    getBrowserAPI().storage.local.set({ theme: isLightTheme ? 'light' : 'dark' });
});

// Navigation
backBtn.addEventListener('click', () => {
    detailView.classList.add('hidden');
    homeView.classList.remove('hidden');
    loadWebsitesList();
});

// Time filter buttons
timeButtons.forEach(button => {
    button.addEventListener('click', () => {
        timeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentTimeFilter = parseInt(button.dataset.days);
        updateChart();
    });
});

// Helper function to format seconds into readable time
function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

// Function to get dates for specified number of days ago
function getDateDaysAgo(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Helper function to handle browser API compatibility
function getBrowserAPI() {
    return typeof browser !== 'undefined' ? browser : chrome;
}

// Load and display website list
function loadWebsitesList() {
    getBrowserAPI().runtime.sendMessage({ action: "getWebUsageData" }).then(response => {
        webUsageData = response.webUsageData;

        // Process data for display
        const today = getDateDaysAgo(0);
        const sites = Object.keys(webUsageData);

        // Sort sites by today's usage (descending)
        sites.sort((a, b) => {
            const timeA = webUsageData[a][today] || 0;
            const timeB = webUsageData[b][today] || 0;
            return timeB - timeA;
        });

        // Clear and rebuild list
        websitesList.innerHTML = '';

        if (sites.length === 0) {
            websitesList.innerHTML = `<div class="loading">No usage data available yet.</div>`;
            return;
        }

        sites.forEach(site => {
            const todayUsage = webUsageData[site][today] || 0;

            const itemElement = document.createElement('div');
            itemElement.className = 'website-item';
            itemElement.addEventListener('click', () => {
                showSiteDetails(site);
            });

            // Try to get favicon
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${site}&sz=64`;

            itemElement.innerHTML = `
        <img src="${faviconUrl}" class="website-icon" onerror="this.src='../icons/default-icon.png'">
        <div class="website-info">
          <div class="website-domain">${site}</div>
          <div class="website-time">Today: ${formatTime(todayUsage)}</div>
        </div>
      `;

            websitesList.appendChild(itemElement);
        });
    });
}

// Show site details and chart
function showSiteDetails(site) {
    currentSite = site;
    siteTitle.textContent = site;

    homeView.classList.add('hidden');
    detailView.classList.remove('hidden');

    // Reset time filter to Today
    timeButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.time-btn[data-days="1"]').classList.add('active');
    currentTimeFilter = 1;

    updateChart();
}

// Update chart based on current site and time filter
function updateChart() {
    if (!currentSite) return;

    const dates = [];
    const timeData = [];
    let totalSeconds = 0;

    // Determine date range based on filter
    if (currentTimeFilter === 2) {
        // Yesterday only
        const yesterday = getDateDaysAgo(1);
        dates.push(yesterday);
        const usage = webUsageData[currentSite] && webUsageData[currentSite][yesterday]
            ? webUsageData[currentSite][yesterday] : 0;
        timeData.push(usage / 60); // Convert to minutes for chart
        totalSeconds = usage;
    } else {
        // Today, 7 days, or 30 days
        for (let i = 0; i < currentTimeFilter; i++) {
            const date = getDateDaysAgo(i);
            dates.unshift(date); // Add to beginning for chronological order

            const usage = webUsageData[currentSite] && webUsageData[currentSite][date]
                ? webUsageData[currentSite][date] : 0;

            timeData.unshift(usage / 60); // Convert to minutes for chart
            totalSeconds += usage;
        }
    }

    // Format x-axis labels
    const labels = dates.map(date => {
        const d = new Date(date);
        return currentTimeFilter <= 7
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Update statistics
    totalTimeElement.textContent = formatTime(totalSeconds);

    const avgSeconds = Math.round(totalSeconds / dates.length);
    dailyAverageElement.textContent = formatTime(avgSeconds);

    // Create/update chart
    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Time Spent (minutes)',
            data: timeData,
            backgroundColor: document.body.classList.contains('dark-theme')
                ? 'rgba(99, 102, 241, 0.5)'
                : 'rgba(79, 70, 229, 0.5)',
            borderColor: document.body.classList.contains('dark-theme')
                ? 'rgba(99, 102, 241, 1)'
                : 'rgba(79, 70, 229, 1)',
            borderWidth: 1,
            fill: true
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Minutes'
                },
                ticks: {
                    color: document.body.classList.contains('dark-theme') ? '#aaaacc' : '#666677'
                },
                grid: {
                    color: document.body.classList.contains('dark-theme')
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.1)'
                }
            },
            x: {
                ticks: {
                    color: document.body.classList.contains('dark-theme') ? '#aaaacc' : '#666677'
                },
                grid: {
                    color: document.body.classList.contains('dark-theme')
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.1)'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    // If chart exists, destroy it first
    if (chart) {
        chart.destroy();
    }

    // Create new chart
    chart = new Chart(usageChart, {
        type: 'line',
        data: chartData,
        options: chartOptions
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadWebsitesList();
});

// Update display when popup is shown (to reflect theme changes, etc.)
window.addEventListener('focus', () => {
    if (currentSite) {
        updateChart();
    }
});