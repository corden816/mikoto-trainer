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

// Sample texts
const sampleTexts = {
    1: "Sample text 1",
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
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioContext.createAnalyser();
}

// Play native speaker audio
function playNativeSpeaker() {
    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    statusElement.textContent = 'Loading audio...';
    playButton.disabled = true;

    // iOS Safari를 위한 오디오 컨텍스트 초기화
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const audioPath = `audio/native-speaker${currentSample}.mp3?v=${new Date().getTime()}`;
    
    fetch(audioPath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Audio file not found');
            }
            return response.blob();
        })
        .then(blob => {
            currentAudio = new Audio(URL.createObjectURL(blob));
            currentAudio.preload = 'auto';

            // iOS Safari를 위한 추가 설정
            currentAudio.setAttribute('playsinline', '');
            currentAudio.setAttribute('webkit-playsinline', '');

            // 이벤트 리스너 설정
            currentAudio.addEventListener('canplaythrough', () => {
                statusElement.textContent = 'Playing audio...';
                currentAudio.play()
                    .then(() => {
                        console.log('Audio playing successfully');
                    })
                    .catch(error => {
                        console.error('Play error:', error);
                        statusElement.textContent = 'Tap to play audio';
                        
                        // iOS에서의 수동 재생 처리
                        const playAudioManually = () => {
                            currentAudio.play()
                                .then(() => {
                                    statusElement.textContent = 'Playing audio...';
                                })
                                .catch(e => console.error('Manual play failed:', e));
                            statusElement.removeEventListener('click', playAudioManually);
                        };
                        statusElement.addEventListener('click', playAudioManually);
                    });
            });

            currentAudio.addEventListener('ended', () => {
                statusElement.textContent = 'Audio finished';
                playButton.disabled = false;
            });

            currentAudio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                statusElement.textContent = 'Error playing audio';
                playButton.disabled = false;
            });

            // 로딩 시작
            currentAudio.load();
        })
        .catch(error => {
            console.error('Audio fetch error:', error);
            statusElement.textContent = 'Error loading audio';
            playButton.disabled = false;
        });
}

// Add this function to initialize audio playback on first user interaction
function initAudioPlayback() {
    // Create and immediately play + pause a silent audio to initialize audio context
    const silentAudio = new Audio();
    silentAudio.play().then(() => {
        silentAudio.pause();
    }).catch(e => console.log('Silent audio initialization failed:', e));
    
    // Remove the event listener after first interaction
    document.removeEventListener('click', initAudioPlayback);
}
// Mobile-specific initialization
function initMobileSupport() {
    const playButton = document.getElementById('playNative');
    const startRecordButton = document.getElementById('startRecording');
    const sampleButtons = document.querySelectorAll('.sample-btn');
    
    // iOS에서 오디오 재생을 위한 초기화
    const unlockAudioContext = () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        document.removeEventListener('touchstart', unlockAudioContext);
        document.removeEventListener('click', unlockAudioContext);
    };

    document.addEventListener('touchstart', unlockAudioContext);
    document.addEventListener('click', unlockAudioContext);

    // 모바일에서의 버튼 이벤트 처리
    if (playButton) {
        playButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            playNativeSpeaker();
        });
    }

    if (startRecordButton) {
        startRecordButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            startRecording();
        });
    }

    sampleButtons.forEach(btn => {
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const sampleNumber = parseInt(this.dataset.sample);
            changeSample(sampleNumber);
        });
    });
}
// Modify your DOMContentLoaded event listener to include audio initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK);
        await waitForSDK();
        initSpeechSDK();
        console.log("Speech SDK initialized successfully");
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Initializing application...");
        
        // 모바일 기기 감지 코드 추가
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        if (isMobile) {
            console.log('Mobile device detected:', isiOS ? 'iOS' : 'Android');
            initMobileSupport();
        }

        // 나머지 기존 코드는 그대로 유지
        await waitForSDK();
        initSpeechSDK();
        // ... (기존 코드 계속)
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
        const practiceText = document.querySelector('.practice-text');
        if (practiceText) {
            practiceText.textContent = sampleTexts[1];
        }

        // Add click listener for audio initialization
        document.addEventListener('click', initAudioPlayback);

        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleNumber = parseInt(e.target.dataset.sample);
                changeSample(sampleNumber);
            });
        });

        document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
        document.getElementById('startRecording').addEventListener('click', startRecording);

        // Add mobile browser detection
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('Mobile browser detected, applying mobile-specific optimizations');
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Stop recording
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => {
                console.log('Recognition stopped');
                document.getElementById('status').textContent = 'Recording stopped';
                isRecording = false;
                document.getElementById('startRecording').disabled = false;
                
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

// Start recording
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
        setTimeout(stopRecording, 30000); // Auto-stop after 30 seconds
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('status').textContent = `Error accessing microphone: ${error.message}`;
    }
}

// Change sample
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

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Checking if SpeechSDK is loaded:", window.SpeechSDK);
        await waitForSDK();
        initSpeechSDK();
        console.log("Speech SDK initialized successfully");

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
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Add analyzePronunciation function if not defined elsewhere
function analyzePronunciation(pronunciationResult) {
    if (!pronunciationResult) {
        console.error('No pronunciation result to analyze');
        return;
    }

    // Display the pronunciation score
    const scoreElement = document.getElementById('pronunciationScore');
    if (scoreElement) {
        scoreElement.textContent = `Pronunciation Score: ${pronunciationResult.pronunciationScore}`;
    }

    // Display detailed feedback
    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
        feedbackElement.textContent = `Accuracy: ${pronunciationResult.accuracyScore}
            Fluency: ${pronunciationResult.fluencyScore}
            Completeness: ${pronunciationResult.completenessScore}`;
    }
}
