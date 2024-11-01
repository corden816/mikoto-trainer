// 파일 상단의 import 구문을 다음과 같이 수정
const { Alert, AlertDescription } = window['@/components/ui/alert'];
const { Card, CardContent, CardHeader, CardTitle } = window['@/components/ui/card'];
const { Progress } = window['@/components/ui/progress'];
const { useState } = React;

const PronunciationVisualizer = ({ assessmentData }) => {
  const [expandedWord, setExpandedWord] = useState(null);

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatScore = (score) => Number(score).toFixed(1);

  if (!assessmentData) {
    return (
      <Alert>
        <AlertDescription>
          No pronunciation data available. Please try recording again.
        </AlertDescription>
      </Alert>
    );
  }

  const { pronunciationScore, accuracyScore, fluencyScore, completenessScore, words = [] } = assessmentData;

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Overall Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Pronunciation', score: pronunciationScore },
              { label: 'Accuracy', score: accuracyScore },
              { label: 'Fluency', score: fluencyScore },
              { label: 'Completeness', score: completenessScore }
            ].map(({ label, score }, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm font-medium">{formatScore(score)}</span>
                </div>
                <Progress 
                  value={score} 
                  className={`${getScoreColor(score)} h-2`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Word-by-Word Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {words.map((word, index) => (
              <div 
                key={index}
                className="p-4 rounded-lg border cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedWord(expandedWord === index ? null : index)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{word.word}</span>
                  <span className="text-sm font-medium">
                    Score: {formatScore(word.accuracyScore)}
                  </span>
                </div>
                
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Accuracy</span>
                      <span>{formatScore(word.accuracyScore)}%</span>
                    </div>
                    <Progress 
                      value={word.accuracyScore} 
                      className={`${getScoreColor(word.accuracyScore)} h-2`}
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fluency</span>
                      <span>{formatScore(word.fluencyScore)}%</span>
                    </div>
                    <Progress 
                      value={word.fluencyScore} 
                      className={`${getScoreColor(word.fluencyScore)} h-2`}
                    />
                  </div>
                </div>

                {expandedWord === index && word.accuracyScore < 80 && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      <div className="font-medium">Improvement suggestions:</div>
                      <ul className="list-disc pl-4 mt-2">
                        <li>Focus on clear articulation of each syllable</li>
                        <li>Practice the word in isolation first</li>
                        {word.fluencyScore < 80 && (
                          <li>Work on smoother pronunciation without hesitation</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PronunciationVisualizer;
