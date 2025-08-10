let castSession = null;
let remotePlayer = null;
let remotePlayerController = null;
let isChromecastInitialized = false;

const videoElement = document.getElementById('main-video');
const chromecastButton = document.getElementById('chromecastButton');

function disableChromecastButton() {
  chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
  chromecastButton.disabled = true;
}

function initChromecast() {
  if (isChromecastInitialized) return;
  isChromecastInitialized = true;

  if (!window.chrome?.cast || !cast?.framework) {
    console.warn("Chromecast API not available. Make sure it's loaded and supported.");
    disableChromecastButton();
    return;
  }

  const castContext = cast.framework.CastContext.getInstance();

  castContext.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  castContext.addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    (event) => {
      updateCastButtonState(event.castState);
      if (event.castState === cast.framework.CastState.NOT_CONNECTED && videoElement.paused) {
        videoElement.play();
      }
    }
  );

  remotePlayer = new cast.framework.RemotePlayer();
  remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);

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
      if (!remotePlayer.isConnected && castSession && videoElement.paused) {
        videoElement.play();
      }
    }
  );

  if (!chromecastButton.hasListener) {
    chromecastButton.addEventListener('click', launchCastApp);
    chromecastButton.hasListener = true; // Custom property to prevent double attachment
  }
  updateCastButtonState(castContext.getCastState());
}
    /**
     * Updates the UI state of the Chromecast button based on the cast state.
     * @param {cast.framework.CastState} castState The current Cast state.
     */
    function updateCastButtonState(castState) {
      chromecastButton.setAttribute('data-cast-state', castState);
      if (castState === cast.framework.CastState.NO_DEVICES_AVAILABLE) {
        chromecastButton.style.display = 'none'; // Hide if no devices
      } else {
        chromecastButton.style.display = 'block'; // Show if devices available or connecting
      }
    }

    /**
     * Connects to a Cast session or requests a new one.
     * @returns {Promise<cast.framework.CastSession>} A promise that resolves with the current Cast session.
     */
    function connectToSession() {
      castSession = cast.framework.CastContext.getInstance().getCurrentSession();
      if (!castSession) {
        return cast.framework.CastContext.getInstance().requestSession()
          .then((session) => {
            castSession = session;
            return session;
          });
      }
      return Promise.resolve(castSession);
    }

    /**
     * Launches the Cast app and loads the media.
     */
    function launchCastApp() {
      connectToSession()
        .then((session) => {
          if (!session) {
            console.error('Failed to get Cast session.');
            return;
          }

          // Pause local video when casting
          videoElement.pause();

          const currentVideoSource = videoElement.querySelector('source') ?
            videoElement.querySelector('source').src : videoElement.src;

          if (!currentVideoSource) {
            console.error('No video source found to cast.');
            return;
          }

          const mediaInfo = new chrome.cast.media.MediaInfo(currentVideoSource);

          // IMPORTANT: Set contentType based on your video type.
          // For MP4: 'video/mp4'
          // For HLS: 'application/x-mpegURL' (or 'application/vnd.apple.mpegurl')
          // For DASH: 'application/dash+xml'
          // For generic streams: 'video/webm', 'video/ogg', etc.
          // Make sure this matches the actual content type.
          mediaInfo.contentType = 'video/mp4'; // Assuming MP4 for this example. Adjust as needed!

          // Basic metadata (optional but recommended for better display on TV)
          const metadata = new chrome.cast.media.GenericMediaMetadata();
          metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
          metadata.title = "Sintel Trailer"; // Replace with actual video title
          // metadata.images = [new chrome.cast.Image('URL_TO_VIDEO_THUMBNAIL.jpg')]; // Optional thumbnail
          mediaInfo.metadata = metadata;

          const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
          loadRequest.autoplay = true; // Start playing automatically on the TV

          return session.loadMedia(loadRequest);
        })
        .then(() => {
          console.log('Media loaded successfully on Chromecast.');
          // No need to call listenToRemote() explicitly here,
          // as remotePlayer and remotePlayerController are initialized globally.
        })
        .catch((error) => {
          console.error('Error launching Cast app or loading media:', error);
          // If casting fails, you might want to resume local video
          if (videoElement.paused) {
            videoElement.play();
          }
        });
    }

    // Initialize Chromecast when the page is fully loaded
    window.__onGCastApiAvailable = function(isAvailable) {
      if (isAvailable) {
        initChromecast();
      } else {
        console.warn("Chromecast API not available.");
        chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
      }
    };
