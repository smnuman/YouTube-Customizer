console.log('YouTube Customizer content script running');

// Apply settings to the video player
function applySettings(settings) {
  const video = document.querySelector('video');
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (!video || !player) return;

  // Apply video quality using DOM manipulation
  if (settings.quality) {
    const settingsButton = document.querySelector('button.ytp-settings-button');
    if (settingsButton) {
      settingsButton.click(); // Open settings menu

      setTimeout(() => {
        const qualityMenuItem = Array.from(document.querySelectorAll('.ytp-menuitem-label'))
          .find(item => item.textContent.includes('Quality'));
        if (qualityMenuItem) {
          qualityMenuItem.click(); // Open quality options

          setTimeout(() => {
            const qualityMap = {
              'highres': 'Highest',
              'hd1080': '1080p',
              'hd720': '720p',
              'large': '480p'
            };
            const qualityLabel = qualityMap[settings.quality] || '1080p';

            const qualityOption = Array.from(document.querySelectorAll('.ytp-quality-menu .ytp-menuitem'))
              .find(option => option.textContent.includes(qualityLabel));
            if (qualityOption) {
              qualityOption.click(); // Set the quality
            }

            // Close settings menu
            settingsButton.click();
          }, 500); // Delay to ensure quality menu is loaded
        }
      }, 500); // Delay to ensure settings menu is loaded
    }
  }

  // Apply playback speed
  if (settings.speed) {
    video.playbackRate = settings.speed;
  }

  // Apply cinematic mode (Theater mode)
  const theaterButton = document.querySelector('button.ytp-size-button');
  if (theaterButton) {
    if (settings.cinematic && !player.classList.contains('ytp-size-theater')) {
      theaterButton.click();
    } else if (!settings.cinematic && player.classList.contains('ytp-size-theater')) {
      theaterButton.click();
    }
  }
}

// Get current YouTube settings using DOM manipulation
function getCurrentSettings() {
  const video = document.querySelector('video');
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (!video || !player) return {};

  let quality = 'highres'; // Default fallback
  const settingsButton = document.querySelector('button.ytp-settings-button');
  if (settingsButton) {
    settingsButton.click(); // Open settings menu

    setTimeout(() => {
      const qualityMenuItem = Array.from(document.querySelectorAll('.ytp-menuitem-label'))
        .find(item => item.textContent.includes('Quality'));
      if (qualityMenuItem) {
        qualityMenuItem.click(); // Open quality options

        setTimeout(() => {
          const activeQuality = document.querySelector('.ytp-quality-menu .ytp-menuitem[aria-checked="true"]');
          if (activeQuality) {
            const qualityText = activeQuality.textContent;
            const qualityMapReverse = {
              '1080p': 'hd1080',
              '720p': 'hd720',
              '480p': 'large'
            };
            quality = qualityMapReverse[qualityText] || 'highres';
          }
          settingsButton.click(); // Close settings menu
        }, 500);
      } else {
        settingsButton.click(); // Close settings menu if quality item not found
      }
    }, 500);
  }

  return {
    quality: quality,
    speed: video.playbackRate,
    cinematic: player.classList.contains('ytp-size-theater')
  };
}

// Apply default settings on page load
function applyDefaultSettings() {
  chrome.storage.sync.get(['defaultQuality', 'defaultSpeed', 'defaultCinematic'], (data) => {
    const settings = {
      quality: data.defaultQuality || 'highres',
      speed: data.defaultSpeed || 1.5,
      cinematic: data.defaultCinematic !== undefined ? data.defaultCinematic : true
    };
    applySettings(settings);
  });
}

// Debounced sync function to avoid exceeding storage quota
let syncTimeout;
function syncSettings() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    const current = getCurrentSettings();
    chrome.storage.sync.set({
      tempQuality: current.quality,
      tempSpeed: current.speed,
      tempCinematic: current.cinematic
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage sync error:', chrome.runtime.lastError.message);
      }
    });
  }, 1000); // Debounce for 1 second
}

// Monitor changes in YouTube settings
const observer = new MutationObserver(() => {
  syncSettings();
});
const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
if (player) {
  observer.observe(player, { attributes: true, subtree: true });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'applySettings') {
    chrome.storage.sync.get(['tempQuality', 'tempSpeed', 'tempCinematic'], (data) => {
      const settings = {
        quality: data.tempQuality,
        speed: data.tempSpeed,
        cinematic: data.tempCinematic
      };
      applySettings(settings);
      sendResponse({ status: 'applied' });
    });
    return true; // Keep message channel open for async response
  } else if (message.action === 'getCurrentSettings') {
    sendResponse(getCurrentSettings());
  }
});

// Apply default settings on page load
window.addEventListener('load', applyDefaultSettings);