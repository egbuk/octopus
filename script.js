/** @var trackInfo HTMLElement */
/** @var loadStatusInfo HTMLElement */
const playToggle = document.querySelector('.overlay .play-toggle');
// noinspection JSUnusedGlobalSymbols
const Player = {
    buffer: null,
    duration: 0,
    timeouts: [],
    stopped: true,
    loadProgress: 0,
    tracks: [{
            title: 'MantisMash - You Are These Vibrations',
            link: 'https://mantismash.bandcamp.com/track/you-are-these-vibrations',
            url: "media/1.mp3"
        },
        {
            title: 'MantisMash - The Flying Smile',
            link: 'https://mantismash.bandcamp.com/track/the-flying-smile',
            url: "media/2.mp3"
        },
        {
            title: 'MantisMash - Is This Real Life? (432hz)',
            link: 'https://mantismash.bandcamp.com/track/is-this-real-life-432hz',
            url: "media/3.mp3"
        },
        {
            title: 'MantisMash - Spring Bass',
            link: 'https://mantismash.bandcamp.com/track/spring-bass',
            url: "media/4.mp3"
        },
        {
            title: 'Sixis - Refraction Point (MantisMash Remix)',
            link: 'https://mantismash.bandcamp.com/track/sixis-refraction-point-mantismash-remix',
            url: "media/5.mp3"
        }
    ],
    init() {
        // noinspection JSUnresolvedVariable
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.context.suspend && this.context.suspend();
        this.firstLaunch = true;
        try {
            this.javascriptNode = this.context.createScriptProcessor(2048, 1, 1);
            this.javascriptNode.connect(this.context.destination);
            this.analyser = this.context.createAnalyser();
            this.analyser.connect(this.javascriptNode);
            this.analyser.smoothingTimeConstant = 0.6;
            this.analyser.fftSize = 2048;
            this.source = this.context.createBufferSource();
            this.destination = this.context.destination;
            this.loadTrack(parseInt(location.hash.slice(1)) || 0, false);

            this.gainNode = this.context.createGain();
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.gainNode.connect(this.destination);

            this.initHandlers();
        } catch (e) {
            console.log(e);
        }
    },
    loadTrack(index, play = true) {
        const playAfterLoad = play;
        if (index !== 0) {
            location.hash = index;
        } else {
            location.hash = '';
        }
        const self = this;
        let timeout;
        while (timeout = self.timeouts.pop()) {
            clearTimeout(timeout);
        }
        const request = new XMLHttpRequest();
        const track = this.tracks[index];
        this.currentSongIndex = index;
        trackInfo.href = track.link;
        trackInfo.innerText = track.title;
        request.open('GET', track.url, true);
        request.responseType = 'arraybuffer';
        Player.lastDecoding = track.url;
        request.onprogress = (e) => {
            if (Player.lastDecoding !== track.url) {
                return;
            }
            if (!e.lengthComputable) {
                self.loadProgress = 0;
                return;
            }
            self.loadProgress = e.loaded / e.total;
        };
        loadStatusInfo.style.opacity = '1';
        loadStatusInfo.innerText = 'Downloading...';
        request.onload = () => {
            if (Player.lastDecoding !== track.url) {
                return;
            }
            loadStatusInfo.innerText = 'Decoding...';
            self.context.decodeAudioData(request.response, (buffer) => {
                if (Player.lastDecoding !== track.url) {
                    return;
                }
                self.loadProgress = null;
                loadStatusInfo.innerText = 'Done.';
                self.timeouts.push(setTimeout(() => {
                    loadStatusInfo.style.opacity = '0';
                }, 1000));
                Player.stop();
                const newSource = self.context.createBufferSource();
                newSource.connect(self.gainNode);
                newSource.buffer = buffer;
                self.source.disconnect(self.gainNode);
                self.source = newSource;
                self.firstLaunch = true;
                if (playAfterLoad) {
                    Player.play();
                } else {
                    playToggle.style.opacity = '0.7';
                    setTimeout(() => { playToggle.style.opacity = null; }, 1000);
                }
            }).catch(() => {
                self.loadProgress = null;
                loadStatusInfo.innerText = 'Error: unable to decode audio!';
                self.timeouts.push(setTimeout(() => {
                    loadStatusInfo.style.opacity = '0';
                }, 1000));
            });
        };
        request.onerror = () => {
            self.loadProgress = null;
            let seconds = 5;
            const callback = () => {
                if (seconds === 0) {
                    self.loadTrack(index, play);
                    return;
                }
                loadStatusInfo.innerText = `Network error: unable to download audio! Retrying in ${seconds} ${seconds > 1 ? 'seconds' : 'second'}...`;
                seconds--;
                self.timeouts.push(setTimeout(callback, 1000));
            }
            callback();
        }

        request.send();
    },

    nextTrack() {
        ++this.currentSongIndex;
        if (this.currentSongIndex === this.tracks.length) {
            this.currentSongIndex = 0;
        }

        this.loadTrack(this.currentSongIndex);
    },

    prevTrack() {
        --this.currentSongIndex;
        if (this.currentSongIndex === -1) {
            this.currentSongIndex = this.tracks.length - 1;
        }

        this.loadTrack(this.currentSongIndex);
    },

    play() {
        Player.stopped = false;
        this.context.resume && this.context.resume().then(() => {
            setTimeout(() => {
                if (Player.stopped) {
                    return;
                }
                if (Player.context.state !== 'running') {
                    console.log('Firefox bug workaround: force trigger play if context.state is wrong');
                    Player.play();
                }
            }, 1000);
        });
        if (this.firstLaunch) {
            this.source.start();
            this.firstLaunch = false;
        }
        playToggle.classList.remove('play');
    },

    togglePlay() {
        if (Player.context.state === 'running') {
            Player.stop();
        } else {
            Player.play();
        }
    },

    stop() {
        Player.stopped = true;
        this.context.currentTime = 0;
        this.context.suspend().then(() => playToggle.classList.add('play'));
    },

    pause() {
        return this.context.suspend();
    },

    mute() {
        this.gainNode.gain.value = 0;
    },

    unmute() {
        this.gainNode.gain.value = 1;
    },

    initHandlers() {
        const self = this;

        self.context.onstatechange = function() {
            if (self.context.state !== 'running') {
                Octopus.resetFrequencyData();
            }
        }
    }
};
Player.init();

