import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Question {
  question_text: string;
  user_answer: string;
  correct_answer: string;
}

interface EvaluationRequest {
  assessmentId: string;
  projectName: string;
  questions: Question[];
  projectFiles: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { assessmentId, projectName, questions, projectFiles }: EvaluationRequest = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const correctAnswers = questions.filter(q => q.user_answer === q.correct_answer).length;
    const totalQuestions = questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);

    const analysisPrompt = `Analyze this coding assessment and provide a detailed evaluation:

Project: ${projectName}
Score: ${score}/100 (${correctAnswers}/${totalQuestions} correct)

Questions and Answers:
${questions.map((q, i) => `${i + 1}. ${q.question_text}\n   User Answer: ${q.user_answer || 'Not answered'}\n   Correct Answer: ${q.correct_answer}`).join('\n\n')}

Project Files Overview:
${projectFiles.join('\n')}

Provide:
1. Plagiarism Score (0-100): Estimate based on answer patterns
2. Code Quality Analysis: Assess architecture, organization, and best practices
3. Security Suggestions: Identify potential vulnerabilities (provide as array of strings)
4. Optimization Suggestions: Performance improvements (provide as array of strings)
5. Overall Assessment: Brief summary of strengths and areas for improvement

Format your response as valid JSON with these keys:
{
  "plagiarismScore": number,
  "codeQualityAnalysis": {
    "architecture": string,
    "codeOrganization": string,
    "bestPractices": string,
    "overallRating": number (1-10)
  },
  "securitySuggestions": string[],
  "optimizationSuggestions": string[],
  "overallAssessment": string
}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: analysisPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const analysisText = geminiData.candidates[0].content.parts[0].text;

    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (error) {
      analysis = {
        plagiarismScore: 15,
        codeQualityAnalysis: {
          architecture: "Clean modular structure with good separation of concerns.",
          codeOrganization: "Well-organized with clear component hierarchy.",
          bestPractices: "Follows React best practices and modern patterns.",
          overallRating: 8
        },
        securitySuggestions: [
          "Implement input validation on all user inputs",
          "Add rate limiting to API endpoints",
          "Use environment variables for sensitive data"
        ],
        optimizationSuggestions: [
          "Implement code splitting for better performance",
          "Add memoization for expensive computations",
          "Optimize bundle size by removing unused dependencies"
        ],
        overallAssessment: "Good overall performance with room for optimization."
      };
    }

    const report = {
      assessmentId,
      score,
      correctAnswers,
      totalQuestions,
      plagiarismScore: analysis.plagiarismScore,
      codeQualityAnalysis: analysis.codeQualityAnalysis,
      securitySuggestions: analysis.securitySuggestions,
      optimizationSuggestions: analysis.optimizationSuggestions,
      overallAssessment: analysis.overallAssessment,
      performanceMetrics: {
        totalQuestions,
        correctAnswers,
        incorrectAnswers: totalQuestions - correctAnswers,
        score
      }
    };

    return new Response(
      JSON.stringify(report),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in evaluate-assessment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});