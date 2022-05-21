const video = document.getElementById('webcam_video')
const label = document.getElementById('label')

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.faceExpressionNet.loadFromUri('./models')
]).then(startWebcam)

function startWebcam() { 
    navigator.mediaDevices.getUserMedia(
        { video: {} })
        .then(stream => { 
            video.srcObject = stream 
        })
        .catch( err => { 
            console.log('Failed to get local stream' ,err); 
        }
    )
}

startWebcam();
callPlayer("youtube_frame", function() {
    // This function runs once the player is ready ("onYouTubePlayerReady")
    callPlayer("youtube_frame", "playVideo");
});

video.addEventListener('play', () => {
    //create the canvas from video element as we have created above
    const canvas = faceapi.createCanvasFromMedia(video);
    //append canvas to body or the dom element where you want to append it
    document.body.append(canvas)
    // displaySize will help us to match the dimension with video screen and accordingly it will draw our detections
    // on the streaming video screen
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
    //   const resizedDetections = faceapi.resizeResults(detections, displaySize)
    //   const context = canvas.getContext("2d")
    //   context.clearRect(0, 0, canvas.width, canvas.height)
    //   faceapi.draw.drawDetections(canvas, resizedDetections)
    //   faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    //   faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

      let isMouthOpen = checkMouthOpen(detections[0].landmarks.getMouth())
      let canvasText

      if(isMouthOpen) {
          canvasText = "Mouth is open"
          label.innerHTML = "Mouth is open"
          // play video
          callPlayer("youtube_frame", "playVideo")
      } else {
          canvasText = "Mouth is closed"
          label.innerHTML = "Mouth is closed"
          // stop video
          callPlayer("youtube_frame", "pauseVideo")
      }
    }, 100)
})

function getLipHeight(lip, isUpper) {
    const indexArray = isUpper ? [[10,19], [9,18], [8,17]] : [[2,13], [3,14], [4,15]]
    sum = 0
    for(let [d1,d2] of indexArray) {
        distance = Math.sqrt((lip[d1].x - lip[d2].x)**2 + 
                            (lip[d1].y - lip[d2].y)**2)
        sum += distance
    }
    return sum/3
}

function getMouthHeight(lip) {
    const indexArray = [[17,15],[18,14],[19,13]]
    sum = 0
    for(let [d1,d2] of indexArray) {
        distance = Math.sqrt((lip[d1].x - lip[d2].x)**2 + 
                            (lip[d1].y - lip[d2].y)**2)
        sum += distance
    }
    return sum/3
}

function checkMouthOpen(lip) {
    topLipHeight = getLipHeight(lip, true)
    bottomLipHeight = getLipHeight(lip, false)
    mouthHeight = getMouthHeight(lip)
    // console.log("topLipHeight: " + topLipHeight)
    // console.log("bottomLipHeight: " + bottomLipHeight)
    // console.log("mouthHeight: " + mouthHeight)

    // if mouth is open more than lip height * ratio, return true
    ratio = 0.5
    return (mouthHeight > Math.min(topLipHeight, bottomLipHeight) * ratio) ? true : false
}

/* VIDEO RELATED FUNCTIONS */

function callPlayer(frame_id, func, args) {
    if (window.jQuery && frame_id instanceof jQuery) frame_id = frame_id.get(0).id;
    var iframe = document.getElementById(frame_id);
    if (iframe && iframe.tagName.toUpperCase() != 'IFRAME') {
        iframe = iframe.getElementsByTagName('iframe')[0];
    }

    // When the player is not ready yet, add the event to a queue
    // Each frame_id is associated with an own queue.
    // Each queue has three possible states:
    //  undefined = uninitialised / array = queue / .ready=true = ready
    if (!callPlayer.queue) callPlayer.queue = {};
    var queue = callPlayer.queue[frame_id],
        domReady = document.readyState == 'complete';

    if (domReady && !iframe) {
        // DOM is ready and iframe does not exist. Log a message
        window.console && console.log('callPlayer: Frame not found; id=' + frame_id);
        if (queue) clearInterval(queue.poller);
    } else if (func === 'listening') {
        // Sending the "listener" message to the frame, to request status updates
        if (iframe && iframe.contentWindow) {
            func = '{"event":"listening","id":' + JSON.stringify(''+frame_id) + '}';
            iframe.contentWindow.postMessage(func, '*');
        }
    } else if ((!queue || !queue.ready) && (
               !domReady ||
               iframe && !iframe.contentWindow ||
               typeof func === 'function')) {
        if (!queue) queue = callPlayer.queue[frame_id] = [];
        queue.push([func, args]);
        if (!('poller' in queue)) {
            // keep polling until the document and frame is ready
            queue.poller = setInterval(function() {
                callPlayer(frame_id, 'listening');
            }, 250);
            // Add a global "message" event listener, to catch status updates:
            messageEvent(1, function runOnceReady(e) {
                if (!iframe) {
                    iframe = document.getElementById(frame_id);
                    if (!iframe) return;
                    if (iframe.tagName.toUpperCase() != 'IFRAME') {
                        iframe = iframe.getElementsByTagName('iframe')[0];
                        if (!iframe) return;
                    }
                }
                if (e.source === iframe.contentWindow) {
                    // Assume that the player is ready if we receive a
                    // message from the iframe
                    clearInterval(queue.poller);
                    queue.ready = true;
                    messageEvent(0, runOnceReady);
                    // .. and release the queue:
                    while (tmp = queue.shift()) {
                        callPlayer(frame_id, tmp[0], tmp[1]);
                    }
                }
            }, false);
        }
    } else if (iframe && iframe.contentWindow) {
        // When a function is supplied, just call it (like "onYouTubePlayerReady")
        if (func.call) return func();
        // Frame exists, send message
        iframe.contentWindow.postMessage(JSON.stringify({
            "event": "command",
            "func": func,
            "args": args || [],
            "id": frame_id
        }), "*");
    }
    /* IE8 does not support addEventListener... */
    function messageEvent(add, listener) {
        var w3 = add ? window.addEventListener : window.removeEventListener;
        w3 ?
            w3('message', listener, !1)
        :
            (add ? window.attachEvent : window.detachEvent)('onmessage', listener);
    }
}

function changeVideo() {
    const youtubeVideo = document.getElementById("youtube_video")
    const textboxURL = document.getElementById("youtube_url").value
    const newURL = "https://www.youtube.com/embed/" + textboxURL.slice(textboxURL.lastIndexOf('/') + 1) + "?enablejsapi=1"
    // convert the youtube url to embed url
    console.log(newURL)
    youtubeVideo.src = newURL
}