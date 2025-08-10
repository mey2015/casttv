function initChromecast(chromecastButton, videoElement) {
  const castContext = cast.framework.CastContext.getInstance();

  if (!window.chrome || !window.chrome.cast) {
    console.warn("Chromecast API not available. Make sure it's loaded and supported.");
    chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
    return;
  }

  castContext.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  castContext.addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    (event) => {
      updateCastButtonState(event.castState, chromecastButton);
      if (event.castState === cast.framework.CastState.NOT_CONNECTED && videoElement.paused) {
        videoElement.play();
      }
    }
  );

  const remotePlayer = new cast.framework.RemotePlayer();
  const remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);

  remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
    () => {
      console.log('Remote player paused status:', remotePlayer.isPaused);
    }
  );

  remotePlayerController.addEventListener(
    cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
    () => {
      console.log('Remote player connected status:', remotePlayer.isConnected);
      if (!remotePlayer.isConnected) {
        if (videoElement.paused) videoElement.play();
      }
    }
  );

  chromecastButton.addEventListener('click', () => launchCastApp(chromecastButton, videoElement, castContext));
  updateCastButtonState(castContext.getCastState(), chromecastButton);
}

function updateCastButtonState(castState, chromecastButton) {
  chromecastButton.setAttribute('data-cast-state', castState);
  chromecastButton.style.display = (castState === cast.framework.CastState.NO_DEVICES_AVAILABLE) ? 'none' : 'block';
}

function getContentType(src) {
  if (src.endsWith('.mp4')) return 'video/mp4';
  if (src.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (src.endsWith('.webm')) return 'video/webm';
  return '';
}

function launchCastApp(chromecastButton, videoElement, castContext) {
  connectToSession(castContext)
    .then((session) => {
      if (!session) {
        console.error('Failed to get Cast session.');
        return;
      }
      videoElement.pause();
      const videoSrc = videoElement.querySelector('source')?.src || videoElement.src;
      if (!videoSrc) {
        console.error('No video source found to cast.');
        return;
      }
      const mediaInfo = new chrome.cast.media.MediaInfo(videoSrc);
      mediaInfo.contentType = getContentType(videoSrc);
      const metadata = new chrome.cast.media.GenericMediaMetadata();
      metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
      metadata.title = "Sintel Trailer"; // Consider making this dynamic
      mediaInfo.metadata = metadata;
      const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
      loadRequest.autoplay = true;
      return session.loadMedia(loadRequest);
    })
    .then(() => {
      console.log('Media loaded successfully on Chromecast.');
    })
    .catch((error) => {
      console.error('Error launching Cast app or loading media:', error);
      if (videoElement.paused) videoElement.play();
      chromecastButton.setAttribute('data-cast-state', 'ERROR');
    });
}

function connectToSession(castContext) {
  const castSession = castContext.getCurrentSession();
  if (!castSession) {
    return castContext.requestSession()
      .then((session) => session);
  }
  return Promise.resolve(castSession);
}
