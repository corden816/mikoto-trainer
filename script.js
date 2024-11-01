// 전역 변수 선언
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

// 샘플 텍스트 정의
const sampleTexts = {
    1: `Here's everything you need to know about the new McDonald's app. It's all the things you love about McDonald's at your fingertips.`,
    2: `御坂美琴ほんとに素晴らし力だね?`,
    3: `Whenever you walk along the street of small town of Sasebo, Japan, you will notice the long waiting line in front of the hamburger house. And looking around, you will find so many more hamburger places along the street. Then you might be thinking, why hamburger is so popular here? It's even a Japan.`
};

// 피치 분석기 객체
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
        console.log('Pitch analyzer initialized');
    },

    // 나머지 pitchAnalyzer 메서드들은 그대로 유지
    // ... (기존 pitchAnalyzer 코드)
};

// 앱 초기화 함수
async function initializeApp() {
    console.log('Starting app initialization...');
    
    try {
        // Azure Speech SDK 확인
        if (!window.SpeechSDK) {
            throw new Error('Speech SDK가 로드되지 않았습니다. SDK 스크립트를 확인해주세요.');
        }

        // 설정 확인
        if (!window.config || !window.config.apiKey || !window.config.region) {
            throw new Error('Azure Speech 설정이 없습니다. config 객체를 확인해주세요.');
        }

        // AudioContext 초기화
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext state:', audioContext.state);
            
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
                console.log('AudioContext resumed');
            }
        }

        // Speech SDK 초기화
        speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
            window.config.apiKey, 
            window.config.region
        );
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log('Speech SDK initialized');

        // 오디오 시각화 초기화
        initAudioVisualizer();
        console.log('Audio visualizer initialized');

        // Pitch Analyzer 초기화
        pitchAnalyzer.init();

        return true;
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('status').textContent = `초기화 오류: ${error.message}`;
        return false;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    try {
        // 샘플 버튼 이벤트
        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleNumber = parseInt(e.target.dataset.sample);
                if (isNaN(sampleNumber)) {
                    console.error('Invalid sample number:', e.target.dataset.sample);
                    return;
                }
                changeSample(sampleNumber);
                console.log('Sample changed to:', sampleNumber);
            });
        });

        // 컨트롤 버튼 이벤트
        const playNativeBtn = document.getElementById('playNative');
        const startRecordingBtn = document.getElementById('startRecording');
        const stopRecordingBtn = document.getElementById('stopRecording');

        if (!playNativeBtn || !startRecordingBtn || !stopRecordingBtn) {
            throw new Error('필요한 버튼을 찾을 수 없습니다');
        }

        playNativeBtn.addEventListener('click', async () => {
            console.log('Native speaker playback requested');
            await playNativeSpeaker();
        });

        startRecordingBtn.addEventListener('click', async () => {
            console.log('Recording start requested');
            await startRecording();
        });

        stopRecordingBtn.addEventListener('click', () => {
            console.log('Recording stop requested');
            stopRecording();
        });

        console.log('Event listeners setup completed');
    } catch (error) {
        console.error('Event listener setup error:', error);
        document.getElementById('status').textContent = `설정 오류: ${error.message}`;
    }
}

// 오디오 상태 확인
function checkAudioState() {
    if (!audioContext) {
        console.error('AudioContext not initialized');
        return false;
    }

    if (audioContext.state === 'suspended') {
        console.warn('AudioContext is suspended, attempting to resume...');
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
        }).catch(error => {
            console.error('Failed to resume AudioContext:', error);
        });
        return false;
    }

    return true;
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

// 오디오 시각화 초기화
function initAudioVisualizer() {
    const canvas = document.getElementById('audioVisualizer');
    if (!canvas) {
        console.error('Audio visualizer canvas not found');
        return;
    }
    audioVisualizerContext = canvas.getContext('2d');
    visualizerAnalyser = audioContext.createAnalyser();
    visualizerAnalyser.fftSize = 2048;
}

// 오디오 시각화
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

