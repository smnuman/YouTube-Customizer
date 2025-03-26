// Update status in popup
function updateStatus(message, color = '#27ae60') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.style.color = color;
}

// Check if content script is ready by sending a ping message
function checkContentScriptReady(tabId, maxAttempts = 5, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function ping() {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, { frameId: 0 }, (response) => {
        if (chrome.runtime.lastError) {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Ping attempt ${attempts} failed: ${chrome.runtime.lastError.message}`);
            setTimeout(ping, delay);
          } else {
            reject(new Error('Content script not ready: ' + chrome.runtime.lastError.message));
          }
        } else if (response && response.status === 'pong') {
          resolve();
        } else {
          reject(new Error('Unexpected response from content script'));
        }
      });
    }

    ping();
  });
}

// Retry mechanism for sending messages
function sendMessageWithRetry(tabId, message, options, maxRetries = 5, retryDelay = 1000) {
  let attempts = 0;

  function attemptSend() {
    chrome.tabs.sendMessage(tabId, message, options, (response) => {
      if (chrome.runtime.lastError) {
        attempts++;
        if (attempts < maxRetries) {
          console.log(`Retry attempt ${attempts} due to: ${chrome.runtime.lastError.message}`);
          setTimeout(attemptSend, retryDelay);
        } else {
          updateStatus(`Error applying settings: ${chrome.runtime.lastError.message}`, '#e74c3c');
        }
      } else if (response && response.status === 'applied') {
        updateStatus('Settings applied!');
      } else {
        updateStatus('No response from content script', '#e74c3c');
      }
    });
  }

  attemptSend();
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
        // Check if content script is ready before sending the message
        checkContentScriptReady(tabs[0].id)
          .then(() => {
            sendMessageWithRetry(tabs[0].id, { action: 'applySettings' }, { frameId: 0 });
          })
          .catch((error) => {
            updateStatus(`Failed to connect: ${error.message}`, '#e74c3c');
          });
      } else {
        updateStatus('Not a YouTube page!', '#e74c3c');
      }
    });
  });
});

// Set current settings as defaults
document.getElementById('defaultLink').addEventListener('click', (e) => {
  e.preventDefault();
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
    const quality = data.defaultQuality || 'highres';
    const speed = data.defaultSpeed || 1.5;
    const cinematic = data.defaultCinematic !== undefined ? data.defaultCinematic : true;

    document.getElementById('quality').value = data.tempQuality || quality;
    document.getElementById('speed').value = data.tempSpeed || speed;
    document.getElementById('cinematic').checked = data.tempCinematic !== undefined ? data.tempCinematic : cinematic;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0].url;
      if (url.includes('youtube.com')) {
        checkContentScriptReady(tabs[0].id)
          .then(() => {
            sendMessageWithRetry(tabs[0].id, { action: 'getCurrentSettings' }, { frameId: 0 }, 5, 1000);
          })
          .catch((error) => {
            updateStatus(`Failed to sync: ${error.message}`, '#e74c3c');
          });
      }
    });
  }
);