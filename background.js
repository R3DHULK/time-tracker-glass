// background.js - Tracks website usage time in the background

// Store for currently active tab
let activeTab = null;
let activeTabStartTime = null;
let webUsageData = {};

// Helper function to handle browser API compatibility
function getBrowserAPI() {
    return typeof browser !== 'undefined' ? browser : chrome;
}

// Load saved data on startup
async function loadStoredData() {
    return new Promise((resolve) => {
        getBrowserAPI().storage.local.get(['webUsageData'], (result) => {
            if (result.webUsageData) webUsageData = result.webUsageData;
            resolve();
        });
    });
}

// Initialize extension
async function initializeExtension() {
    await loadStoredData();
    console.log('Loaded web usage data:', webUsageData);
}

// Helper function to extract domain from URL
function extractDomain(url) {
    if (!url) return "";

    try {
        // Extract hostname
        let hostname = new URL(url).hostname;

        // Remove www. prefix if present
        if (hostname.startsWith('www.')) {
            hostname = hostname.slice(4);
        }

        return hostname;
    } catch (e) {
        console.error('Error extracting domain:', e);
        return "";
    }
}

// Function to get today's date as string (YYYY-MM-DD)
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Function to update tracking data when tab changes
function updateTimeTracking(tabId, url) {
    console.log(`Updating time tracking for tab ${tabId} with URL ${url}`);

    // Save time for previous active tab
    if (activeTab && activeTabStartTime) {
        const domain = extractDomain(activeTab.url);
        if (domain) {
            const today = getTodayDateString();
            const timeSpent = Math.floor((Date.now() - activeTabStartTime) / 1000); // in seconds

            if (timeSpent > 0) { // Only update if meaningful time was spent (> 0 seconds)
                console.log(`Recording ${timeSpent} seconds for ${domain}`);

                if (!webUsageData[domain]) {
                    webUsageData[domain] = {};
                }

                if (!webUsageData[domain][today]) {
                    webUsageData[domain][today] = 0;
                }

                webUsageData[domain][today] += timeSpent;

                // Save data
                getBrowserAPI().storage.local.set({ webUsageData }, () => {
                    console.log(`Saved usage data for ${domain}: ${webUsageData[domain][today]} seconds`);
                });
            }
        }
    }

    // Update active tab info
    activeTabStartTime = Date.now();
}

// Tab event listeners
getBrowserAPI().tabs.onActivated.addListener((activeInfo) => {
    console.log(`Tab activated: ${activeInfo.tabId}`);

    getBrowserAPI().tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.startsWith('http')) {
            const domain = extractDomain(tab.url);

            if (domain) {
                console.log(`Activated tab domain: ${domain}`);
                updateTimeTracking(tab.id, tab.url);
                activeTab = tab;
            }
        } else {
            console.log('Activated tab is not an HTTP page, not tracking');
            activeTab = null;
            activeTabStartTime = null;
        }
    });
});

getBrowserAPI().tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url && tab.url.startsWith('http')) {
        console.log(`Tab ${tabId} updated to ${tab.url}`);

        const domain = extractDomain(tab.url);
        if (domain) {
            updateTimeTracking(tabId, tab.url);
            activeTab = tab;
        }
    }
});

// Save data periodically (every 15 seconds for more accurate time tracking)
getBrowserAPI().alarms.create('saveData', { periodInMinutes: 0.25 });

getBrowserAPI().alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'saveData') {
        console.log('Alarm fired: saveData');

        if (activeTab && activeTabStartTime) {
            const domain = extractDomain(activeTab.url);
            if (domain) {
                console.log(`Active tab is ${domain}, updating time tracking`);
                updateTimeTracking(activeTab.id, activeTab.url);
                activeTabStartTime = Date.now(); // Reset the timer
            }
        } else {
            console.log('No active tab to track');
        }
    }
});

// Handle browser shutdown
getBrowserAPI().runtime.onSuspend.addListener(() => {
    console.log('Browser shutting down, saving final time data');

    if (activeTab && activeTabStartTime) {
        updateTimeTracking(activeTab.id, activeTab.url);
    }
});

// API for popup to get data
getBrowserAPI().runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);

    if (message.action === "getWebUsageData") {
        sendResponse({ webUsageData });
    }

    return false; // No async response needed
});

// Initialize when the extension starts
initializeExtension();