// 네이티브 스피커 재생
async function playNativeSpeaker() {
    console.log('Starting native speaker playback...');
    
    if (!checkAudioState()) {
        document.getElementById('status').textContent = '오디오 시스템이 준비되지 않았습니다';
        return;
    }

    const statusElement = document.getElementById('status');
    const playButton = document.getElementById('playNative');

    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        statusElement.textContent = '오디오 로딩중...';
        playButton.disabled = true;

        const audioPath = `audio/native-speaker${currentSample}.mp3`;
        const audioElement = new Audio(audioPath);
        
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(pitchAnalyzer.nativeAnalyzer);
        source.connect(visualizerAnalyser);
        pitchAnalyzer.nativeAnalyzer.connect(audioContext.destination);

        audioElement.oncanplaythrough = () => {
            console.log('Audio ready to play');
            audioElement.play();
            
            const bufferLength = pitchAnalyzer.nativeAnalyzer.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);

            const dataCollectionInterval = setInterval(() => {
                pitchAnalyzer.nativeAnalyzer.getFloatTimeDomainData(dataArray);
                pitchAnalyzer.collectPitchData(dataArray, true);
            }, 100);

            audioElement.onended = () => {
                clearInterval(dataCollectionInterval);
                statusElement.textContent = '재생 완료';
                playButton.disabled = false;
            };

            statusElement.textContent = '재생중...';
            currentAudio = audioElement;
        };

        audioElement.onerror = (e) => {
            console.error('Audio loading error:', e);
            statusElement.textContent = '오디오 로딩 실패';
            playButton.disabled = false;
        };

        audioElement.load();
    } catch (error) {
        console.error('Playback error:', error);
        statusElement.textContent = `재생 오류: ${error.message}`;
        playButton.disabled = false;
    }
}

// 녹음 시작
async function startRecording() {
    console.log("Starting recording...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = '이 기기에서는 마이크 사용이 불가능합니다';
        console.error("getUserMedia not supported");
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

        const pronunciationAssessmentConfig = new SpeechSDK.PronunciationAssessmentConfig(
            referenceText,
            SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
            SpeechSDK.PronunciationAssessmentGranularity.Word,
            true
        );

        pronunciationAssessmentConfig.enableProsodyAssessment = true;
        pronunciationAssessmentConfig.enableDetailedResultOutput = true;
        
        speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        
        audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        
        pronunciationAssessmentConfig.applyTo(recognizer);

        recognizer.recognized = (s, e) => {
            if (e.result.text) {
                console.log("Recognition result:", e.result);
                const pronunciationResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
                analyzePronunciation(pronunciationResult);
            }
        };

        isRecording = true;
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
        document.getElementById('status').textContent = '녹음중... 말씀해주세요!';

        recognizer.startContinuousRecognitionAsync();
    } catch (error) {
        console.error('Recording error:', error);
        document.getElementById('status').textContent = `녹음 오류: ${error.message}`;
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
                document.getElementById('status').textContent = '녹음 완료';
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
                console.error('Stop recording error:', err);
                document.getElementById('status').textContent = `녹음 중지 오류: ${err}`;
            }
        );
    }
}