function degToRad(deg) {
    return (deg / 360) * 2 * Math.PI;
}

const Octopus = {
    frequencyData: [],
    dividedFreqMax: [],
    dividedFreqMaxEver: [],
    maxFreqTransition: [],
    legs: [],
    phases: [],
    init(baseWidth, legsCount, jointsCount, animationFrames) {
        const self = this;
        self.animationFrames = animationFrames;
        self.baseWidth = baseWidth;
        for (let i = 0; i < legsCount; i++) {
            let leg = [];
            for (let j = 0; j < jointsCount; j++) {
                leg.push({
                    angle: j === 0 ? 360 * (i / (legsCount - 1)) : 0,
                    width: ((jointsCount - j) / jointsCount) * baseWidth,
                });
            }
            self.legs.push(leg);
        }
        self.dividedFreqMax.length = self.legs.length + 3; // otherwise last leg may be inactive due to mp3 compression frequency cutoff
        self.dividedFreqMaxEver.length = self.dividedFreqMax.length;
        self.maxFreqTransition.length = self.dividedFreqMax.length;
        for (let i = 0; i < self.dividedFreqMax.length; i++) {
            self.phases.push(0);
            self.dividedFreqMax[i] = 1;
            self.dividedFreqMaxEver[i] = 1;
            self.maxFreqTransition[i] = 1;
        }
    },
    resetFrequencyData() {
        const self = this;
        for (let i = 0; i < self.dividedFreqMax.length; i++) {
            self.dividedFreqMax[i] = 1;
            self.dividedFreqMaxEver[i] = 1;
        }
    },
    animate(deltaTime) {
        const self = this;

        self.frequencyData = new Uint8Array(Player.analyser.frequencyBinCount);
        if (Player.context.state === 'running') {
            Player.analyser.getByteFrequencyData(self.frequencyData);
        }

        let sliceSize = Math.floor(self.frequencyData.length / self.dividedFreqMax.length);
        let sliceSums = [];
        for (let i = 0; i < self.dividedFreqMax.length; i++) {
            let tmp_sum = 0;
            for (let j = 0; j < sliceSize; j++) {
                tmp_sum += self.frequencyData[i * sliceSize + j];
            }
            sliceSums.push(tmp_sum);
        }
        const maxFreqTransitionStep = deltaTime / 2500;
        sliceSums.forEach((value, index) => {
            if (self.dividedFreqMax[index] > 1) {
                self.dividedFreqMax[index] -= self.dividedFreqMax[index] / (deltaTime * 10);
                if (self.dividedFreqMax[index] < 1) {
                    self.dividedFreqMax[index] = 1;
                }
            }
            if (value > self.dividedFreqMax[index]) {
                self.dividedFreqMax[index] = value;
                if (self.dividedFreqMax[index] > self.dividedFreqMaxEver[index]) {
                    self.dividedFreqMaxEver[index] = value;
                }
            }
            if (self.dividedFreqMax[index]) {
                self.phases[index] += (value / self.dividedFreqMax[index]) * deltaTime - (deltaTime / 2);
            }
            const desiredValue = self.dividedFreqMax[index] / self.dividedFreqMaxEver[index];
            if (desiredValue > self.maxFreqTransition[index] + maxFreqTransitionStep) {
                self.maxFreqTransition[index] += maxFreqTransitionStep;
            } else if (desiredValue < self.maxFreqTransition[index] - maxFreqTransitionStep) {
                self.maxFreqTransition[index] -= maxFreqTransitionStep;
            }
        });
        self.legs.forEach((leg, i) => {
            let phase = self.phases[i];
            leg.forEach((joint, j) => {
                if (j > 0) {
                    const rotationPhase = (phase / self.animationFrames + (j / (leg.length / (self.maxFreqTransition[i] * 3)))) * 2 * Math.PI;
                    const rotationAmplitude = j / leg.length * 60;
                    if (i % 2 === 0) {
                        self.legs[i][j].angle = Math.cos(rotationPhase) * rotationAmplitude;
                    } else {
                        self.legs[i][j].angle = Math.sin(rotationPhase) * rotationAmplitude;
                    }
                    //self.legs[i][j].width = ((leg.length-j) / leg.length) * (self.dividedFreqMax[i] / 700);
                }
            });
        });
    },
    generatePaths(xCenter, yCenter, jointLength, addAngle = 0, zoomFactor = 1, widthMultiplier = 1) {
        const self = this;
        let result = [];
        self.absoluteLegs().forEach((leg) => {
            let legResult = {
                left: [],
                right: []
            };
            let xCurrent = xCenter;
            let yCurrent = yCenter;
            leg.forEach((joint) => {
                const addedAngle = joint.angle + addAngle;
                legResult.left.push({
                    x: Math.round(xCurrent + Math.cos(degToRad(addedAngle - 90)) * (joint.width / 2 * widthMultiplier) * zoomFactor),
                    y: Math.round(yCurrent + Math.sin(degToRad(addedAngle - 90)) * (joint.width / 2 * widthMultiplier) * zoomFactor),
                });
                legResult.right.push({
                    x: Math.round(xCurrent + Math.cos(degToRad(addedAngle + 90)) * (joint.width / 2 * widthMultiplier) * zoomFactor),
                    y: Math.round(yCurrent + Math.sin(degToRad(addedAngle + 90)) * (joint.width / 2 * widthMultiplier) * zoomFactor),
                });
                xCurrent += Math.cos(degToRad(addedAngle)) * (jointLength / 2) * zoomFactor;
                yCurrent += Math.sin(degToRad(addedAngle)) * (jointLength / 2) * zoomFactor;
            });
            let finalLegResult = [];
            legResult.left.forEach((point) => {
                finalLegResult.push(point);
            });
            finalLegResult.push({
                x: Math.round(xCurrent),
                y: Math.round(yCurrent)
            });
            legResult.right.reverse().forEach((point) => {
                finalLegResult.push(point);
            });
            result.push(finalLegResult);
        });
        return result;
    },
    absoluteLegs() {
        const self = this;
        let result = [];
        self.legs.forEach((leg) => {
            let absoluteJoints = [];
            leg.forEach((joint, i) => {
                let absoluteJoint = Object.assign({}, joint);
                if (i > 0) {
                    absoluteJoint.angle = absoluteJoints[i - 1].angle + joint.angle;
                }
                absoluteJoints.push(absoluteJoint);
            });
            result.push(absoluteJoints);
        });
        return result;
    }
}

