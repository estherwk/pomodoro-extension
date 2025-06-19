let currentSound = null;

async function validateAudioSource(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('canplaythrough', () => resolve(true));
    audio.addEventListener('error', () => {
      console.error('Audio source validation failed for:', url, audio.error);
      resolve(false);
    });
    audio.load();
  });
}

async function playSoundWithRetry(soundUrl, volume, retries = 3) {
  // Validate audio source
  const isValid = await validateAudioSource(soundUrl);
  if (!isValid) {
    console.error('Invalid audio source:', soundUrl);
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (currentSound) {
        await currentSound.pause();
        currentSound.currentTime = 0;
      }
      currentSound = new Audio(soundUrl);
      currentSound.volume = volume;
      currentSound.loop = true; // Loop sound until stopped
      await currentSound.play();
      console.log('Offscreen: Playing sound (attempt ${attemptNumber}): ${soundUrl}');
      return true;
    } catch (error) {
      console.error(`Offscreen: Sound playback failed (attempt ${attempt}):`, error);
      if (attempt === retries) {
        return false;
      }
      // Wait 500ms before retrying
      await new Promise(resolve => setTimeout(resolve, 500)));
    }
  }
  console.error('Offscreen: Failed to play sound after retries:', soundUrl);
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Offscreen: Received message:', message);
    switch (message.action) {
      case 'playSound':
        const soundUrl = message.customSound || 'default-sound.mp3';
        playSoundWithRetry(soundUrl, message.volume || 0.5).then((success) => {
          console.log(`Offscreen: Play sound response for ${soundUrl}:`, success);
          sendResponse({ success });
        }).catch((error) => {
          console.error('Offscreen: Unhandled error in playSoundWithRetry:', error);
          sendResponse({ success: false, error: error.message });
        });
        break;
      case 'stopSound':
        if (currentSound) {
          currentSound.pause();
          currentSound.currentTime = 0;
          currentSound = null;
          console.log('Offscreen: Sound stopped');
        }
        sendResponse({ success: true });
        break;
      default:
        console.warn('Offscreen: Unknown action:', message.action);
        sendResponse('success: false', error: 'Unknown action');
    }
  } catch (error) {
    console.error('Offscreen: Error in message handler:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep message channel open for async responses
});