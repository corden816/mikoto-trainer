// Global variables
let audioContext;
let analyser;
let mediaStreamSource;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let nativeSpeakerAudio;

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

// Load native speaker audio
async function loadNativeSpeakerAudio() {
    nativeSpeakerAudio = new Audio('native-speaker.mp3');
    nativeSpeakerAudio.load();
}

// Play native speaker audio
function playNativeSpeaker() {
    if (nativeSpeakerAudio) {
        nativeSpeakerAudio.play();
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
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    updateVolumeIndicator(stream);
    
    audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
    recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    
    isRecording = true;
    document.getElementById('startRecording').disabled = true;
    document.getElementById('status').textContent = 'Recording... Speak now!';
    
    recognizer.recognizing = (s, e) => {
        document.getElementById('status').textContent = `Recognizing: ${e.result.text}`;
    };
    
    recognizer.recognized = (s, e) => {
        if (e.result.text) {
            analyzePronunciation(e.result);
        }
    };
    
    recognizer.startContinuousRecognitionAsync();
    
    // Stop recording after 5 seconds
    setTimeout(stopRecording, 5000);
}

// Stop recording
function stopRecording() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync();
        isRecording = false;
        document.getElementById('startRecording').disabled = false;
        document.getElementById('status').textContent = 'Recording stopped';
    }
}

// Analyze pronunciation
function analyzePronunciation(result) {
    // This is a simplified scoring mechanism. In reality, you'd want to use
    // Azure's pronunciation assessment API for more accurate results
    const confidenceScore = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
    const score = Math.round(parseFloat(confidenceScore) * 100);
    
    document.getElementById('pronunciationScore').textContent = `Pronunciation Score: ${score}%`;
    
    let feedback = '';
    if (score >= 90) {
        feedback = 'Excellent! Native-like pronunciation.';
    } else if (score >= 70) {
        feedback = 'Good pronunciation. Keep practicing!';
    } else {
        feedback = 'Need more practice. Try listening to the native speaker again.';
    }
    
    document.getElementById('feedback').textContent = feedback;
    
    updateChart(score);
}

// Update chart
function updateChart(score) {
    const ctx = document.getElementById('pronunciationChart').getContext('2d');
    
    if (window.pronunciationChart) {
        window.pronunciationChart.destroy();
    }
    
    window.pronunciationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Your Score', 'Native Level'],
            datasets: [{
                label: 'Pronunciation Comparison',
                data: [score, 100],
                backgroundColor: ['#007bff', '#28a745']
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initSpeechSDK();
    loadNativeSpeakerAudio();
    
    document.getElementById('playNative').addEventListener('click', playNativeSpeaker);
    document.getElementById('startRecording').addEventListener('click', startRecording);
});
