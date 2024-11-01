// 전역 변수
const React = window.React;
const ReactDOM = window.ReactDOM;
// React, ReactDOM 선언 후에 추가
import PronunciationVisualizer from './components/PronunciationVisualizer.js';
let audioContext;
let visualizerAnalyser;
let speechConfig;
let audioConfig;
let recognizer;
let isRecording = false;
let currentAudio = null;
let currentSample = 1;
let audioVisualizerContext;
let animationFrameId;
let userDataInterval;

// 스타일 적용 함수 - analyzePronunciation 함수 밖으로 이동
function applyStylesToFeedback() {
    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
        feedbackElement.style.whiteSpace = 'pre-wrap';
        feedbackElement.style.fontFamily = 'monospace';
        feedbackElement.style.padding = '15px';
        feedbackElement.style.borderRadius = '5px';
        feedbackElement.style.backgroundColor = '#f8f9fa';
        feedbackElement.style.border = '1px solid #dee2e6';
    }
}

let pitchAnalyzer = {
    nativePitchData: [],
    userPitchData: [],
    isRecording: false,
    audioContext: null,
    nativeAnalyzer: null,
    userAnalyzer: null,

    init() {
        this.audioContext = audioContext;
        this.nativeAnalyzer = this.audioContext.createAnalyser();
        this.userAnalyzer = this.audioContext.createAnalyser();
        this.nativeAnalyzer.fftSize = 2048;
        this.userAnalyzer.fftSize = 2048;
    },

    collectPitchData(audioData, isNative = false) {
        const pitch = this.calculatePitch(audioData);

        if (pitch > 0 && !isNaN(pitch) && isFinite(pitch)) {
            if (isNative) {
                this.nativePitchData.push(pitch);
            } else {
                this.userPitchData.push(pitch);
            }
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

        let peak = -1;
        let maxCorrelation = 0;

        for (let i = 1; i < correlation.length; i++) {
            if (correlation[i] > maxCorrelation) {
                maxCorrelation = correlation[i];
                peak = i;
            }
        }

        if (peak <= 0) {
            return 0;
        } else {
            return sampleRate / peak;
        }
    },

    normalizePitchData(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        const std = Math.sqrt(variance);

        if (std === 0 || isNaN(std)) {
            return data.map(() => 0);
        }

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

        if (den === 0 || isNaN(den)) {
            return 0;
        }

        return num / den;
    },

    calculateSimilarity() {
        if (this.nativePitchData.length === 0 || this.userPitchData.length === 0) {
            console.warn('Insufficient data for similarity calculation.');
            return 0;
        }

        const normalizedNative = this.normalizePitchData(this.nativePitchData);
        const normalizedUser = this.normalizePitchData(this.userPitchData);

        let similarity = this.calculateCorrelation(normalizedNative, normalizedUser);

        console.log('Calculated Similarity:', similarity);

        return Math.max(0, similarity) * 100;
    },

    displayResults() {
        console.log('Native Pitch Data Length:', this.nativePitchData.length);
        console.log('User Pitch Data Length:', this.userPitchData.length);

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

// 샘플 텍스트
const sampleTexts = {
    1: `Here's everything you need to know about the new McDonald's app. It's all the things you love about McDonald's at your fingertips.`,
    2: `御坂美琴ほんとに素晴らし力だね?`,
    3: `Whenever you walk along the street of small town of Sasebo, Japan, you will notice the long waiting line in front of the hamburger house. And looking around, you will find so many more hamburger places along the street. Then you might be thinking, why hamburger is so popular here? It's even a Japan.

The hidden story of Sasebo hamburger is back to 1940's. During the World War 2, Sasebo was IJN's one of the biggest naval base. Several shipyards and factories for supply were located there. But after the war, the entire facilities were under controll of US navy, and Sasebo city becomes essential supply base for US navy pacific fleet. During the Korean War, more than 20,000 troops were sent to the base for operation.`
};

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

// AudioContext 초기화
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        pitchAnalyzer.init();
        initAudioVisualizer();
    }
}

// 오디오 시각화 초기화
function initAudioVisualizer() {
    const canvas = document.getElementById('audioVisualizer');
    audioVisualizerContext = canvas.getContext('2d');
    visualizerAnalyser = audioContext.createAnalyser();
    visualizerAnalyser.fftSize = 2048;
}

// 오디오 시각화 함수
function visualizeAudio(stream) {
    if (!audioContext) {
        initAudioContext();
    }
    const canvas = document.getElementById('audioVisualizer');
    const audioSource = audioContext.createMediaStreamSource(stream);
    audioSource.connect(visualizerAnalyser);

    const bufferLength = visualizerAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animationFrameId = requestAnimationFrame(draw);
        visualizerAnalyser.getByteTimeDomainData(dataArray);

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

// 네이티브 스피커 오디오 재생
async function playNativeSpeaker() {
    initAudioContext();
    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    statusElement.textContent = 'Loading audio...';
    playButton.disabled = true;

    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const audioPath = `audio/native-speaker${currentSample}.mp3`;

    try {
        const audioElement = new Audio(audioPath);
        const source = audioContext.createMediaElementSource(audioElement);

        source.connect(pitchAnalyzer.nativeAnalyzer);
        source.connect(visualizerAnalyser);

        pitchAnalyzer.nativeAnalyzer.connect(audioContext.destination);

        audioElement.oncanplaythrough = () => {
            audioElement.play();
            const bufferLength = pitchAnalyzer.nativeAnalyzer.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);

            const dataCollectionInterval = setInterval(() => {
                pitchAnalyzer.nativeAnalyzer.getFloatTimeDomainData(dataArray);
                pitchAnalyzer.collectPitchData(dataArray, true);
            }, 100);

            audioElement.onended = () => {
                clearInterval(dataCollectionInterval);
                statusElement.textContent = 'Audio finished';
                playButton.disabled = false;
            };

            statusElement.textContent = 'Playing audio...';
            currentAudio = audioElement;
        };

        audioElement.load();

    } catch (error) {
        console.error('Audio playback error:', error);
        statusElement.textContent = 'Error loading audio';
        playButton.disabled = false;
    }
}

// 녹음 시작
// 녹음 시작
async function startRecording() {
    console.log("Attempting to start recording...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Microphone access not supported on this device';
        console.error("Browser does not support getUserMedia");
        return;
    }

    try {
        initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted");

        visualizeAudio(stream);

        const audioSource = audioContext.createMediaStreamSource(stream);
        audioSource.connect(pitchAnalyzer.userAnalyzer);
        audioSource.connect(visualizerAnalyser);

        const dataArray = new Float32Array(pitchAnalyzer.userAnalyzer.frequencyBinCount);

        function collectUserData() {
            pitchAnalyzer.userAnalyzer.getFloatTimeDomainData(dataArray);
            pitchAnalyzer.collectPitchData(dataArray, false);
        }

        userDataInterval = setInterval(collectUserData, 100);

        const referenceText = document.querySelector('.practice-text').textContent;
        if (!referenceText) {
            console.error("Reference text not found");
            return;
        }

        // PronunciationAssessmentConfig 설정 수정
        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        // 추가 설정
        pronunciationAssessmentConfig.enableProsodyAssessment = true;  // 운율 평가 활성화
        pronunciationAssessmentConfig.enableDetailedResultOutput = true;  // 상세 결과 출력 활성화
        
        // JSON 형식 설정 추가
        speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        
        // 인식기 설정
        if (!speechConfig) {
            console.error("Speech SDK configuration is missing");
            return;
        }

        audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        
        // 발음 평가 구성 적용
        pronunciationAssessmentConfig.applyTo(recognizer);

        // 인식 이벤트 핸들러 설정
        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                // 결과 로깅 추가
                console.log("Raw recognition result:", e.result);
                console.log("Recognition text:", e.result.text);
                
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                console.log("Pronunciation assessment result:", pronunciationResult);
                
                analyzePronunciation(pronunciationResult);
            }
        };

        // 나머지 코드는 동일...
        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
        document.getElementById('status').textContent = 'Recording... Speak now!';

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
                if (userDataInterval) {
                    clearInterval(userDataInterval);
                }
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

// 발음 분석 - 개선된 버전
// 발음 분석
// 발음 분석 함수 수정
function analyzePronunciation(pronunciationResult) {
    if (!pronunciationResult) {
        console.error('No pronunciation result to analyze');
        return;
    }

    // 기본 점수 표시
    const scoreElement = document.getElementById('pronunciationScore');
    if (scoreElement) {
        scoreElement.textContent = `발음 점수: ${pronunciationResult.pronunciationScore.toFixed(1)}
정확성: ${pronunciationResult.accuracyScore.toFixed(1)}
유창성: ${pronunciationResult.fluencyScore.toFixed(1)}
완결성: ${pronunciationResult.completenessScore.toFixed(1)}`;
    }

    // JSON 파싱
    const assessmentJson = JSON.parse(pronunciationResult.privJson);
    
    // React 컴포넌트 렌더링
    const root = document.getElementById('pronunciationVisualizer');
    if (root) {
        if (!root._reactRootContainer) {
            ReactDOM.createRoot(root).render(
                React.createElement(PronunciationVisualizer, {
                    assessmentData: {
                        pronunciationScore: pronunciationResult.pronunciationScore,
                        accuracyScore: pronunciationResult.accuracyScore,
                        fluencyScore: pronunciationResult.fluencyScore,
                        completenessScore: pronunciationResult.completenessScore,
                        words: assessmentJson.NBest[0].Words.map(word => ({
                            word: word.Word,
                            accuracyScore: word.PronunciationAssessment?.AccuracyScore || 0,
                            fluencyScore: word.PronunciationAssessment?.FluencyScore || 0,
                            phonemes: word.Phonemes || []
                        }))
                    }
                })
            );
        }
    }

    // pitchAnalyzer 결과 표시
    pitchAnalyzer.displayResults();
    pitchAnalyzer.reset();
}

function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "Sample text not found";
    }

    document.querySelectorAll('.sample-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.sample) === sampleNumber);
    });

    currentSample = sampleNumber;
    pitchAnalyzer.reset();
}

// 모바일 지원 초기화
function initMobileSupport() {
    const unlockAudioContext = async () => {
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
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

        await waitForSDK();
        initSpeechSDK();

        if (isMobile) {
            console.log('Mobile device detected:', isiOS ? 'iOS' : 'Android');
            initMobileSupport();
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
        
        // 피드백 스타일 적용
        applyStylesToFeedback();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
