
// Global variables
let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;

let pitchAnalyzer = {
    nativePitchData: [], 
    userPitchData: [],   
    isRecording: false,
    audioContext: null,
    analyzer: null,

    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
    },

    collectPitchData(audioData, isNative = false) {
        const bufferLength = this.analyzer.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyzer.getFloatTimeDomainData(dataArray);
        
        const pitch = this.calculatePitch(dataArray);
        
        if (isNative) {
            this.nativePitchData.push(pitch);
        } else {
            this.userPitchData.push(pitch);
        }
    },

    calculatePitch(buffer) {
        const sampleRate = this.audioContext.sampleRate;
        let correlation = new Array(buffer.length).fill(0);
        
        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < buffer.length - i; j++) {
                correlation[i] += buffer[j] * buffer[j + i];
            }
        }

        let peak = 0;
        for (let i = 1; i < correlation.length; i++) {
            if (correlation[i] > correlation[peak]) {
                peak = i;
            }
        }

        return sampleRate / peak;
    },

    calculateSimilarity() {
        if (this.nativePitchData.length === 0 || this.userPitchData.length === 0) {
            return 0;
        }

        const normalizedNative = this.normalizePitchData(this.nativePitchData);
        const normalizedUser = this.normalizePitchData(this.userPitchData);

        let similarity = this.calculateCorrelation(normalizedNative, normalizedUser);
        return Math.max(0, similarity) * 100;
    },

    normalizePitchData(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        const std = Math.sqrt(data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length);
        return data.map(x => (x - mean) / std);
    },

    calculateCorrelation(array1, array2) {
        const length = Math.min(array1.length, array2.length);
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;

        for (let i = 0; i < length; i++) {
            sum1 += array1[i];
            sum2 += array2[i];
            sum1Sq += array1[i] ** 2;
            sum2Sq += array2[i] ** 2;
            pSum += array1[i] * array2[i];
        }

        const num = pSum - (sum1 * sum2 / length);
        const den = Math.sqrt((sum1Sq - sum1 ** 2 / length) * (sum2Sq - sum2 ** 2 / length));
        return num / den;
    },

    displayResults() {
        const similarity = this.calculateSimilarity();
        const feedbackElement = document.getElementById('feedback');
        
        if (feedbackElement) {
            let currentFeedback = feedbackElement.textContent;
            feedbackElement.textContent = currentFeedback + `\n\n억양 유사도: ${similarity.toFixed(1)}%\n`;
            
            if (similarity >= 80) {
                feedbackElement.textContent += "훌륭합니다! 원어민과 매우 비슷한 억양입니다.";
            } else if (similarity >= 60) {
                feedbackElement.textContent += "좋습니다. 억양이 꽤 자연스럽습니다.";
            } else {
                feedbackElement.textContent += "원어민 음성을 다시 들어보고 억양에 더 신경써보세요.";
            }
        }
    },

    reset() {
        this.nativePitchData = [];
        this.userPitchData = [];
    }
};
// Sample texts
const sampleTexts = {
    1: `Whenever you walk along the street of small town of Sasebo, Japan, you will notice the long waiting line in front of the hamburger house. And looking around, you will find so many more hamburger places along the street. Then you might be thinking, why hamburger is so popular here? It's even a Japan.

The hidden story of Sasebo hamburger is back to 1940's. During the World War 2, Sasebo was IJN's one of the biggest naval base. Several shipyards and factories for supply were located there. But after the war, the entire facilities were under controll of US navy, and Sasebo city becomes essential supply base for US navy pacific fleet. During the Korean War, more than 20,000 troops were sent to the base for operation.`,
    2: "Sample text 2",
    3: "Sample text 3",
    4: "Sample text 4",
    5: "Sample text 5"
};

// Initialize Azure Speech SDK
function initSpeechSDK() {
    if (window.SpeechSDK) {
        console.log("Speech SDK is available");
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized successfully');
    } else {
        console.error('Speech SDK not found');
    }
}

// Wait until the Speech SDK is loaded
function waitForSDK() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.SpeechSDK) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// Initialize audio context
function initAudioVisualizer() {
    const canvas = document.getElementById('audioVisualizer');
    audioVisualizerContext = canvas.getContext('2d');
}

// 오디오 시각화 함수
function visualizeAudio(stream) {
    const audioSource = audioContext.createMediaStreamSource(stream);
    audioSource.connect(analyser);
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        audioVisualizerContext.fillStyle = 'rgb(200, 200, 200)';
        audioVisualizerContext.fillRect(0, 0, canvas.width, canvas.height);
        audioVisualizerContext.lineWidth = 2;
        audioVisualizerContext.strokeStyle = 'rgb(0, 0, 0)';
        audioVisualizerContext.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                audioVisualizerContext.moveTo(x, y);
            } else {
                audioVisualizerContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        audioVisualizerContext.lineTo(canvas.width, canvas.height / 2);
        audioVisualizerContext.stroke();
    }

    draw();
}

// Azure Speech SDK 초기화
function initSpeechSDK() {
    if (window.SpeechSDK) {
        console.log("Speech SDK is available");
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized successfully');
    } else {
        console.error('Speech SDK not found');
    }
}

