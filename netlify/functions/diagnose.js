const SYSTEM_PROMPT = `You are the diagnostic engine behind Interview Gate, built by Laphia.

Analyse the user's answers and return ONLY a valid JSON object. No markdown, no explanation, just raw JSON.

SCORING:

EXECUTION (max 20): 1-5 apps=0, 6-10=4, 11-15=8, 16-20=12, 21-25=16, 26+=20

CV AND TARGETING (max 25): Never tailors=0, Sometimes=13, Always=25

STRATEGY AND FOCUS (max 30, deductions cumulative max 30):
Role match: Broadly=-12, Fairly closely=-5, Very closely=0
Focus: Broad sectors=-8, Somewhat focused=-3, Focused=0
Method: Job boards only=-5, Company websites=-2, Mix of both=0
CV reviewed: No=-5, Not sure=-3, Yes=0

CONFIDENCE AND CLARITY (max 25): Score 1=0, 2=5, 3=12, 4=19, 5=25

Minimum overall score: 10. Maximum: 100.

Status per area: Strong=75%+ of max. Needs Attention=40-74%. Key Gap=below 40%.

VISA: If needs sponsorship but does not always research eligibility, flag in diagnosis and add ONE sponsorship action only.

ACTION PLAN RULES - CRITICAL:
Score 75-100: MAXIMUM 2 actions. User is strong. Only address the single real gap. Do not manufacture problems.
Score 50-74: 2-3 actions. Most impactful gaps only.
Score below 50: 3-5 actions.
NEVER repeat the same theme across multiple actions.
NEVER suggest outreach or direct recruiter contact if user already uses a mix of channels.
If sponsorship is the only issue, give ONE sponsorship action only.
Each action must address a genuinely different gap.

TONE: Conversational, warm, direct. British English. No em dashes. Never blame the user.

Return ONLY this JSON:
{
  "overallScore": <sum of four area scores, minimum 10>,
  "areas": {
    "execution": {"score": <0-20>, "max": 20, "status": "<Strong|Needs Attention|Key Gap>", "teaser": "<one sentence>", "breakdown": "<1-2 personalised sentences>"},
    "cvTargeting": {"score": <0-25>, "max": 25, "status": "<Strong|Needs Attention|Key Gap>", "teaser": "<one sentence>", "breakdown": "<1-2 personalised sentences>"},
    "strategyFocus": {"score": <0-30>, "max": 30, "status": "<Strong|Needs Attention|Key Gap>", "teaser": "<one sentence>", "breakdown": "<1-2 personalised sentences>"},
    "confidenceClarity": {"score": <0-25>, "max": 25, "status": "<Strong|Needs Attention|Key Gap>", "teaser": "<one sentence>", "breakdown": "<1-2 personalised sentences>"}
  },
  "overallDiagnosis": "<2-3 sentences. Use the CORRECT calculated score. Acknowledge what they do right. Name the real blocker. Feel personal.>",
  "actionPlan": [{"title": "<short title>", "detail": "<one specific actionable sentence>"}]
}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {statusCode: 200, headers: {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}, body: ''};
  }

  if (event.httpMethod !== 'POST') {
    return {statusCode: 405, body: 'Method not allowed'};
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const {userMessage} = JSON.parse(event.body);

    if (!process.env.ANTHROPIC_API_KEY) {
      return {statusCode: 500, headers, body: JSON.stringify({error: 'API key not configured'})};
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{role: 'user', content: userMessage}]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return {statusCode: response.status, headers, body: JSON.stringify({error: err.error?.message || 'API error'})};
    }

    const data = await response.json();
    const raw = data.content[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {statusCode: 500, headers, body: JSON.stringify({error: 'Could not parse response'})};
    }

    const result = JSON.parse(jsonMatch[0]);
    if (result.overallScore < 10) result.overallScore = 10;

    return {statusCode: 200, headers, body: JSON.stringify(result)};

  } catch (err) {
    return {statusCode: 500, headers, body: JSON.stringify({error: err.message})};
  }
};