function init() {
    Octopus.init(40, 13, 50, 1000);

    const canvas = document.getElementById('view');
    const view = canvas.getContext('2d');
    const m_canvas = document.createElement('canvas');
    const ctx = m_canvas.getContext('2d');

    let phase = 0;

    let zoomFactor;
    let xOffset;
    let yOffset;
    const desiredWidth = 840; // computed once by experiment
    const desiredHeight = 840;
    let xCenter;
    let yCenter;

    function resize() {
        canvas.height = canvas.clientHeight;
        canvas.width = canvas.clientWidth;
        m_canvas.height = canvas.height;
        m_canvas.width = canvas.width;
        if (m_canvas.width / m_canvas.height > (desiredWidth / desiredHeight)) {
            yOffset = 0;
            zoomFactor = m_canvas.height / desiredHeight;
            xOffset = (m_canvas.width / 2) - (desiredWidth * zoomFactor / 2);
        } else {
            xOffset = 0;
            zoomFactor = m_canvas.width / desiredWidth;
            yOffset = (m_canvas.height / 2) - (desiredHeight * zoomFactor / 2);
        }
        xCenter = m_canvas.width / 2;
        yCenter = m_canvas.height / 2;
    }

    resize();

    window.onresize = resize;

    let lastTime = (new Date).getTime();
    let lastSliceSize = 0;
    let animateSlices = 0;
    let sliceAnimateProgress = 0;

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        phase++;

        let newTime = (new Date).getTime();
        Octopus.animate(newTime - lastTime);
        let paths = Octopus.generatePaths(xCenter, yCenter, 30, 180, zoomFactor); // 840 x 735
        paths.forEach((path) => {
            ctx.beginPath();
            ctx.moveTo(xCenter, yCenter);
            if (Player.loadProgress !== null) {
                let sliceSize = Math.ceil(path.length / 2 * Player.loadProgress);
                if (sliceSize > lastSliceSize) {
                    animateSlices += sliceSize - lastSliceSize;
                }
                lastSliceSize = sliceSize;
                if (animateSlices > 0) {
                    sliceSize -= animateSlices - 1;
                }
                const processCutAnimation = (cutPath) => {
                    if (animateSlices === 0 || cutPath.length < 1) {
                        return cutPath;
                    }
                    const lastPoint = cutPath[cutPath.length - 1];
                    if (cutPath.length === 1) {
                        lastPoint.x = lastPoint.x + ((xCenter - lastPoint.x) * (1 - sliceAnimateProgress));
                        lastPoint.y = lastPoint.y + ((yCenter - lastPoint.y) * (1 - sliceAnimateProgress));
                    } else {
                        const preLastPoint = cutPath[cutPath.length - 2];
                        lastPoint.x = lastPoint.x + ((preLastPoint.x - lastPoint.x) * (1 - sliceAnimateProgress));
                        lastPoint.y = lastPoint.y + ((preLastPoint.y - lastPoint.y) * (1 - sliceAnimateProgress));
                    }
                    sliceAnimateProgress += (newTime - lastTime) / 5000;
                    if (sliceAnimateProgress >= 1) {
                        animateSlices--;
                        sliceAnimateProgress = 0;
                    }
                    return cutPath;
                };
                let cutPath = processCutAnimation(path.slice(0, sliceSize));
                cutPath.push(...processCutAnimation(path.slice(-sliceSize).reverse()).reverse());
                path = cutPath;
            } else {
                animateSlices = 0;
                sliceAnimateProgress = 0;
            }
            path.forEach((coords) => {
                ctx.lineTo(coords.x, coords.y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        });
        if (Player.loadProgress !== null) {
            Octopus.generatePaths(xCenter, yCenter, 30, 180, zoomFactor).forEach((path) => {
                ctx.beginPath();
                ctx.moveTo(xCenter, yCenter);
                path.forEach((coords) => {
                    ctx.lineTo(coords.x, coords.y);
                });
                ctx.closePath();
                ctx.stroke();
            });
        }
        view.clearRect(0, 0, canvas.width, canvas.height);
        view.drawImage(m_canvas, 0, 0);
        lastTime = newTime;
        requestAnimationFrame(render);
    }

    render();
    return true;
}

init();