// SDK 로딩 대기
function waitForSDK() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.SpeechSDK) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// 오디오 컨텍스트 초기화
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
}

// 네이티브 스피커 오디오 재생
async function playNativeSpeaker() {
    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    statusElement.textContent = 'Loading audio...';
    playButton.disabled = true;

    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const audioPath = `audio/native-speaker${currentSample}.mp3?v=${new Date().getTime()}`;
    
    try {
        const response = await fetch(audioPath);
        if (!response.ok) throw new Error('Audio file not found');
        
        const blob = await response.blob();
        currentAudio = new Audio(URL.createObjectURL(blob));
        currentAudio.preload = 'auto';
        
        currentAudio.setAttribute('playsinline', '');
        currentAudio.setAttribute('webkit-playsinline', '');

        currentAudio.addEventListener('canplaythrough', () => {
            statusElement.textContent = 'Playing audio...';
            currentAudio.play()
                .catch(error => {
                    console.error('Play error:', error);
                    statusElement.textContent = 'Tap to play audio';
                });
        });

        currentAudio.addEventListener('ended', () => {
            statusElement.textContent = 'Audio finished';
            playButton.disabled = false;
        });

        currentAudio.addEventListener('error', () => {
            statusElement.textContent = 'Error playing audio';
            playButton.disabled = false;
        });

        currentAudio.load();
    } catch (error) {
        console.error('Audio fetch error:', error);
        statusElement.textContent = 'Error loading audio';
        playButton.disabled = false;
    }
}

// 녹음 시작
async function startRecording() {
    console.log("Attempting to start recording...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Microphone access not supported on this device';
        console.error("Browser does not support getUserMedia");
        return;
    }

    try {
        await initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted");
        
        visualizeAudio(stream);  // 오디오 시각화 시작

        const referenceText = document.querySelector('.practice-text').textContent;
        if (!referenceText) {
            console.error("Reference text not found");
            return;
        }

        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        if (!speechConfig) {
            console.error("Speech SDK configuration is missing");
            return;
        }

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.recognizing = (s, e) => {
            console.log(`Recognizing: ${e.result.text}`);
            document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                console.log("Pronunciation Result:", pronunciationResult);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('status').textContent = `Error accessing microphone: ${error.message}`;
    }
}

// 녹음 중지
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => {
                console.log('Recognition stopped');
                document.getElementById('status').textContent = 'Recording stopped';
                isRecording = false;
                document.getElementById('startRecording').disabled = false;
                document.getElementById('stopRecording').disabled = true;
                
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                
                if (audioConfig) {
                    audioConfig.close();
                }
                if (recognizer) {
                    recognizer.close();
                }
            },
            (err) => {
                console.error('Error stopping recognition:', err);
                document.getElementById('status').textContent = `Error stopping recognition: ${err}`;
            }
        );
    }
}

// 샘플 변경
function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "Sample text not found";
    }
    
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.sample) === sampleNumber);
    });
    
    currentSample = sampleNumber;
}

// 발음 분석
function analyzePronunciation(pronunciationResult) {
    if (!pronunciationResult) {
        console.error('No pronunciation result to analyze');
        return;
    }

    const scoreElement = document.getElementById('pronunciationScore');
    if (scoreElement) {
        scoreElement.textContent = `Pronunciation Score: ${pronunciationResult.pronunciationScore}`;
    }

    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
        feedbackElement.textContent = `Accuracy: ${pronunciationResult.accuracyScore}
            Fluency: ${pronunciationResult.fluencyScore}
            Completeness: ${pronunciationResult.completenessScore}`;
    }
    pitchAnalyzer.displayResults();
}

// 모바일 지원 초기화
function initMobileSupport() {
    const unlockAudioContext = async () => {
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        if (pitchAnalyzer.audioContext && pitchAnalyzer.audioContext.state === 'suspended') {
            await pitchAnalyzer.audioContext.resume();
        }
        document.removeEventListener('touchstart', unlockAudioContext);
        document.removeEventListener('click', unlockAudioContext);
    };

    document.addEventListener('touchstart', unlockAudioContext);
    document.addEventListener('click', unlockAudioContext);
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        initAudioVisualizer();
        pitchAnalyzer.init();
        await waitForSDK();
        initSpeechSDK();
        
        if (isMobile) {
            console.log('Mobile device detected:', isiOS ? 'iOS' : 'Android');
            initMobileSupport();
            
            document.addEventListener('touchstart', async () => {
                if (audioContext && audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                if (pitchAnalyzer.audioContext && pitchAnalyzer.audioContext.state === 'suspended') {
                    await pitchAnalyzer.audioContext.resume();
                }
            }, { once: true });
        }

        const practiceText = document.querySelector('.practice-text');
        if (practiceText) {
            practiceText.textContent = sampleTexts[1];
        }

        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleNumber = parseInt(e.target.dataset.sample);
                changeSample(sampleNumber);
            });
        });

        document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
        document.getElementById('startRecording').addEventListener('click', startRecording);
        document.getElementById('stopRecording').addEventListener('click', stopRecording);
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
