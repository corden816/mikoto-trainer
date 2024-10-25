const config = {
    apiKey: "fad4e222a3854bb99ed337f837a4e21c",
    region: "koreacentral"
};

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

// 샘플 텍스트 (나중에 실제 텍스트로 교체)
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
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;
}

// Initialize Azure Speech SDK
function initSpeechSDK() {
    speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.apiKey, config.region);
    speechConfig.speechRecognitionLanguage = "en-US";
}

// Play native speaker audio
function playNativeSpeaker() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    const audioUrl = `https://raw.githubusercontent.com/corden816/mikoto-trainer/main/native-speaker${currentSample}.mp3`;
    currentAudio = new Audio(audioUrl);
    
    document.getElementById('playNative').disabled = true;
    
    currentAudio.play().catch(error => {
        console.error('Error playing audio:', error);
        document.getElementById('playNative').disabled = false;
    });

    currentAudio.onended = () => {
        document.getElementById('playNative').disabled = false;
    };
}

// 샘플 변경 함수
function changeSample(sampleNumber) {
    currentSample = sampleNumber;
    document.querySelector('.practice-text').textContent = sampleTexts[sampleNumber];
    
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

// Update volume indicator
function updateVolumeIndicator(stream) {
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    mediaStreamSource.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    function draw() {
        if (!isRecording) return;
        
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const volume = Math.min(100, Math.max(0, average * 2));
        
        document.getElementById('volumeBar').style.width = volume + '%';
    }
    
    draw();
}

// Start recording
async function startRecording() {
    if (!audioContext) {
        await initAudioContext();
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        updateVolumeIndicator(stream);

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
        };
        
        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };
        
        recognizer.startContinuousRecognitionAsync();
        
        setTimeout(stopRecording, 5000);
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
        
        if (mediaStreamSource) {
            mediaStreamSource.disconnect();
        }
    }
}

// Analyze pronunciation
function analyzePronunciation(pronunciationResult) {
    const accuracyScore = pronunciationResult.accuracyScore;
    const fluencyScore = pronunciationResult.fluencyScore;
    const pronunciationScore = pronunciationResult.pronunciationScore;
    const completenessScore = pronunciationResult.completenessScore;
    
    const overallScore = Math.round((accuracyScore + fluencyScore + pronunciationScore + completenessScore) / 4);
    
    document.getElementById('pronunciationScore').textContent = `Pronunciation Score: ${overallScore}%`;
    
    let feedback = '';
    if (overallScore >= 90) {
        feedback = 'Excellent! Native-like pronunciation.';
    } else if (overallScore >= 70) {
        feedback = 'Good pronunciation. Keep practicing!';
    } else {
        feedback = 'Need more practice. Try listening to the native speaker again.';
    }
    
    document.getElementById('feedback').textContent = feedback;
    
    updateChart({
        accuracy: accuracyScore,
        fluency: fluencyScore,
        pronunciation: pronunciationScore,
        completeness: completenessScore,
        overall: overallScore
    });
}

// Update chart
function updateChart(scores) {
    const ctx = document.getElementById('pronunciationChart').getContext('2d');
    
    if (window.pronunciationChart) {
        window.pronunciationChart.destroy();
    }
    
    window.pronunciationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Accuracy', 'Fluency', 'Pronunciation', 'Completeness', 'Overall'],
            datasets: [{
                label: 'Pronunciation Scores',
                data: [
                    scores.accuracy,
                    scores.fluency,
                    scores.pronunciation,
                    scores.completeness,
                    scores.overall
                ],
                backgroundColor: [
                    '#007bff',
                    '#28a745',
                    '#ffc107',
                    '#17a2b8',
                    '#dc3545'
                ]
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initSpeechSDK();
    changeSample(1);
    
    document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
    document.getElementById('startRecording').addEventListener('click', startRecording);
    
    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sampleNumber = parseInt(e.target.dataset.sample);
            changeSample(sampleNumber);
        });
    });
});
