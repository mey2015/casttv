    const videoElement = document.getElementById('main-video');
    const chromecastButton = document.getElementById('chromecastButton');
    let castSession = null;
    let remotePlayer = null;
    let remotePlayerController = null;

    /**
     * Initializes the Chromecast API.
     */
    function initChromecast() {
      // Check if the Cast API is available
      if (!window.chrome || !window.chrome.cast) {
        console.warn("Chromecast API not available. Make sure it's loaded and supported.");
        chromecastButton.setAttribute('data-cast-state', 'NO_DEVICES_AVAILABLE');
        return;
      }

      // Set up the Cast context options
      cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, // Use the default media receiver
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED // Auto-join session for this origin
      });

      // Listen for Cast state changes (e.g., connected, disconnected)
      cast.framework.CastContext.getInstance().addEventListener(
        cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event) => {
          updateCastButtonState(event.castState);
          if (event.castState === cast.framework.CastState.NOT_CONNECTED) {
            // If disconnected, ensure local video resumes if it was paused
            if (!videoElement.paused) {
              videoElement.play();
            }
          }
        }
      );

      // Initialize remote player for controlling media on the receiver
      remotePlayer = new cast.framework.RemotePlayer();
      remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);

      // Listen to changes in the remote player state
      remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
        () => {
          console.log('Remote player paused status:', remotePlayer.isPaused);
          // You could update local UI (e.g., play/pause button) here
        }
      );

      remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
        () => {
          console.log('Remote player connected status:', remotePlayer.isConnected);
          if (!remotePlayer.isConnected && castSession) {
            // If remote player disconnects, end the session and resume local playback
            console.log('Chromecast session ended due to remote player disconnection.');
            // castSession.endSession(true); // This might be redundant if CAST_STATE_CHANGED handles it
            if (videoElement.paused) {
              videoElement.play(); // Resume local playback
            }
          }
        }
      );

      // Add event listener to the Chromecast button
      chromecastButton.addEventListener('click', launchCastApp);

      // Initial update of the button state
      updateCastButtonState(cast.framework.CastContext.getInstance().getCastState());
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
