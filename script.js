let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;

// 샘플 텍스트
const sampleTexts = {
    1: "Sample text 1",
    2: "Sample text 2",
    3: "Sample text 3",
    4: "Sample text 4",
    5: "Sample text 5"
};

// Initialize audio context
async function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
}

// Initialize Azure Speech SDK
function initSpeechSDK() {
    if (window.SpeechSDK) {
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(window.config.apiKey, window.config.region);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized successfully');
    } else {
        console.error('Speech SDK not found');
    }
}

// 샘플 변경 함수
function changeSample(sampleNumber) {
    currentSample = sampleNumber;
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber];
    }

    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.sample === String(sampleNumber)) {
            btn.classList.add('active');
        }
    });

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

// Play native speaker audio
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    document.getElementById('status').textContent = 'Loading audio...';
    document.getElementById('playNative').disabled = true;

    // 경로를 수정하여 오디오 파일 로드
    currentAudio = new Audio();
    currentAudio.src = `audio/native-speaker${currentSample}.mp3`; // audio 경로가 포함된 파일 경로
    currentAudio.oncanplaythrough = () => {
        document.getElementById('status').textContent = 'Playing audio...';
        currentAudio.play().catch(error => {
            console.error('Play error:', error);
            document.getElementById('status').textContent = 'Error playing audio';
            document.getElementById('playNative').disabled = false;
        });
    };

    currentAudio.onended = () => {
        document.getElementById('status').textContent = 'Audio finished';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.onerror = () => {
        console.error('Audio loading error');
        document.getElementById('status').textContent = 'Error loading audio';
        document.getElementById('playNative').disabled = false;
    };

    currentAudio.load();
}

// Start recording
async function startRecording() {
    if (!audioContext) {
        await initAudioContext();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        updateVolumeIndicator(stream); // Volume indicator to show real-time changes

        const referenceText = document.querySelector('.practice-text').textContent;
        
        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        pronunciationAssessmentConfig.applyTo(recognizer);

        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('status').textContent = 'Recording... Speak now!';

        recognizer.recognizing = (s, e) => {
            document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
            
            // Adjust volume bar color based on recognition confidence level
            const confidenceLevel = e.result.confidence;
            const volumeBar = document.getElementById('volumeBar');
            if (confidenceLevel > 0.75) {
                volumeBar.style.backgroundColor = '#28a745'; // Green for high confidence
            } else if (confidenceLevel > 0.5) {
                volumeBar.style.backgroundColor = '#ffc107'; // Yellow for moderate confidence
            } else {
                volumeBar.style.backgroundColor = '#dc3545'; // Red for low confidence
            }
        };

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };

        recognizer.startContinuousRecognitionAsync();
        
        // Set recording timeout to 30 seconds
        setTimeout(stopRecording, 30000);
    } catch (error) {
        console.error('Error starting recording:', error);
        document.getElementById('status').textContent = 'Error accessing microphone';
    }
}

// Stop recording
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync();
        isRecording = false;
        document.getElementById('startRecording').disabled = false;
        document.getElementById('status').textContent = 'Recording stopped';

        // Reset the volume bar color to its original state
        document.getElementById('volumeBar').style.backgroundColor = '#4CAF50';

        if (mediaStreamSource) {
            mediaStreamSource.disconnect();
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    
    try {
        await waitForSDK();
        initSpeechSDK();

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
