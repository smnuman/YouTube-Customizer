// Update status in popup
function updateStatus(message, color = '#27ae60') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.style.color = color;
}

// Apply settings to current tab
document.getElementById('save').addEventListener('click', () => {
  const quality = document.getElementById('quality').value;
  const speed = parseFloat(document.getElementById('speed').value);
  const cinematic = document.getElementById('cinematic').checked;

  chrome.storage.sync.set({ tempQuality: quality, tempSpeed: speed, tempCinematic: cinematic }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0].url;
      if (url.includes('youtube.com')) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'applySettings' },
          { frameId: 0 }, // Ensure message targets the main frame
          (response) => {
            if (chrome.runtime.lastError) {
              updateStatus('Error applying settings: ' + chrome.runtime.lastError.message, '#e74c3c');
            } else if (response && response.status === 'applied') {
              updateStatus('Settings applied!');
            } else {
              updateStatus('No response from content script', '#e74c3c');
            }
          }
        );
      } else {
        updateStatus('Not a YouTube page!', '#e74c3c');
      }
    });
  });
});

// Set current settings as defaults
document.getElementById('defaultLink').addEventListener('click', (e) => {
  e.preventDefault(); // Prevent link default behavior
  const quality = document.getElementById('quality').value;
  const speed = parseFloat(document.getElementById('speed').value);
  const cinematic = document.getElementById('cinematic').checked;

  chrome.storage.sync.set({ defaultQuality: quality, defaultSpeed: speed, defaultCinematic: cinematic }, () => {
    updateStatus('Defaults saved!');
  });
});

// Load settings when popup opens
chrome.storage.sync.get(
  ['defaultQuality', 'defaultSpeed', 'defaultCinematic', 'tempQuality', 'tempSpeed', 'tempCinematic'],
  (data) => {
    // Load defaults first (speed defaults to 1.5)
    const quality = data.defaultQuality || 'highres';
    const speed = data.defaultSpeed || 1.5;
    const cinematic = data.defaultCinematic !== undefined ? data.defaultCinematic : true;

    // Override with temporary settings if they exist
    document.getElementById('quality').value = data.tempQuality || quality;
    document.getElementById('speed').value = data.tempSpeed || speed;
    document.getElementById('cinematic').checked = data.tempCinematic !== undefined ? data.tempCinematic : cinematic;

    // Sync with current YouTube settings
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0].url;
      if (url.includes('youtube.com')) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'getCurrentSettings' },
          { frameId: 0 },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log('Sync error: ', chrome.runtime.lastError.message);
            } else if (response) {
              document.getElementById('quality').value = response.quality || data.tempQuality || quality;
              document.getElementById('speed').value = response.speed || data.tempSpeed || speed;
              document.getElementById('cinematic').checked = 
                response.cinematic !== undefined ? response.cinematic : (data.tempCinematic !== undefined ? data.tempCinematic : cinematic);
              updateStatus('Synced with YouTube');
            } else {
              updateStatus('Unable to sync with YouTube', '#e74c3c');
            }
          }
        );
      }
    });
  }
);