console.log('YouTube Customizer content script running');

// Flag to prevent re-entrant calls to applySettings
let isApplyingSettings = false;
// Flag to track if the extension context is still valid
let isContextValid = true;

// Throttle function to limit function calls
function throttle(func, limit) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return func(...args);
    }
    return Promise.resolve(null);
  };
}

// Cache for last known settings to reduce DOM interactions
let cachedSettings = {
  quality: 'highres',
  speed: 1.5,
  cinematic: true
};

// Wait for an element to be available
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkElement = () => {
      if (!isContextValid) {
        reject(new Error('Extension context invalidated'));
        return;
      }
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
      } else {
        setTimeout(checkElement, 100);
      }
    };
    checkElement();
  });
}

// Retry setting playback speed until the video is ready
async function setPlaybackSpeed(video, speed, maxRetries = 5, delay = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      video.playbackRate = speed;
      if (video.playbackRate === speed) {
        console.log('Set playback speed to:', speed);
        return true;
      }
    } catch (error) {
      console.warn('Failed to set playback speed, retrying...', error);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  console.error('Failed to set playback speed after retries');
  return false;
}

// Apply settings to the video player
async function applySettings(settings) {
  if (isApplyingSettings || !isContextValid) return;
  isApplyingSettings = true;

  try {
    const video = await waitForElement('video');
    const player = await waitForElement('#movie_player, .html5-video-player');
    if (!video || !player) {
      console.warn('Video or player not found, cannot apply settings');
      return;
    }

    const current = getCurrentSettings();

    // Only apply quality if it differs and context is valid
    if (settings.quality && settings.quality !== current.quality && isContextValid) {
      const settingsButton = document.querySelector('button.ytp-settings-button');
      if (settingsButton) {
        settingsButton.click();

        await new Promise(resolve => setTimeout(resolve, 500));

        const qualityMenuItem = Array.from(document.querySelectorAll('.ytp-menuitem-label'))
          .find(item => item.textContent.includes('Quality'));
        if (qualityMenuItem && isContextValid) {
          qualityMenuItem.click();

          await new Promise(resolve => setTimeout(resolve, 500));

          const qualityMap = {
            'highres': 'Highest',
            'hd1080': '1080p',
            'hd720': '720p',
            'large': '480p'
          };
          const qualityLabel = qualityMap[settings.quality] || '1080p';

          const qualityOption = Array.from(document.querySelectorAll('.ytp-quality-menu .ytp-menuitem'))
            .find(option => option.textContent.includes(qualityLabel));
          if (qualityOption && isContextValid) {
            qualityOption.click();
            cachedSettings.quality = settings.quality;
          }

          settingsButton.click();
        }
      }
    }

    if (settings.speed && settings.speed !== video.playbackRate && isContextValid) {
      await setPlaybackSpeed(video, settings.speed);
      cachedSettings.speed = settings.speed;
    }

    const theaterButton = document.querySelector('button.ytp-size-button');
    if (theaterButton && isContextValid) {
      const isTheaterMode = player.classList.contains('ytp-size-theater');
      if (settings.cinematic && !isTheaterMode) {
        theaterButton.click();
        cachedSettings.cinematic = true;
      } else if (!settings.cinematic && isTheaterMode) {
        theaterButton.click();
        cachedSettings.cinematic = false;
      }
    }
  } catch (error) {
    console.error('Error in applySettings:', error);
  } finally {
    isApplyingSettings = false;
  }
}

const throttledApplySettings = throttle(applySettings, 2000);

// Throttled version of getCurrentSettings to reduce DOM interactions
const throttledGetCurrentSettings = throttle(async () => {
  const video = document.querySelector('video');
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (!video || !player) return cachedSettings;

  try {
    if (!chrome.runtime?.id || !isContextValid) {
      throw new Error('Extension context invalidated');
    }

    let quality = cachedSettings.quality;
    const settingsButton = document.querySelector('button.ytp-settings-button');
    if (settingsButton) {
      settingsButton.click();

      await new Promise(resolve => setTimeout(resolve, 500));

      const qualityMenuItem = Array.from(document.querySelectorAll('.ytp-menuitem-label'))
        .find(item => item.textContent.includes('Quality'));
      if (qualityMenuItem && isContextValid) {
        qualityMenuItem.click();

        await new Promise(resolve => setTimeout(resolve, 500));

        const activeQuality = document.querySelector('.ytp-quality-menu .ytp-menuitem[aria-checked="true"]');
        if (activeQuality) {
          const qualityText = activeQuality.textContent;
          const qualityMapReverse = {
            '1080p': 'hd1080',
            '720p': 'hd720',
            '480p': 'large'
          };
          const match = qualityText.match(/Auto\s*\((\d+p)\)/);
          if (match) {
            quality = qualityMapReverse[match[1]] || 'highres';
          } else {
            quality = qualityMapReverse[qualityText] || 'highres';
          }
          cachedSettings.quality = quality;
        }
        settingsButton.click();
      } else {
        settingsButton.click();
      }
    }

    return {
      quality: quality,
      speed: video.playbackRate,
      cinematic: player.classList.contains('ytp-size-theater')
    };
  } catch (error) {
    console.error('Error in getCurrentSettings:', error);
    return cachedSettings;
  }
}, 15000);

function getCurrentSettings() {
  const video = document.querySelector('video');
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  i