// 샘플 변경
function changeSample(sampleNumber) {
    const practiceText = document.querySelector('.practice-text');
    if (practiceText) {
        practiceText.textContent = sampleTexts[sampleNumber] || "샘플 텍스트를 찾을 수 없습니다";
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

// 피드백 스타일 적용
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

// 발음 분석
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

    const visualizerElement = document.getElementById('pronunciationVisualizer');
    if (visualizerElement) {
        const assessmentData = pronunciationResult.privPronJson;
        const words = assessmentData.Words || 
                     assessmentData.words || 
                     (assessmentData.NBest && assessmentData.NBest[0]?.Words) ||
                     [];

        // React 컴포넌트 정의
        const PronunciationVisualizer = () => {
            const getScoreColor = (score) => {
                if (score >= 80) return 'bg-green-500';
                if (score >= 60) return 'bg-yellow-500';
                return 'bg-red-500';
            };

            return React.createElement('div', { className: 'w-full max-w-4xl mx-auto p-6 bg-white rounded-lg' },
                // 전체 점수 섹션
                React.createElement('div', { className: 'mb-8' },
                    React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '전체 평가'),
                    React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
                        [
                            { label: '발음', score: pronunciationResult.pronunciationScore },
                            { label: '정확성', score: pronunciationResult.accuracyScore },
                            { label: '유창성', score: pronunciationResult.fluencyScore },
                            { label: '완결성', score: pronunciationResult.completenessScore }
                        ].map(({ label, score }, index) =>
                            React.createElement('div', { key: index, className: 'bg-gray-50 p-4 rounded-lg' },
                                React.createElement('div', { className: 'text-sm text-gray-600' }, label),
                                React.createElement('div', { className: 'text-2xl font-bold text-gray-800' }, 
                                    score.toFixed(1)
                                ),
                                React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2 mt-2' },
                                    React.createElement('div', {
                                        className: `${getScoreColor(score)} rounded-full h-2`,
                                        style: { width: `${score}%` }
                                    })
                                )
                            )
                        )
                    )
                ),

                // 단어별 분석 섹션
                React.createElement('div', { className: 'mt-8' },
                    React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '단어별 분석'),
                    React.createElement('div', { className: 'space-y-4' },
                        words.map((word, index) => 
                            React.createElement('div', { key: index, className: 'bg-gray-50 p-4 rounded-lg' },
                                [
                                    React.createElement('div', { className: 'flex justify-between items-center mb-2' },
                                        React.createElement('span', { className: 'text-lg font-semibold' }, word.Word || ''),
                                        React.createElement('span', { className: 'text-sm font-medium text-gray-600' },
                                            `Score: ${(word.PronunciationAssessment?.AccuracyScore || 0).toFixed(1)}`
                                        )
                                    ),
                                    // 피드백 메시지
                                    word.PronunciationAssessment?.AccuracyScore < 80 &&
                                    React.createElement('div', { className: 'mt-2 p-2 bg-yellow-50 rounded' },
                                        React.createElement('p', { className: 'text-sm text-yellow-700' },
                                            '발음 개선이 필요합니다'
                                        )
                                    )
                                ]
                            )
                        )
                    )
                ),

                // 억양 분석 섹션
                React.createElement('div', { className: 'mt-8' },
                    React.createElement('h2', { className: 'text-xl font-bold mb-4' }, '억양 분석'),
                    React.createElement('div', { className: 'bg-gray-50 p-4 rounded-lg' },
                        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
                            React.createElement('span', { className: 'text-gray-600' }, '억양 유사도'),
                            React.createElement('span', { className: 'font-semibold' },
                                `${pitchAnalyzer.calculateSimilarity().toFixed(1)}%`
                            )
                        )
                    )
                )
            );
        };

        // React 컴포넌트 렌더링
        ReactDOM.render(
            React.createElement(PronunciationVisualizer),
            visualizerElement
        );
    }

    // pitchAnalyzer 결과 표시
    pitchAnalyzer.displayResults();
    pitchAnalyzer.reset();
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded, starting initialization...');
    
    try {
        // SDK 로딩 대기
        await waitForSDK();
        console.log('SDK loaded successfully');

        // 앱 초기화
        const initSuccess = await initializeApp();
        if (!initSuccess) {
            throw new Error('Application initialization failed');
        }

        // 이벤트 리스너 설정
        setupEventListeners();

        // 모바일 디바이스 확인 및 지원
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('Mobile device detected, initializing mobile support');
            initMobileSupport();
        }

        // 초기 샘플 텍스트 설정
        const practiceText = document.querySelector('.practice-text');
        if (practiceText) {
            practiceText.textContent = sampleTexts[1];
            console.log('Initial sample text set');
        } else {
            console.warn('Practice text element not found');
        }

        // 피드백 스타일 적용
        applyStylesToFeedback();

        console.log('Application initialization completed successfully');
    } catch (error) {
        console.error('Fatal initialization error:', error);
        document.getElementById('status').textContent = 
            `초기화 실패: ${error.message}. 페이지를 새로고침해주세요.`;
    }
});
