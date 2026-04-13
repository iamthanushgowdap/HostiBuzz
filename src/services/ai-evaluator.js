import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AIEvaluator: A service to analyze student submissions using Gemini Pro.
 * Provides suggested scores and qualitative feedback.
 */
export const AIEvaluator = {
  /**
   * Evaluates a submission based on the round type and content.
   * @param {string} apiKey - The user's Gemini API Key
   * @param {Object} round - The round configuration
   * @param {Object} submission - The team's submission data
   * @returns {Promise<{score: number, feedback: string}>}
   */
  // Internal cache to prevent redundant discovery calls
  _cachedModel: null,

  async evaluate(apiKey, round, submission, assets = null) {
    if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");

    const getBestModel = async () => {
       if (this._cachedModel) return this._cachedModel;

       try {
         const resp = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
         const data = await resp.json();
         if (data.models) {
           const supported = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
           
           // List of guaranteed stable identifiers we prefer
           const stableOrder = [
             'gemini-1.5-flash',
             'gemini-1.5-pro',
             'gemini-pro',
             'gemini-1.0-pro'
           ];

           for (const target of stableOrder) {
             const match = supported.find(m => m.name.includes(target));
             if (match) {
               this._cachedModel = match.name.replace('models/', '');
               return this._cachedModel;
             }
           }

           // Last resort: find anything that isn't experimental 2.x
           const fallback = supported.find(m => !m.name.includes('2.0') && !m.name.includes('2.5'));
           if (fallback) {
             this._cachedModel = fallback.name.replace('models/', '');
             return this._cachedModel;
           }
         }
       } catch (e) {
         console.warn("Model discovery failed, using default.");
       }
       
       this._cachedModel = 'gemini-1.5-flash';
       return this._cachedModel;
    };

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = this.generatePrompt(round, submission, assets);

    const tryEvaluate = async (modelName) => {
      // Explicitly forcing v1 for every request to avoid v1beta 404s
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonStr = text.match(/\{.*\}/s);
      if (jsonStr) return JSON.parse(jsonStr[0]);
      throw new Error("AI_RESPONSE_PARSING_FAILED");
    };

    try {
      const modelName = await getBestModel();
      console.log(`Using intelligence model: ${modelName}`);
      return await tryEvaluate(modelName);
    } catch (err) {
      console.error("Evaluation failed with primary model:", err);
      // Desperation fallback for 503/404 errors: try stable pro directly
      if (err.message?.includes('503') || err.message?.includes('404')) {
         try {
           return await tryEvaluate("gemini-1.5-pro");
         } catch (e) {
           throw new Error(`AI_SERVICE_UNAVAILABLE: ${err.message}`);
         }
      }
      throw err;
    }
  },

  /**
   * Bulk evaluates all submissions for a round.
   * Uses sequential processing with minor delay to stay within API rate limits.
   */
  async evaluateAllSubmissions(apiKey, round, submissions, assets = null) {
    if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
    
    const results = [];
    for (const sub of submissions) {
      try {
        const evalRes = await this.evaluate(apiKey, round, sub, assets);
        results.push({ teamId: sub.team_id, ...evalRes, success: true });
      } catch (err) {
        results.push({ teamId: sub.team_id, error: err.message, success: false });
      }
      // Small 200ms delay between parallel calls to prevent 429 errors
      await new Promise(r => setTimeout(r, 200));
    }
    
    return results;
  },

  generatePrompt(round, submission, assets = null) {
    let context = `Round Type: ${round.round_type}\nRound Title: ${round.title}\n`;
    
    // Include Asset Reference if provided
    if (assets) {
      context += `\n[REFERENCE ANSWER KEY / MASTER ASSETS]\n${JSON.stringify(assets, null, 2)}\n`;
    }

    if (round.round_type === 'webdev') {
      context += `\n[SUBMISSION]\nGitHub: ${submission.github_link}\nLive URL: ${submission.live_link}\n`;
      context += `\nInstructions: Act as a technical judge. Evaluate the web development project based on these links. If you cannot visit them, suggest a score based on the effort implied. If round assets (guidelines) are provided, ensure strict adherence.`;
    } else if (round.round_type === 'prompt') {
      context += `\n[SUBMISSION]\nStudent Prompt: ${submission.text_content}\n`;
      context += `\nInstructions: Compare the student's prompt with any reference prompt/image description in the assets. Evaluate creativity and alignment with the target theme.`;
    } else if (round.round_type === 'quiz') {
      context += `\n[SUBMISSION]\nUser Answers: ${JSON.stringify(submission.answers)}\n`;
      context += `\nInstructions: Perform a strict comparison between 'User Answers' and the 'Reference Answer Key'. Award 1 mark for each exact match. Calculate a percentage score (0-100).`;
    } else if (round.round_type === 'logo') {
      context += `\n[SUBMISSION]\nUser Guess: ${submission.answers ? JSON.stringify(submission.answers) : (submission.text_content || 'N/A')}\n`;
      context += `\nInstructions: Compare the user's logo guesses with the correct brand names in the master assets. Be lenient with minor spelling errors, but strict on core identity.`;
    } else {
      context += `\n[SUBMISSION]\nSubmission Data: ${JSON.stringify(submission.answers || submission.text_content || submission)}\n`;
      context += `\nInstructions: Review this participation against the master assets provided and provide a fair technical score.`;
    }

    return `
      ${context}
      
      CRITICAL: You are an objective technical evaluator.
      
      Please provide your evaluation in JSON format ONLY:
      {
        "score": (0-100),
        "feedback": "2-sentence technical rationale explaining why this score was given compared to the Master Key"
      }
    `;
  }
};
